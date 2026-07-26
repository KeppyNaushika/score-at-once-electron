# 削除同期の再設計 — DeletedRecord / enforceTombstones の撤去

- 対象 issue: #918（スコープ差し替え）、#579（意識的に回帰させる）
- 調査日: 2026-07-25
- 状態: **Phase 1〜3 すべて完了**（§5 参照）
- ⚠️ **配布は 3 フェーズ一括で行うこと**（分割すると混在バージョン期の保護が働かない。§5 末尾）
- 備考: §4.4「バージョン変更は不要」・§4.5「DB スキーマは当面触らない」は Phase 2 時点の判断で、
  Phase 3 まで進めた結果いずれも実施済み（アーカイブ v1.19.0・テーブル DROP）。経緯として残す

---

## 1. 背景

issue #918 は「`DeletedRecord` tombstone が `DrawingAnnotation` しか記録しておらず、import の復活防止が不完全」として、記録側を全エンティティへ広げることを提案していた。

調査の結果、**この issue は向きが逆**であることが判明した。以下はその根拠と、方針転換に伴う影響の全量である。

---

## 2. 事実確認: tombstone は2つ別々に存在する

|                | ライブラリ `_tombstone`                                                | アプリ `DeletedRecord`                  |
| -------------- | ---------------------------------------------------------------------- | --------------------------------------- |
| 実体           | sqlite-nas-sync 内部テーブル（`setup.ts:69`）                          | Prisma モデル                           |
| 記録           | 全同期テーブルの AFTER DELETE トリガーで**自動**（`setup.ts:114-123`） | `recordDeletion` の手書き呼び出し       |
| 判定           | **時刻比較あり（LWW）**                                                | **無条件**（`syncService.ts:97`）       |
| 削除の位置づけ | 時刻を持つ**イベント**                                                 | id に貼られた**永久属性**               |
| 復活           | 許す（最新の更新が新しければ存続）                                     | 絶対に許さない                          |
| 有効期限       | `deletedAt` の比較で自然に負ける                                       | `deleteProtected`・全端末同期・消せない |

**同期のための tombstone は `_tombstone` であって `DeletedRecord` ではない。** ライブラリ側を grep しても `DeletedRecord` は 1 件も出てこない。

ライブラリの設計思想は `sync.ts` のコメントに明記されている：

> 無条件削除ではなくLWWで判定するため、クライアントの処理順に依存せず「最新の更新 > 最新の削除なら存続、さもなくば削除」へ決定論的に収束する。

### 2.1 `DeletedRecord` の出自

```
062815e2  2026-03-22  feat: 削除記録（tombstone）テーブルを追加しインポート時のデータ復活を防止
          物理削除されたDrawingAnnotationが.scoreインポート時に復活する問題（#579）を
          DeletedRecordテーブル（tombstone方式）で解決。          Closes #579

8f50c5a8  2026-03-23  feat: sqlite-nas-syncによるNAS同期機能を追加
31c58570  2026-03-23  fix: enforceTombstonesの全テーブル対応とsync設定パスのローカル化
```

import 復活防止のために作られ、NAS 同期の**前日**に存在していた。翌日 `enforceTombstones` として同期パスにも組み込まれ、以後2つの機構が二重に走っている。

### 2.2 致命的な非対称

`enforceTombstones`（`syncService.ts:85-102`）は同期のたびに `DeletedRecord` を**全行スキャン**し、時刻を一切見ずに `DELETE FROM "<tableName>" WHERE id = ?` を実行する。

この DELETE は同期テーブルに対するものなので、ライブラリの AFTER DELETE トリガーを発火させ、`_tombstone` に `datetime('now')` を刻む。つまり**同期のたびに「今この瞬間の削除イベント」を捏造し、LWW に勝ち続ける**。

現在この機構が暴走していないのは、記録側が `DrawingAnnotation` しか埋めていないからにすぎない（適用側は 31c58570 で全テーブル化済み）。**片肺状態が事実上の安全弁になっている。**

---

## 3. 方針決定: アーカイブは正本であり、import は忠実に復元する

アーカイブはスナップショットであって削除を表現できない。「アーカイブに X が無い」は次のどれとも区別がつかない。

- 相手が X を削除した
- 相手にはもともと X が無かった
- X がアーカイブのスコープ外（exam 単位のため試験外の実体は入らない）

削除を推論する根拠がない以上、**追加とマージだけが唯一安全な解釈**である。これは妥協ではなく情報量から決まる。

加えて import は明示的なユーザー操作（ファイル選択・競合 UI・件数サマリ）であり、それが不可視・永久・全端末配布の kill-list に黙って覆されるのは利用者に説明不能な挙動になる。

### 3.1 「正本」の射程

| 対象     | 扱い                                                           |
| -------- | -------------------------------------------------------------- |
| **存在** | **archive 正本**。在るものは作る／無いものから削除を推論しない |
| **値**   | **archive 正本にしない**。LWW と競合 UI で解決                 |

値まで archive 勝ちにすると、古いアーカイブの取り込みでその後に積み上げた採点が巻き戻る。復活より深刻な損失になる。

現在のコードは `DrawingAnnotation` の tombstone 特例を除けば**既にこの形**である。よってこの方針は新しい設計の導入ではなく、**後から足された例外を取り除いて元の一貫した形に戻す**作業である。

---

## 4. 影響調査

### 4.1 同期パス（本丸）

| 対象                                                                     | 措置     |
| ------------------------------------------------------------------------ | -------- |
| `syncService.ts:71-102` `getTombstoneTargetTables` / `enforceTombstones` | 削除     |
| `syncService.ts:193` `onAfterSync` からの呼び出し                        | 削除     |
| `syncTableConfig.ts:30-33` `SYNC_TABLE_OPTIONS.DeletedRecord`            | 役目消滅 |

`_tombstone` が全同期テーブルを自動記録し、`applyInsert` / `applyTombstoneDelete` が LWW で判定する。`enforceTombstones` が上乗せしていたのは「時刻を見ずに永久に殺す」ことだけで、それが今回否定された挙動そのもの。

> ⚠️ **ただしライブラリ 0.13.1 以上が前提**（§4.9）。当初「失う機能はない」と書いたが、
> これは `~/dev/sqlite-nas-sync`（当時 0.13.1）を読んだ判断で、実際にインストールされていたのは
> 0.12.0 だった。0.12.0 の LWW 比較は壊れており、`enforceTombstones` がそれを部分的に覆い隠していた。

### 4.2 import パス

- `importSyncRecords.ts:13-46` `processDeletedRecords` — 削除。**アーカイブの kill-list をローカル DB に持ち込む経路**で、方針と正面から矛盾する
- `importSyncRecords.ts:56-73` tombstone スキップ — 削除
- `idIntegrationImporter.ts:53, 276` の呼び出し — 削除
- `counts.skipped.annotations` はここでしか増えないため、以後常に 0

### 4.3 記録パス

`deletedRecord.ts`（191 行）全体と、呼び出し 6 箇所：

| ファイル                          | 行        |
| --------------------------------- | --------- |
| `drawingAnnotation.ts`            | 520 / 555 |
| `questionScore.ts`                | 500       |
| `gradingData.ts`                  | 109       |
| `studentAnswer/crud.ts`           | 611       |
| `studentAnswer/placementApply.ts` | 334       |

- `getDeletedRecordsForExam` と `isDeleted` は**既に消費者ゼロのデッドコード**
- **副次的改善**: `crud.ts:646-648` に「tombstone は SQLite に skipDuplicates が無く1行ずつ upsert するため既定 5s を超えうる（超えると P2028 で削除ごとロールバック）」とあり、答案削除のトランザクション timeout が 30s へ引き上げられている。記録停止で既定へ戻せる見込みがあり、削除失敗リスクが下がる

### 4.4 アーカイブ形式 — バージョン変更は不要（Phase 2 時点の判断・§5 で更新）

`deleted-records.json` は v1.9.0 のメンバー：

- `src/types/examArchive.types.ts:146`（`deletedRecordsData?`）、`:1093-1096`（`ArchiveDeletedRecordsData`）
- `electron-src/lib/export/exam-archive/archiveCreator.ts:206`
- `electron-src/lib/import/exam-archive/archiveExtractor.ts:115-169`
- `electron-src/lib/import/transformers/V1_8_0_to_V1_9_0.ts`

**推奨: ファイルは残し、消費だけやめる。** 記録を止めれば中身は自然に `{"deletedRecords":[]}` になる。バージョン上げも変換器追加も不要で、既存アーカイブとの相互運用も無傷。古いアーカイブが tombstone を持っていても無視するだけ ＝ それが方針そのもの。

`.grade` / `.coursework` / student-archive には tombstone が存在せず、**影響ゼロ**。

### 4.5 DB スキーマ — 当面は触らない（Phase 2 時点の判断・§5 で更新）

`versionDetector.ts:44-51` が S9 判定に `DeletedRecord` の存在を使っているが、`detectSchemaVersion` は `_prisma_migrations` があれば真っ先に `MIGRATED` を返す（`:19-21`）ため、**移行済み DB は S9 判定に到達しない**。将来 DROP しても検出は壊れない（S9 判定は Prisma 管理以前の旧 DB 専用で、それらは必ず表を持つ）。

ただし DROP は歴史 migration・freshInstall のドリフト検知・`bridgeIntegration.test.ts:108/464` に触れるため、フェーズを分ける。

### 4.6 混在バージョン期間 — schemaVersion ゲートが自動で守る

`DeletedRecord` は同期対象テーブルなので、既存の tombstone 行は**すでに全端末の DB に配られている**。未更新の端末は同期のたびに `enforceTombstones` を実行し続けるため、当初は「更新済み端末が復元したデータを未更新端末が消して回る」危険を想定していた。

**これは自動的に防がれる。** `schemaVersion`（＝最新マイグレーション名）が一致しないリモートは、増分パス（`dist/sync.js:416-421`）でもギャップ検出/フルマージパス（`:568-572`）でもスキップされる。更新済み端末と未更新端末は相互に無視し合うので、未更新端末の `enforceTombstones` の実行結果が更新済み端末へ伝わる経路は存在しない。

利用者への通知も既にある（`SyncSettingsTab.tsx:153-176`）。新旧どちら側かを判別して文言を出し分けるので、**リリースノートで補う必要はない**。

> 他のPCが古いバージョンのアプリを使用しています。そのPCのアプリが更新されるまで、そのPCとの同期は保留されます。

**ただしこの保護は Phase 3 のマイグレーションが生んでいる。** `getSchemaVersion()` は最新マイグレーション名を返すので、DROP マイグレーションを含まない配布では `schemaVersion` が変わらず、ゲートが働かない。配布順への含意は §5 を参照。

### 4.7 意図的に戻る挙動

- #579 のシナリオ（削除した注釈が古い `.score` の取り込みで復活）が**正しい動作**になる
- **影響しないもの**: 値の競合解決は不変。QuestionScore の競合 UI（`importScoring.ts:59-63`）、ScoreDecision / CompoundAnswerScore の LWW はそのまま ＝「存在は archive 忠実／値は LWW + UI」の線引きが保たれる

### 4.8 テスト影響（8 ファイル）

| 区分             | ファイル                                                                                                                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **要修正**       | `__tests__/exam/integration/studentAnswerDelete.test.ts:209-235`（tombstone を assert）、`studentAnswerPlacementApply.test.ts:7`（コメント）                                                                    |
| **無修正で通る** | `helpers/testDataFactory.ts:297`、`helpers/testArchiveHelper.ts:214`、`import-export/integration/legacyArchiveExtract.test.ts`、`import-export/unit/examTransformerChain.test.ts`（空配列を渡す・期待するだけ） |
| **触らない**     | `migration/bridgeIntegration.test.ts`、`migration/versionDetector.test.ts`（旧 DB の話。Phase 3 まで無関係）                                                                                                    |
| **追加**         | 「削除 → 旧アーカイブ import → **復活する**」回帰テスト（方針を固定するため）                                                                                                                                   |

### 4.9 前提条件: sqlite-nas-sync 0.13.1 以上（コードレビューで発覚）

**インストール版 0.12.0 の `_tombstone` LWW 比較は壊れていた。**

- トリガーが書く `deletedAt` はスペース形式 `2026-07-26 09:00:00`
- アプリの `updatedAt` は ISO-T 形式 `2026-07-26T08:00:00.000+00:00`
- 0.12.0 は素の文字列比較（`dist/sync.js:229` の `ts.deletedAt > localUpdatedAt`）
- 同日なら 10 文字目で `' '(0x20) < 'T'(0x54)` となり、**削除は常に「古い」と判定される**

```
文字列比較(0.12.0):  "2026-07-26 09:00:00" > "2026-07-26T08:00:00.000+00:00"  → false ❌
julianday比較(0.13.1): 2461247.875 > 2461247.8333                            → true  ✅
```

影響範囲は changelog ギャップ時のフルマージと初回同期（増分パスは `applyDelete` が id 指定で
時刻を見ないため無事）。**全同期テーブルに等しく効く元からのバグ**で、`enforceTombstones` は
そのうち `DrawingAnnotation` だけを偶然覆い隠していた。撤去するとその一枚が剥がれる。

0.13.1 が `isLaterTimestamp`（SQLite の `julianday()` で正規化）で修正済みなので、
`^0.12.0` → `^0.13.1` へ更新した。`feat!:` が付いていないため破壊的変更なし。

**教訓:** `~/dev/<lib>` のソースと `node_modules` の実インストール版はズレる。
ライブラリの挙動を根拠にする判断では、必ず `node_modules` 側の dist を読むこと。

#### 回帰ガード: `__tests__/sync/deletePropagation.test.ts`

`sqlite-nas-sync` は Electron に依存しない素の Node ライブラリなので、一時ディレクトリに
「PC-A の DB」「PC-B の DB」「NAS」を作れば **実機2台なしで削除の伝わり方を検証できる**。
基準DB（`data/test-database.db`）を複製して実スキーマを使い、アプリの sync 設定
（`SYNC_EXCLUDE_TABLES` / `SYNC_TABLE_OPTIONS`）もそのまま流用する。

3 ケース: ①時刻形式の前提（ISO-T vs スペース形式）②増分同期での削除伝搬
③**ギャップ復帰時のフルマージで削除が維持されること**。

**このテストはアプリ側にしか置けない。** ライブラリ単体のテスト（`lww-determinism.test.ts`
等が揃っているのに 0.12.0 のバグは残った）では両方の時刻がトリガー由来のスペース形式に
なり、ISO-T の `updatedAt` は Prisma を通したアプリが書いたときにしか現れないため。

歯があることを確認済み: 0.12.0 に一時的に戻すとケース③だけが落ち、0.13.1 で通る
（ケース②は 0.12.0 でも通る＝増分パスは無条件削除だったため）。

**注意:** トリガーの `datetime('now')` は **UTC**。固定値の `updatedAt` を置くと実行時の
タイムゾーン次第で削除時刻より未来になり、LWW が正しく「更新の方が新しい」と判定して
テストが誤って落ちる。フィクスチャは SQLite 側で「1分前」を算出すること。

### 4.10 残る穴（自覚的に受け入れる）

ファイル交換のみの環境では、削除を伝える手段がゼロになる。削除は局所的・一過性の事情（スキャン失敗、生徒の取り違え）が大半で、恒常的な協調チャネルは NAS 同期側であるため許容する。

将来これを埋める必要が出た場合は、**時刻付きの削除ログ**（`deletedAt` と `updatedAt` を比較する LWW、ライブラリと同じ意味論）であって、id に永久の烙印を押す kill-list ではない。今回の不整合はすべて「削除を時刻のないフラグとして扱った」ことから出ている。

---

### 4.11 検証済み: cascade は本番接続でも効いている

撤去により「親 `QuestionScore` を消せば子 `DrawingAnnotation` も消える」という DB の
cascade だけが頼りになる。SQLite は `PRAGMA foreign_keys` が既定オフのため、本番接続で
効いているかを確認した。

- **接続の作りが本番とテストで同一** — `databaseInitializer.ts:31` と
  `testPrismaClient.ts:15` はどちらも `new PrismaBetterSqlite3({ url })` で、違いはパスと
  ログ設定のみ。よって `studentAnswerDelete.test.ts` の cascade 検証はそのまま本番の証拠になる
- **本番 DB の定義にも cascade がある** —
  `DrawingAnnotation_questionScoreId_fkey ... ON DELETE CASCADE ON UPDATE CASCADE`
- **孤児レコードは存在しない** — `PRAGMA foreign_key_check("DrawingAnnotation")` が空

---

## 5. 実施計画

**3 フェーズは必ずまとめて配布する。** 分割して Phase 1 だけを先に出すのは最も危ない
（理由は §5 末尾）。以下のフェーズ分けは作業単位であって、リリース単位ではない。

### Phase 1: 破壊的挙動の停止 — **完了**

- [x] `onAfterSync` から `enforceTombstones` を外す
- [x] `enforceTombstones` / `getTombstoneTargetTables` を削除
- [x] 削除伝搬を `_tombstone` に一本化する旨をモジュール冒頭に明記

### Phase 2: 復活防止の撤去 — **完了**

- [x] `deletedRecord.ts`（190行）を削除
- [x] 呼び出し 6 箇所を削除
      `drawingAnnotation.ts`（直接削除／一括削除）、`questionScore.ts`、`gradingData.ts`、
      `studentAnswer/crud.ts`、`studentAnswer/placementApply.ts`
- [x] `crud.ts` のトランザクション timeout 30s の理由コメントを実態に合わせて更新
      （tombstone の逐次 upsert が消えたので、値そのものの見直しは実測後に別途）
- [x] `studentAnswerDelete.test.ts` を方針に合わせて反転
      （cascade で消える／DeletedRecord には書かない、を検証）
- [x] `importSyncRecords.ts` の `processDeletedRecords` / tombstone スキップを削除
      `idIntegrationImporter.ts` の import・呼び出し・モジュール説明も更新
- [x] 回帰テスト追加（`idIntegrationImporter.test.ts` II-26）
      ローカル tombstone があってもアーカイブから復元されること、
      アーカイブ側の tombstone をローカル DB に取り込まないことを検証

### Phase 3: テーブルとアーカイブ形式の撤去 — **完了**

- [x] `prisma/schema.prisma` から `model DeletedRecord` を削除
- [x] マイグレーション `20260726090000_drop_deleted_record`（インデックス3本 + テーブルを DROP）
- [x] `syncTableConfig.ts` の `SYNC_TABLE_OPTIONS.DeletedRecord` を削除
- [x] アーカイブを **v1.19.0** へ。`deleted-records.json` の出力を停止し、
      `ExtractedArchiveData.deletedRecordsData` を廃止
- [x] 変換器 `V1_18_0_to_V1_19_0`（旧アーカイブの `deletedRecordsData` を読み捨て、件数を警告に出す）
- [x] `ArchiveDeletedRecordsData` は `subjectsData` と同様、変換器が旧形式を読み捨てるための
      **レガシー型として残置**（`@deprecated`）。抽出結果・エクスポートからは消えている
- [x] `freshInstallChain` のドリフト検知に**逆方向（余分なテーブル）の検査を追加**
      — 従来は基準側テーブルしか走査せず、DROP 漏れを検知できなかった
- [x] **`sqlite-nas-sync` を `^0.12.0` → `^0.13.1` へ更新**（§4.9）。
      0.12.0 の `_tombstone` LWW 比較が壊れており、本撤去の前提が成立していなかった

### ⚠️ 配布は 3 フェーズ一括で

混在バージョン期の保護（§4.6）を生んでいるのは **Phase 3 の DROP マイグレーション**である。
`getSchemaVersion()` は最新マイグレーション名を返すので、マイグレーションを含まない配布では
`schemaVersion` が変わらず、ゲートが働かない。

| 配布内容        | schemaVersion  | 結果                                                |
| --------------- | -------------- | --------------------------------------------------- |
| Phase 1 のみ    | **変わらない** | 未更新端末と同期し続ける → その kill-list が届く ❌ |
| Phase 1〜3 一括 | 変わる         | 相互スキップ → 未更新端末の影響を受けない ✅        |

当初は「破壊的挙動の停止を最優先で単独リリース」と計画していたが、**それが最も危険な配布順**
だった。Phase 1 は `enforceTombstones` を自分の端末から外すだけで、他端末のそれは止められない。
止められるのは schemaVersion を変える Phase 3 の方である。

---

## 6. #579 の扱い

問題設定（ファイル交換経路で削除が伝わらない）は妥当だった。誤っていたのは執行方法である。

- 時刻を捨てて無条件 DELETE にした
- ライブラリが LWW で同じ仕事をしている同期パスに二重に差し込んだ
- 記録側が 1 テーブルしか埋まらず、機構として一度も整合しなかった

したがって #579 を「間違った報告」として扱う必要はない。**執行方法を差し替える**（今回はいったん取り除く）という整理で筋が通る。挙動としての回帰は意識的な判断であり、見落としではない。

---

## 7. 参考

- [docs/import-export-architecture.md](./import-export-architecture.md)
- sqlite-nas-sync（`~/dev/sqlite-nas-sync`）— `src/setup.ts`（トリガーと `_tombstone` 作成）、`src/conflict.ts`（`applyInsert` の tombstone 判定）、`src/sync.ts`（`applyTombstoneDelete` の LWW）
