# 監査ログ（操作履歴）の拡充設計

issue #1102 を起点に、監査ログ全体の設計を確定した記録（2026-08-03）。
実装前の設計文書であり、着手時はここを参照する。

## 背景

監査ログは記録側がほぼ完成している（108アクション中99が計装済み・40ファイル以上の
mutation に `recordAuditLog` が埋まっている）が、**読み出し側が `/settings` のタブに
埋もれていて実質使えない**。本作業は新規投資ではなく、**既に払った記録コストの回収**。

改竄耐性・権限分離は持たない（同じ DB の同じテーブル・ロール制御なし）。
狙うのは「協調作業の追跡」であって、法的・制度的な証跡ではない。
設計の出自は Discord の Audit Log（コード内に "Discord風" と明記）。

## 実測データ（2026-08-02 時点、開発用 DB）

| 項目                        | 値                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| AuditLog 行数               | 17,240（50日分 = **353.7行/日**）                                                                 |
| 1行あたり                   | **325 bytes**                                                                                     |
| entityType 上位             | QuestionScore 8,922 (52%) / CropRegion 5,155 (30%) / AsbDefinition 2,017 (12%)                    |
| action 上位                 | exam.score.propose 8,169 (47%) / exam.region.update 5,114 (30%) / answer_sheet.update 1,994 (12%) |
| scopeId / scopeLabel の充足 | 17,137 / 17,240（**99.4%**）                                                                      |
| metadata キー分布           | changes 8,951 / **target 7,435** / count 282 / occurrences 38                                     |
| metadata.target の type     | 11種類（CropRegion 5,152 / AsbDefinition 2,017 / 他266）                                          |
| coalesceKey を持つ行        | **38件のみ**（0.2%）                                                                              |

### 性能（13万7,736行に増幅して計測）

| クエリ                                       | 実測                      |
| -------------------------------------------- | ------------------------- |
| ページング（index 使用）                     | **0ms**                   |
| 全文検索 `LIKE '%…%'`（フルスキャン）        | **423ms**                 |
| JSON `json_extract` — index なし             | 423ms                     |
| JSON `json_extract` — **式インデックスあり** | **0ms**（COVERING INDEX） |
| 子テーブル join + ORDER BY + LIMIT 50        | **9ms**                   |
| 子テーブル DISTINCT（候補生成）              | 84ms                      |

**SQLite は JSON の式インデックスを完全にサポートする**（`CREATE INDEX ON t(json_extract(col,'$.path'))`）。
性能面では JSON でも列と同等。採用しなかったのは性能以外の理由（後述）。

### 参照先テーブルの規模

Student 135 / ExamStudent 2,851 / CropRegion 1,087 / GradeItem 13 / CourseworkItem 8 / User 2。
**すべて全件を renderer へ渡せる規模**。ID→ラベル解決は renderer 側で `Map` 結合できる。

### CropRegion ラベルの重複（補完 UI の設計根拠）

同じ `label` が複数試験にまたがるものが **131種類**（1試験のみは241種類）。
`"1-1"` は15試験、`"1-2"` は16試験、`"氏名"` は28試験に存在する。
同一試験内でも重複する（"氏名" は28試験37領域）。
→ **候補表示に試験名の併記が必須**。

## 確定した設計

### 責務境界（規約の明示的な例外）

**フィルタ操作（ページネーション含む）のみを main 層で行う。データは行のまま渡す。**

- 許可: `where` / `orderBy` / `take` / `skip` / `count` / フィルタ選択肢の `distinct`
- 不許可: 行の射影・関連の平坦化・表示値の導出・表示のための集計

これは「計算は renderer 側」規約に対する**所有者が明示的に許可した例外**。
`docs/coding-style.md` の例外一覧に登録し、`auditQuery.ts` の `@fileoverview` にも明記する。
**例外の追加は所有者の明示指定のみ。「〜な場合は例外」という判断基準を書かない**
（基準を書くと必ず当てはめに使われ、勝手に拡大する）。

### IPC 粒度

```ts
audit:getLogs(filter, limit, offset) → { logs: Serialized<AuditLog>[], total, limit, offset }
audit:getScopes() → 引数なし・全件
fetchUsers()（既存）  ← actors は getLogs に含めない
```

- `total` は含める（分けると renderer にキャッシュ無効化の判断が乗る／2クエリ間で行が増えてページャがずれる）
- `actors` は含めない（User は全件渡せるので例外の対象外）
- `limit`/`offset` は **clamp 後の実効値**を返す

これにより例外を負うのは `auditQuery.ts` の2関数だけに閉じる。

### target 構造：子テーブル `AuditLogTarget`

```prisma
model AuditLog {
  // 既存の列は一切変更しない
  targets AuditLogTarget[]
}

model AuditLogTarget {
  id          String   @id @default(uuid())
  auditLogId  String
  auditLog    AuditLog @relation(fields: [auditLogId], references: [id], onDelete: Cascade)
  targetType  String   // "Student" | "CropRegion" | ...
  targetId    String   // 対象の uuid（対象側への FK は張らない）
  targetLabel String?  // 表示用スナップショット

  @@index([targetType, targetId])
  @@index([auditLogId])
}
```

- **FK は張る**（`auditLogId` のみ）。他テーブルと揃える。対象側（`targetId`）には張らない
  （対象が削除されてもログは残る必要があるため。`AuditLog` が対象への FK を持たないのと同じ思想）
- **`targetStudentId` は `Student.id` に統一**する（`ExamStudent.id` ではない）。
  理由: ①`scopeId = examId` が既にあるので ExamStudentId は情報が冗長
  ②成績・資料は ExamStudent を持たないので軸が揃わない
  ③ExamStudent は削除されると studentId を復元できず、後から移行できない
- #962（採点層を ExamStudent キーへ）と矛盾しない。あれは「データの所属」の話、
  こちらは「参照」。監査ログが FK を張らないのと同じ層の判断

### 削除耐性の原則

> **監査ログの ID 参照は、対になる表示ラベルのスナップショットを持つ。**
> 参照先は削除されうるが、監査ログは残り続けるため。
> 新しい ID 参照を足すときは、必ずラベルもセットで足す。

`scopeId`/`scopeLabel` が既にこの形。`AuditLogTarget` も `targetLabel` を持つ。

**例外は `userId`**（現在は `User.name` を都度解決）。ユーザー削除機能が存在せず、
User が存在するうちに migration すれば過去ログを埋められるため、今は不要。
→ **ユーザー削除機能を実装するなら、その前に `actorLabel` を足すこと**。
順序を逆にすると、削除された時点でその人の名前が永久に失われる。

### フィルタ UI：構文 + 補完（chips）

```
>>> stuI
    student: 生徒                      [tab で補完]

>>> [student:[鈴木I]]
    生徒: 鈴木太郎                     [tab で補完]

>>> [student:[鈴木太郎]] [is:[削除]]  sincI
```

- **確定トークンは chip、未確定は素の `<input>`**（`contenteditable` も CodeMirror も不要）。
  `react-select` のマルチ選択と同じ構造
- **画面内の状態は「構造」**。文字列になるのは URL 境界とリンク生成のときだけ
  → 任意テキストをパースする場面がないので **`liqe` などのパーサライブラリは不要**。
  parse/build は自作50行 + **往復一致テスト**
- IME 対応は既存パターンを踏襲（`EditableTable.tsx:53` の `e.nativeEvent.isComposing` 早期リターン）
- 補完リストは shadcn の Command（cmdk）を追加して使う（現在未導入）
- **フィールド定義はデータ駆動の1箇所**（キーワード・列・候補ソース・依存関係）。
  次元追加はここに1行 → スキーマ変更への耐性がこの方式の採用理由

#### 補完の依存関係は双方向

| `exam:` の状態 | `cropRegion:` の挙動                                  |
| -------------- | ----------------------------------------------------- |
| 確定済み       | その試験内に候補を**絞る**                            |
| 未確定         | 横断検索し、選択時に **`exam:` トークンを自動で補う** |

1つの候補が複数トークンを生成できる（`onSelect(candidate) → Token[]`）。
候補数の上限は設けずスクロール（1,087件は問題なし。1万件超で仮想スクロールを検討）。

#### 候補の出どころは AuditLog 自身

`SELECT DISTINCT targetType, targetId, targetLabel FROM AuditLogTarget`

**削除済みの対象も候補に出る**。`CropRegion` テーブルから取ると削除済みが出ず、
「削除ログをラベルで探す→ID を得る→その ID で全ログを引く」という再帰検索が必要になる。
Prisma の `distinct` は SQLite ではアプリ側処理（全行フェッチ）なので **raw SQL の `SELECT DISTINCT`** を使う。

### フィルタ次元

| 次元                       | 根拠                                                                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 対象（scopeId）            | 作業領域が複数あるという構造上の必然。#1102 の本体                                                                                                    |
| 操作種別（verb）           | 「誰が何を削除したか」が主目的。**DB に verb 列はないので renderer で action 集合に展開**して `actions: string[]` で渡す（main に導出を持ち込まない） |
| 期間                       | 保持730日という自前の設定の帰結（Discord は45日なので本家にない）                                                                                     |
| 生徒 / 領域                | 個別表示からの横断。`AuditLogTarget` 経由                                                                                                             |
| カテゴリ・実行者・全文検索 | 実装済み                                                                                                                                              |

**カテゴリはスコープ内では無効**（同一試験のログはほぼ全部 `category: "exam"`）。

### 全文検索

`summary` の `contains` のまま変更しない。`scopeLabel` や `metadata` は対象に足さない
（対象は Select で選べる／`changes` の値まで引っかかって精度が落ちる）。

**`{target}` を持たないアクションに `{target}` を足すと、検索が自動的に強くなる**
（`summary` にラベルが載るので「1-(1)」「山田 太郎」で引ける）。FTS5 は不採用。

### 保持期間

**730日 → 365日**。730の根拠はコードに書かれていない。
365日で **約145MB**（内訳: AuditLog 85MB + AuditLogTarget 59MB、index がデータとほぼ同量）。

- **変更は今のうちに行う**。監査ログの導入は 2026-06-14 で、プルーニングは一度も発動していない。
  今変えれば失われるデータはゼロ。1年後に変えるとその瞬間に1年分が消える
- **設定画面を作り、LWW で全端末同期**する（端末ごとに値がずれると収束しない）。
  短縮時は「次回起動時に古いログが削除され、復元できない」旨の警告を出す
- **保持期間の変更操作自体を `system` カテゴリで記録する**
  （記録しないと「なぜ去年の記録がないのか」を追えない）

### 容量見積もり（生徒180・試験10・40問・教員30・採点1.5回/セル・注釈0.1回/セル）

```
採点セル  180 × 10 × 40 = 72,000/年
ログ      採点 108,000 + 注釈 7,200 + その他 ~10,000 = 約125,000/年
target    (108,000 + 7,200) × 2 + 約10,000 = 約240,000行/年
容量      AuditLog 85MB + AuditLogTarget 59MB = 約145MB/年
```

保持期間別: 730日 290MB / **365日 145MB** / 180日 72MB / 90日 36MB。

**coalesce による削減は期待できない**。採点のキーボード連続入力は毎回違うセル＝違うキーなので
集約されない。集約が効くのは「同じ対象を5分以内に何度もいじる」場合のみ
（実績: `exam.export_settings.update` は191操作→7行に27倍圧縮）。
→ **連続的にいじる UI（スライダー・ドラッグ・表の連続入力）を計装するときは `coalesceKey` 必須**。
未計装の `exam.region_info.update` / `grade.manual_score.update` が該当する。

### リンク（双方向）

- **ログ → 対象**: 遷移先は `category` では決められない（`coursework.*` が `category: "grade"` に分類されている）。
  **action の接頭辞**で判定する。削除済み対象の存在確認はしない（N+1 になる。404 は許容）
- **対象 → 絞り込み済みログ**: 各詳細ページの見出し右のドロップダウンに「操作履歴」を1項目追加
  - 試験 `ExamHeader.tsx:98` / 成績 `grades/[gradeId]/page.tsx:303`
  - 資料 `CourseworkDetail.tsx:198` / 解答用紙 `AnswerSheetDefinitionDetail.tsx:153`付近（ドロップダウン未設置）
  - `GuardedLink` を使う

### 表示名

**UI 表示は「操作履歴」**に変える。コード識別子（`AuditLog` / `audit:*` / `auditQuery.ts`）は据え置き。
日本語の「監査」は Discord 日本語版の訳語の流用で、会計監査・業務監査の重さを連想させる。

## 却下した選択肢（再検討を防ぐための記録）

| 選択肢                                      | 却下理由                                                                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| target を JSON KV + 式インデックス          | 性能は同等（0ms）だが、**Prisma で書けず raw SQL 必須**・`prisma db push` で作るテスト DB に式インデックスが入らず本番と乖離・#913（JSON 排除）と逆行                           |
| `targetType`/`targetId` の汎用ペアを列で1組 | 採点ログの「生徒 × 領域」が表現できない                                                                                                                                         |
| 対象ごとの専用列（`targetCropRegionId` 等） | target の type が11種類あるので破綻。当初 `targetItemType`/`targetItemId` を提案したが `item` は規約が名指しで禁じる濁り名（濁った名前は濁った型名の影 → 抽象自体が曖昧だった） |
| Select を5〜8個並べる                       | **スキーマ変更のたびに5〜6箇所触る**。構文+補完なら定義1行。本製品は「高頻度スキーマ変更対応」が設計制約                                                                        |
| `liqe` などのパーサライブラリ               | chips UI では任意テキストをパースする場面がない。`liqe` は現役（2026-06更新）なので、次元が10を超えて Select が破綻したときの選択肢としては有効                                 |
| トークン検索を主入口にする                  | 教員は構文を打たない。構文は**フィルタ状態の表現形式**として価値がある（リンクが組み立てる）                                                                                    |
| 全文検索の FTS5 化                          | 423ms を縮める以上の価値がなく、同期対象テーブルが増える                                                                                                                        |
| 監査ログのアーカイブ収録                    | 他校の教員の操作履歴が混ざる。年145MB を持ち回るのも無駄。現状も含まれていない                                                                                                  |
| 改竄耐性・権限分離                          | 別次元の投資。狙うのは協調作業の追跡であって制度的証跡ではない                                                                                                                  |

## 既存の問題（この作業で直すもの）

1. **`idChangeExecutor` が AuditLog を更新していない** → `changeStudentId` で `scopeId`/`entityId` が
   今すでに dangling になっている。UI が `entityId` を使っていないので顕在化していないだけ。
   target を使い始めると「表示は正常なのに横断だけ静かに欠ける」という最悪の壊れ方をする。
   `updateMany` を足す（テストは `__tests__/import-export/integration/idChangeExecutor.test.ts`）
2. **カテゴリに真実が2つある** → DB の `category` 列と `getAuditActionDef(row.action).category` が
   食い違いうる（`auditQuery.ts:138` が後者で上書きしている）。行をそのまま返せば自動的に解消する
3. **`metadata.target` を表示していない** → 7,435件（43%）が既にラベルを持つのに
   `AuditLogItem` が `changes` しか読まない。**UI 数行で過去ログも遡って改善する**
4. **無駄なクエリ** → `questionScore.ts:66` の `resolveExamStudentLabel` は、
   呼び出し側（同ファイル312-317行）の `include` で既に取れている値を再取得している。最頻8,169回で毎回1クエリ
5. **`ExamHeader.tsx:102` のリンク切れ** → `/exams/${exam.id}/score` というルートは存在しない（別 issue）
6. **未計装9件** → `exam.region_info.update` / `exam.question_group.*` / `exam.marking_format.update` /
   `exam.subtotal_assignment.update` / `grade.manual_score.update` / `user.delete` /
   `system.migration.cleanup_orphaned_scores`（最後はmigration SQL用で未使用が正常）
7. **student/classroom 系が `scopeId` を記録していない** → スコープ絞り込みから漏れる
8. **1打鍵＝1行になっている経路がある**（R6 で見つけた） → 03-region-info の領域情報は
   打鍵ごとに `updateCropRegion` を呼び、`updateCropRegion` は必ず監査行を残す。IME で
   1語を確定すると `exam.region.update` が10行以上並ぶ。**書き込みを遅らせるのは
   [規約](./coding-style.md)に反する**（1回の入力で値が確定するなら即時に書く）ので、
   まとめるならこちら側——同じ実体の同じ列への連続した更新を1行に畳む——になる。
   OWNER 判断: 2026-08-19 に「このまま」（規約を曲げない。監査ログ側の枠で扱う）

## 同期（sqlite-nas-sync）の確認結果

- 書き込みは**すべて `localDb`**。リモートは `readChangelog` / `getRemoteTombstone` と読むだけ。
  30人が同時採点しても NAS への書き込みロックは発生しない
- 同期は changelog ベースで、**適用は1トランザクション**（`sync.ts:786`）。
  親子が割れることはない。フルマージ時も揃って復活する
- `deleteProtected` は削除エントリを `continue` でスキップするだけ（`sync.ts:377` / `:543`）。
  0.16.0 以降は**利用者操作による削除だけ**が対象で、ユニーク制約が強制する「畳み」は
  素通しになる（`AuditLog` は `id` 以外の unique を持たないので畳まれることはない）
- ~~**ライブラリは外部キーを一切考慮していない**（`grep foreign_key` → 0件）。
  changelog の適用順序が子→親になると FK 違反でトランザクションごとロールバックし同期が失敗する~~
  → **0.16.0 で解決済み**（段階35 で依存を上げた）。`pullNormal` / `pullFullMerge` が
  取り込みのトランザクションの頭で `PRAGMA defer_foreign_keys = ON` を張り、検査を
  COMMIT まで遅らせる（`~/dev/sqlite-nas-sync/src/sync.ts:794` / `:882`）。
  制約を切るのではないので、COMMIT 時に矛盾が残っていれば従来どおり失敗する

## PR 分割

| PR  | 内容                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 独立ページ化（`/audit-logs`）＋ ページネーション（20/50/100）＋ 保持期間設定（LWW同期）＋ 表示名「操作履歴」＋ **`metadata.target` の表示**（既存データに遡って効く） |
| 2   | `AuditLogTarget` 追加 ＋ ラベル記録 ＋ `idChangeExecutor` 追随 ＋ 無駄クエリ削除 ＋ main→renderer の導出移送（カテゴリ二重真実の解消）                                |
| 3   | フィルタ（構文 + 補完 UI + フィールド定義）                                                                                                                           |
| 4   | 双方向リンク                                                                                                                                                          |
| 5   | 未計装9件 ＋ student/classroom の `scopeId` 記録                                                                                                                      |

PR-2 を PR-3 より前に置くのは、**対象ラベルがないとフィルタを作っても
「読んでも意味が取れない行」に着地する**ため。データで `{target}` を持たないアクションが
110中52あり、しかも件数が多い日常操作（採点・答案・領域）がそこに集中している。
上位3アクション（`exam.score.propose` / `exam.region.update` / `answer_sheet.update`）で
全体の79%を占めるので、労力の大半は最初の数個で回収できる。

## 実装時の注意

- 新テーブル追加で `__tests__/migration/normalizeDatetime.test.ts:198` の
  `POST_MIGRATION_TABLES` に `AuditLogTarget` の追記が必要（既知の現象）
- 新 migration は `MIGRATION_CHECKSUMS` に**足さない**（足すと replay されず DB に反映されない）
- 過去ログのバックフィルは82%可能:
  `entityType='CropRegion'` は `entityId` がそのまま（5,155件中5,152件が生存）、
  `entityType='QuestionScore'` は join で `cropRegionId` と `examStudentId→studentId` の両方が取れる（8,922件すべて生存）
- `idChangeExecutor.ts` は他セッションが編集中の可能性がある（着手前に `git status` を確認）
