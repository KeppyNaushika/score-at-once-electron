# 競合で負けた行に子がいると、その子が消え、同期も止まる

[ipc-and-data-fetching-plan.md](./ipc-and-data-fetching-plan.md) の**段階20**の裏付け。
2026-08-19 に `~/dev/sqlite-nas-sync` を**読んで、走らせて**確かめた。

発端は「`@unique` は同期の規約違反ではないか」という問い（[asb-ipc-split-plan.md](./asb-ipc-split-plan.md)
§8.5 で原稿用紙をテーブルへ出すとき）で、**答えは「`@unique` 自体は問題ない。問題は
負けた行に子がいるとき」**だった。

**この文書の主張はすべて実測に基づく。** 検証は `~/dev/sqlite-nas-sync/__tests__/` に一時
テストを置いて行い、確認後に削除した（再現手順は §5）。

## 1. まず、規約の実際の中身

「id 以外の unique は同期違反」と縮めて覚えていたが、スキーマの註釈が言っているのは
別のことである（`schema.prisma:210`, `283`, `895`）。

> 2端末が同じ(設問, 担当者)ペアを割り当てるとid違い・`@@unique`同値の行ができるが、
> これは sqlite-nas-sync が解決する。**書き込みは必ず `@@unique` を鍵に upsert すること
> （idは同定に使わない）。**

つまり規約は3つに分かれる。

| 規約                                           | 中身                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| **同定は id でする**                           | unique キーを id 代わりに使わない。行の中身が動くと同定が壊れる    |
| **序数を unique にしない**                     | `pageNumber` のような並び順は行の間で動くので鍵にできない          |
| **unique 同値の衝突は LWW が畳む**（条件付き） | `conflict.ts` の `applyInsert` ケース2。**ただし §3 の条件が付く** |

**`@unique` を張ること自体は禁止されていない。** 実際いまのスキーマは単一列 `@unique` を
12本、複合 `@@unique` を約40本持っている。

## 2. LWW が畳む機構（ソースで確認）

`conflict.ts:207` の `applyInsert` ケース2。

1. リモートの INSERT を試す → セカンダリ UNIQUE 違反
2. エラーメッセージから違反した列を取り出し、ローカルの競合行を引く
3. `updatedAt` を比べる
   - **リモートが新しい** → ローカルの敗者行を `DELETE` し、リモート行を `INSERT`。
     DELETE トリガーが発火するので、敗者の削除は changelog / tombstone 経由で全端末へ
     伝わり、全体が勝者へ収束する
   - **ローカルが新しい** → リモート行は採用しない

ここまでは註釈のとおりで、**親1行だけを見るなら正しい**。

## 3. 見落としていた半分 — 子がいるとどうなるか

畳み方が「**負けた行を消す**」なので、負けた行に子がぶら下がっていると巻き添えになる。
帰結は2つあり、**どちらも画面に何も出ない**。

### 3.1 負けた側の子データが消える（本命）

```
端末A:  親 mp-A（sub-1）＋ 子 g-A        ← 古い
端末B:  親 mp-B（sub-1）＋ 子 g-B        ← 新しい

A が B の変更を取り込む:
  INSERT mp-B → セカンダリUNIQUE違反 → リモートが新しい
              → ローカルの mp-A を DELETE   ← カスケードで g-A も消える
              → mp-B を INSERT
  INSERT g-B  → 入る
```

実測（収束後）:

```
[2] 収束後 A 親: [ 'mp-B' ] 子: [ 'g-B->mp-B' ]
[2] 収束後 B 親: [ 'mp-B' ] 子: [ 'g-B->mp-B' ]
```

**`g-A` はどちらの端末にも残っていない。** A では巻き添えで消え、B では §3.2 の理由で
そもそも届かない。**世界から消える。**

`ExamStudent` に当てはめると、**2人の教員が同じ生徒を同じ試験へ加えてそれぞれ採点すると、
片方の採点がどこにも残らない**（`QuestionScore` / `ScoreDecision` / `StudentAnswerImage`
がカスケード対象）。協調採点の中核である。

### 3.2 同期がその相手から永久に止まる

`applyInsert` の1つ外側、`sync.ts:646` を読むと、適用ループは相手1人ぶんが**まとめて1つの
トランザクション**で、失敗すると `catch` が警告を積むだけになる。

```ts
transaction()          // ← この中で1件ずつ applyInsert / applyUpdate
result.clientsSynced++
} catch (err) {
  result.warnings.push(`Sync failed for client ${remote.clientId}: ${err}`)
}
```

**`updateSyncState` もこのトランザクションの中にある。** だから途中で1件でも失敗すると、
その相手ぶんの取り込みが**丸ごと巻き戻り、読んだ位置も進まない**。

そして `better-sqlite3` は **`foreign_keys` を既定で ON にする**（実測: 何も設定せずに
`PRAGMA foreign_keys` が `1`）。ライブラリは `foreign_keys` を一度も触らないので、同期の
適用中も外部キーが効いている。

```
B が A の変更を取り込む:
  INSERT mp-A → ローカル(mp-B)が新しい → local_wins → mp-A は入らない
  INSERT g-A  → 親 mp-A が存在しない → FOREIGN KEY constraint failed
              → 例外 → 巻き戻し → 読んだ位置も戻る
```

**負けた側ではなく、勝った側の端末が詰まる。**

読んだ位置が進まないので、次の同期も**同じエントリから再生して同じ場所で落ちる**。

```
[4] B 取り込み1回目 clientsSynced=0 warnings=[ …FOREIGN KEY constraint failed ]
[4] B 取り込み2回目 clientsSynced=0 warnings=[ …同じ ]
[4] B 取り込み3回目 clientsSynced=0 warnings=[ …同じ ]
[4] B に届いた無関係データ: []
```

最後の行が要点である。衝突のあとで端末A が**まったく無関係なテーブル**へ書いた行も、
端末B へ**一度も届かない**。1回の衝突が、その相手からの以後すべての変更を止める。

**利用者にはエラーが出ない。** `warnings` に積まれるだけで、`performSync` は成功として返る。

## 4. どのテーブルが該当するか

条件は「セカンダリ unique を持ち、かつ子テーブルを持つ」。**10件**ある。

| モデル                  | unique                               | 子（一部）                                            |
| ----------------------- | ------------------------------------ | ----------------------------------------------------- |
| **ExamStudent**         | `[examId, studentId]`                | QuestionScore / ScoreDecision / StudentAnswerImage    |
| **GradeStudent**        | `[gradeId, studentId]`               | GradeOverride / GradeFrozenScore / GradeItemExclusion |
| **CourseworkStudent**   | `[courseworkId, studentId]`          | CourseworkScore                                       |
| **AsbOmrConfig**        | `subQuestionId` / `branchQuestionId` | AsbOmrChoiceOption                                    |
| **CropRegionOmrConfig** | `cropRegionId`                       | CropRegionOmrChoiceOption                             |
| Subtotal                | `[subtotalGroupId, name]`            | CropSubtotal / GradeDataSource                        |
| Tag                     | `name`                               | ExamTag / AsbDefinitionTag ほか                       |
| Student                 | `studentNumber`                      | ExamStudent / GradeStudent ほか                       |
| Classroom               | `name`                               | ExamClassroom / GradeClassroom ほか                   |
| User                    | `username`                           | QuestionScore / AsbDefinition ほか                    |

**上位5件は「独立に作られる」ことが実際に起きる形**である。下位5件（Tag / Student /
Classroom / User）は自然キーが人間の入力なので頻度は低いが、起きれば同じ結果になる。

## 5. 再現手順

`~/dev/sqlite-nas-sync/__tests__/` に一時ファイルを置く（既存の `sync.test.ts` の
`createClientDb` / `makeConfig` に倣う）。

1. 親テーブルに `subQuestionId TEXT UNIQUE`、子テーブルに親への
   `FOREIGN KEY … ON DELETE CASCADE` を張る
2. 端末A に 親＋子、端末B に**同じ unique 値で別 id** の親＋子を入れる
3. A → 同期、B → 同期。`performSync` の戻り値の `warnings` と `clientsSynced` を見る
4. 収束後に**両端末の子を数える**（§3.1 の消失はここで出る）
5. その後 A が無関係なテーブルへ書き、B が3回同期しても届かないことを確認する（§3.2）

**`warnings` を見ないと何も起きていないように見える。** `clientsSynced` が 0 のままなのが
唯一の手掛かりになる。

## 6. 直し方 — 負けた行の子を、勝った行へ引き取る

**負けた行を消す前に、負けた行を指している子を勝った行へ付け替える。**

付け替え先はライブラリが自力で辿れる。SQLite が `PRAGMA foreign_key_list` で「どの表が
この表を指しているか」を答えるので、**スキーマを知らなくてよい**。

これで §3.1 と §3.2 が同時に片付く。詰まらなくなるのは結果であって、目的ではない。

### 6.1 できないこと（境界）

- **負けた行の属性はマージできない。** 列の意味を知らないため、勝った行が総取りする。
  既知の穴として据え置く（`ExamSubtotalGroup` の `selectedForTable` / `selectedForBoxPlot`
  が実例で、過去の移行SQLは重複行をまたいで OR した）
- **付け替えた子が子自身の制約にぶつかる場合**の扱いは未決。同じ LWW をもう一段回すのか、
  別に扱うのか
- **孫は動かさない**（子を指したままでよい）。要確認

### 6.2 併せて必要なこと

- **`warnings` に積むだけの現状を直す。** 同期が止まっていることが画面に出ないのは、この
  不具合の一番悪い部分である
- **他プロジェクトへの影響の周知。** このライブラリは他でも使う

### 6.3 アプリ側で避ける案は採らない（記録）

**「1:1 の表は id を親から決めれば衝突自体が起きない」案は、実測で効くと確認したうえで
採らない**（OWNER 判断・2026-08-19）。

効くこと自体は本当である。両端末が同じ id を作れば衝突はセカンダリ UNIQUE ではなく
**PK 重複**になり、`applyInsert` ケース1（LWW で UPDATE）へ落ちる。行が消えないので子も
無事:

```
[5] B clientsSynced=1 warnings=[ 'Conflict on manuscript_paper:sub-1 resolved as local_wins' ]
[5] A 親: [ 'sub-1(cols=25)' ] 子: [ 'g-A->sub-1', 'g-B->sub-1' ]
[5] B 親: [ 'sub-1(cols=25)' ] 子: [ 'g-A->sub-1', 'g-B->sub-1' ]
```

**それでも採らない理由。**

1. **id の方針が決着している。** 「id は同一性を持たない不透明な uuidv4・同定は
   `@@unique`・競合解決はライブラリ」。2026-08-03 の PR #1150 で導出 id を3系統
   （合成id `${親id}:${区分}` / **親の id の流用** / **uuidv5**）すべて撤去し、既存データも
   `20260803110000_unify_ids_to_uuidv4` で振り直した。`uuidIdCoverage.test.ts` が3つとも
   名指しで禁じている（uuidv5 は sha1 の使用とバージョンビットの立て方で検出する）
2. **方針には、今回の実測が崩していない独立の根拠がある。** 移行SQL の冒頭に曰く——
   「**id が同一性を持つと、削除した id が再作成で復活するなど、行の生死と組み合わせの
   同一性が混線する**」。id を内容から導出すると、消して作り直した行に同じ id が戻る。
   tombstone は id で照合するので、**作り直した行が「もう消したもの」として潰される**
3. **複合キーの5件には親の id を借りられない。** `ExamStudent` などいちばん重い所に効かない

> **一度この案を推したときの誤り**（記録として残す）: 「決定論的 id は既存データに効かない」
> と書いたが、これは**間違い**だった。既存データは端末内では衝突しておらず、端末間の
> id の食い違いは**マイグレーションで揃えられる**（各端末が独立に走らせても計算値なので
> 一致する。実際 `20260803110000` が全テーブルの id を一斉に振り直している）。
> 案が没になった理由は上の 1・2・3 であって、この理由ではない。

## 7. まだ確かめていないこと

- **フルマージ経路**（`hasChangelogGap` 検出時）でも同じ詰まりが起きるか。`sync.ts:726` の
  `catch` は同じ形をしているので起きると見ているが、走らせていない
- 詰まった状態から**回復する手立て**があるか（`_syncState` を手で進める等）
- `applyUpdate` 経由（`conflict.ts:308` がセカンダリ UNIQUE 違反に触れている）でも同じことが
  起きるか
- **複合 `@@unique`（`ExamStudent` の形）では測っていない。** 機構は同じはずだが、
  `parseUniqueConflictColumns` が複数列を正しく取れるかは未確認

## 関連

| 文書                                                             | 関係                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------ |
| [ipc-and-data-fetching-plan.md](./ipc-and-data-fetching-plan.md) | **段階20** がこの修正。R10 が締め                      |
| [asb-ipc-split-plan.md](./asb-ipc-split-plan.md) §8.5            | 発端。原稿用紙は普通の `@default(uuid())` のままにする |
| [branch-review-findings.md](./branch-review-findings.md)         | 別件（枝の全差分レビュー）                             |
