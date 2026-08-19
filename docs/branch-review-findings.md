# 全差分レビュー（R7＋R8）で出た指摘

[ipc-and-data-fetching-plan.md](./ipc-and-data-fetching-plan.md) の **R7（段階17・ASB の締め）**
と **R8（段階18）** を1回のレビューでまとめて回した結果。**対象は段階17〜18 の差分ではなく
`main...HEAD` の全差分**（114コミット・715ファイル・約93,000行）で、この計画で入れた作り
（エンベロープ撤去・`window.electronAPI` を `src/queries` へ・取得を `useQuery` へ・楽観更新の
撤去・設定JSONの行化・ASB の1レコードずつの書き込み）を通して見ている。

**型検査と 1,459件のテストは全て緑。** ここに並ぶのはすべて**振る舞いの誤り**で、いまの
検査では出ない。

## この文書の使い方

1件ずつ「直すのか・直す向きが正しいのか」を決めるための作業表である。決めたら **状態**の
欄を埋め、直したらその旨と根拠（どの検査で固定したか）を書き足す。

**確度の欄は2つある。**

| 確度       | 意味                                                                             |
| ---------- | -------------------------------------------------------------------------------- |
| **確認済** | 私がソースを読んで機構を確かめた。再現の筋も追える                               |
| **未確認** | レビューの報告のまま。**機構を自分で確かめていない**（宿題であって事実ではない） |

## 一覧

| #   | 重さ | 場所                                    | 何が起きるか                                         | 確度   | 状態   |
| --- | ---- | --------------------------------------- | ---------------------------------------------------- | ------ | ------ |
| 1   | 致命 | `useAnswerSheetDefinition.ts:1045`      | 小問の一部更新が原稿用紙の設定を毎回消す             | 確認済 | 未検討 |
| 2   | 致命 | `useAutoCreateQuestionScore.ts:75`      | 設問を表示しただけで採点が未採点へ戻る               | 確認済 | 未検討 |
| 3   | 高   | `DataSourcesContainer.tsx:190`          | 欠測の一括設定が常に失敗する                         | 確認済 | 未検討 |
| 4   | 高   | `AnnotationBrowserPanel.tsx:188`        | 注釈の付け替えが採点を未採点へ戻す                   | 未確認 | 未検討 |
| 5   | 高   | `queryClient.ts:20`                     | ネットワークが無い端末で全ての取得と書き込みが止まる | 確認済 | 未検討 |
| 6   | 高   | `ScreenBlackout.tsx:176`                | 起動直後の目隠しが解除できなくなる                   | 未確認 | 未検討 |
| 7   | 高   | `useScoredAnswerPdfExport.ts:229`       | 1ページの失敗で書き出しが永久に止まる                | 未確認 | 未検討 |
| 8   | 高   | `answerSheetBuilderHandlers.ts:556`     | 文字位置マーカーを持つ解答用紙を複製できない         | 未確認 | 未検討 |
| 9   | 中   | `AnswerSheetBuilderMainView.tsx:106`    | 同時に出た編集の失敗通知が届かない                   | 未確認 | 未検討 |
| 10  | 中   | `asbDefinitionTag.ts:38`                | タグ付けだけが担当の確認を素通りする                 | 未確認 | 未検討 |
| 11  | 中   | `scoring.ts:59`                         | 採点領域を動かしても白さの測定が古いまま             | 未確認 | 未検討 |
| 12  | 中   | `export/exam-archive/index.ts:57`       | 画像が欠けた書き出しを成功と報告する                 | 未確認 | 未検討 |
| 13  | 中   | `DeleteConfirmationModal.tsx:65`        | 採点済みの答案を「採点なし」と告げて消せる           | 未確認 | 未検討 |
| 14  | 中   | `SubtotalGroupModal.tsx:268`            | タグ付けの失敗で同名の小計グループが二重にできる     | 未確認 | 未検討 |
| 15  | 中   | `classrooms/[classroomId]/page.tsx:160` | 学級の削除が失敗しても一覧へ遷移する                 | 未確認 | 未検討 |

**この枝で入れた回帰**は 1・3・14・15。**8 は元からある**が、書き直した塊の中に残っている。
2・4・5・9〜13 はこの枝の作り替え（楽観更新の撤去・キャッシュ化・取得の集約）で**踏みやすく
なった**もので、素の原因は前からある。

---

## 1. 小問の一部更新が原稿用紙の設定を毎回消す（致命・確認済・この枝の回帰）

**場所**: `src/components/answer-sheet-builder/hooks/useAnswerSheetDefinition.ts:1045`

```ts
attributes: {
  ...current,
  ...data,
  manuscriptPaper: data.manuscriptPaper && { … },   // ← 常に置かれる
}
```

`data.manuscriptPaper` が無いときこの式は `undefined` になり、**`...current` で入れた
原稿用紙の設定を上書きして消す**。reducer（:560）も同じ `&&` を通すので画面からも消え、
`asbSubQuestionColumns`（`electron-src/lib/prisma/asbSubQuestion.ts:40-46`）が
`manuscriptEnabled:false / columns:20 / rows:10` を書く。

**再現**: 原稿用紙を 25×15 で有効にした小問のラベルを1文字打つ → 原稿用紙が切れて既定へ
戻る。文字位置マーカーは状態から落ちるので、後から undo しても戻らない。

**なぜ検査で出なかったか**: `editorActions.test.ts` は「原稿用紙の列数を変えても文字位置
マーカーが残る」方向しか見ていない。**原稿用紙と無関係な更新**を通していない。

**直す向き**: `data.manuscriptPaper` があるときだけキーを置く（無ければ `current` のまま）。
検査は「ラベルだけを変えても原稿用紙が残る」を足す。

## 2. 設問を表示しただけで採点が未採点へ戻る（致命・確認済）

**場所**: `src/components/exams/07-score-at-once/ScoringIndividual/hooks/view/useAutoCreateQuestionScore.ts:75`

`create-question-score` は名前に反して **set**（無ければ作る・**有れば `status` と
`partialScore` を上書きする**）である（`electron-src/lib/prisma/questionScore.ts:163-182`）。
`QuestionScore` には (examStudentId, cropRegionId, userId) の unique 制約が無く
（`schema.prisma:302`。あるのは `@@index([examStudentId])` だけ）、`upsert()` が使えないため
`findFirst` ＋ 分岐を手書きしている。**「1採点者・1セル・1行」はこの関数だけが守っている。**

呼ぶ側は2つあり、欲しいものが違う。

| 呼ぶ側                       | 意図                             | set で困るか                 |
| ---------------------------- | -------------------------------- | ---------------------------- |
| `useBatchScoring`            | 「この答案を正解にする」         | 困らない（上書きが正しい）   |
| `useAutoCreateQuestionScore` | 「行が無いなら空の行を用意する」 | **困る**（触ってほしくない） |

後者は **effect から、設問を表示しただけで**出る（:105）。利用者は何も採点していない。
関門は `currentQuestionScoreId === null` で、これは段階13 以降**キャッシュ（採点領域の木）**
を見ている（:50）。採点の直後は取り直しが着地するまで `null` のままなので、

1. 採点の書き込み（正解）
2. 表示だけで出る自動作成（未採点）← 共有 `scope` で 1 の後ろに直列化される

の順に届き、入れたばかりの点数が消える。**エラーもトーストも出ない。**

### 分かったこと: 行の不在は、既に未採点として読まれている

| どこ                                                      | 行が無いときの扱い                        |
| --------------------------------------------------------- | ----------------------------------------- |
| 採点画面 `07-score-at-once/types.ts:172`                  | `getScoringStatus` が `"unscored"` を返す |
| Excel 出力 `export/excel/dataFetcher.ts:277`              | `scoreRecord?.status \|\| "unscored"`     |
| 個人成績表 `individual-report/statisticsCalculator.ts:38` | 不在は未採点と同じく母数から外れる        |
| 平均行 `export/excel/averageRows.ts:44`                   | 同上                                      |

**つまり未採点の行を作っても何も足さない。** 実体として持たねばならない理由はいま1つだけで、
`DrawingAnnotation.questionScoreId` が必須のFK（`schema.prisma:350`）であり、renderer 側も
注釈の取得・保存をすべて `questionScoreId` で引いていること。

**直す向き（2段に分けられる）**

- **小さい方**: main の口を2つに割る。`setQuestionScore`（採点する。いまの中身。名前を実態へ）
  と `ensureQuestionScore`（無ければ作る・**有れば何も書かずにその行を返す**）。呼ぶ側は #2 と
  #4 の2箇所を後者へ替える。キャッシュ頼みの関門が外れても採点は壊れない
- **大きい方**: 表示での作成そのものをやめ、**注釈を書くときに main が採点行を用意する**。
  renderer が `questionScoreId` を先に必要とする作りを解く必要があるので別作業
- **どちらにせよ**: `status:"unscored"` を書いてよいのは、利用者が明示的に「未採点に戻す」を
  選んだときだけにする

## 3. 欠測の一括設定が常に失敗する（高・確認済・この枝の回帰）

**場所**: `src/components/grades/03-data-sources/DataSourcesContainer.tsx:190`

呼ぶ側は `{ id, data: {…} }[]` を渡すが、`batchUpdateDataSourceEstimationMutation`
（`src/queries/grade.ts:409`）は**平坦なフィールド**を宣言していて
`updates.map(({ id, ...data }) => updateDataSource(id, data))` とするので、`{ data: {…} }` が
そのまま `prisma.gradeDataSource.update({ data })` へ渡り `Unknown argument 'data'` で落ちる。

削除した `useDataSources` フックが `{id, data}` を取っていた名残。**`tsc` では出ない** —
`updates` が変数なので余剰プロパティ検査が働かず、対象のフィールドは全て optional。

**直す向き**: 呼ぶ側を平坦にする。あわせて `queries` 側の型を「余剰プロパティが弾かれる」
形（引数に直接リテラルを書く／`satisfies`）で受けられないかを見る。

## 4. 注釈の付け替えが採点を未採点へ戻す（高・未確認）

**場所**: `src/components/exams/07-score-at-once/ScoringSidePanel/AnnotationBrowserPanel.tsx:188`

#2 と同じ口の2つ目の入口。`ensureQuestionScore`（名前だけ。中身は `createQuestionScore`）が
キャッシュに無ければ `status:"unscored"` で呼ぶ。採点した直後に保存済みの注釈をその答案へ
ドラッグすると、注釈は付くのに採点が戻る。**#2 を main 側で直せば一緒に塞がる。**

## 5. ネットワークが無い端末で全ての取得と書き込みが止まる（高・確認済）

**場所**: `src/queries/queryClient.ts:20`

`networkMode` を指定していないので既定の `"online"` になり、`canFetch`
（`@tanstack/query-core/src/retryer.ts:54`）が `onlineManager.isOnline()` で**全クエリ・全
ミューテーション**を止める。データはローカルSQLite で、`onlineManager.setOnline` を呼ぶ箇所は
アプリ内に無い。

Wi-Fi を切った端末では `navigator.onLine` が false になり、すべての `useQuery` が
`fetchStatus:"paused"` のまま「読み込み中」で止まり、書き込みも走らないので採点が保存され
ない。**ローカルインストール＋個人利用は想定内の使い方**（`project_collaborative_scoring_constraints`）。

**直す向き**: `networkMode: "always"` を既定に置く。理由（IPC はネットワークを跨がない）を
コメントに残す。

## 6. 起動直後の目隠しが解除できなくなる（高・未確認）

**場所**: `src/components/common/ScreenBlackout.tsx:176`

`blackoutNow` は発火時の `hasDigitPasscode` で施錠の有無を決めるが、解除側は後から読み直す。
`ScreenBlackout` は `AuthGate` の外（root layout の `AppShell`）にあり、利用者一覧が届く前は
`hasDigitPasscode` が false。Ctrl/Cmd+L の受け口（:158）に準備完了の関門が無い。

暗証番号を設定した教員がその窓で Cmd+L を押すと `isBlackout` だけが立ち、後から true へ
変わると `handleActivity` は解除せず、overlay の `onClick`（:297）もどちらの枝にも当たらず、
暗証番号の入力受付（:255）は `isLocked` 依存で張られない。**再読み込み以外に出口が無い。**

## 7. 1ページの失敗で書き出しが永久に止まる（高・未確認）

**場所**: `src/components/exams/08-export/hooks/useScoredAnswerPdfExport.ts:229`

`handlePageComplete` が `addPageToStreamingSession` の失敗を `console.error` に握り潰し、
カウンタも進めないので `if (embeddedPagesCount < totalPagesCount) return` の関門が永久に
開かない。モーダルが「41/42」で固まり、main 側の pdf-lib セッションとページのバッファが
残り続ける。`setIsExporting(false)` は `finalizePdf` の `finally` にしかないので `isExporting`
が true のままになり、**以後どの書き出しも `runValidatedExport` が黙って return する。**

## 8. 文字位置マーカーを持つ解答用紙を複製できない（高・未確認・元からある）

**場所**: `electron-src/ipc-handlers/answerSheetBuilderHandlers.ts:556`

複製は定義・ヘッダー項目・設問・テキスト/画像要素の id を振り直すが、
`subQuestion.manuscriptPaper.charGuides` を振り直さない。`...subQuestion` が元の
`AsbCharGuide.id` を引き継ぎ、`writeAsbCharGuides` が同じ主キーで作成して衝突する。

トランザクションは巻き戻るが、画像ディレクトリの作成とコピーは先に走る（:528, :544）ので
**孤児のディレクトリが残る**。OMR は同種の問題を直してある（`asbOmrConfig.ts:34` が新しい
uuid を振る）。

## 9. 同時に出た編集の失敗通知が届かない（中・未確認・この枝で入れた作り）

**場所**: `src/components/answer-sheet-builder/AnswerSheetBuilderMainView.tsx:106`

1つの `useMutation` 観測子へ呼び出しごとのコールバックを渡している。
`MutationObserver.mutate` は `#mutateOptions` を上書きして前の mutation を切り離すので、
**解決前に次の `mutate` が来ると先の `onError`/`onSuccess` が発火しない**。

これは稀な重なりではない — `updateSubQuestion` は隣の設定を降ろす分と本体の分を同じ tick で
2本出し、`useAsbWriteGate.flush` は溜めた分をまとめて出す。先が失敗して後が成功すると、
立て直しの取り直しが走らないまま「保存されました」と出る。最後の1本が失敗すると
「保存しています...」で固まる。

**直す向き**: 失敗時の立て直しを `mutate` の第2引数ではなく宣言側（`defineMutation` の
`onError`）か、書き込みごとの観測子で受ける。どちらが規約に合うかは要検討。

## 10. タグ付けだけが担当の確認を素通りする（中・未確認）

**場所**: `electron-src/lib/prisma/asbDefinitionTag.ts:38`（`createAsbDefinitionTag` :22 も）

ASB の書き込みで唯一 `writeAsbDefinitionContent` を通らず、**担当の確認**
（`assertAsbDefinitionEditableBy`）も**親の更新日時の繰り上げ**もしない。

`listAsbDefinitions` が `where: { userId }` を落として全員の解答用紙を出すようにしたので、
担当でない教員が一覧から他人の解答用紙へ一括タグ付けできてしまう（他の編集は全て弾かれる）。
一覧の更新日時・並べ替え・期間の絞り込みも古いまま残る。

## 11. 採点領域を動かしても白さの測定が古いまま（中・未確認）

**場所**: `src/queries/scoring.ts:59`

`answerWhitenessQuery` の鍵は `["answerWhiteness", examPageId, answerImagesSignature]` だが、
取得には領域の id と x/y/width/height も使う（`useAnswerWhiteness.ts:71-94`）。署名は答案画像
しか見ておらず、鍵は `scopeKeys.exam(examId)` の外なのでどの書き込みでも無効化されない。

教員Bが 02 で解答欄を動かす／足すと、教員Aの領域は取り直されるが鍵は同一で stale でもない
ため、**古い矩形で測った白さが使われ続ける**。白さ順の並びが狂い、足された領域は map に
無いので黙って落ちる。

## 12. 画像が欠けた書き出しを成功と報告する（中・未確認）

**場所**: `electron-src/lib/export/exam-archive/index.ts:57`

`createArchive` が返す `missingFiles`（`archiveCreator.ts:209/222` で埋まる）を、
`exportExamTo` も `exportExam` も捨てている。`data/` の一部が外れた共有フォルダで書き出すと、
欠けた画像は記録されるのに ZIP は欠けたまま作られ、監査ログも成功として残り、画面は無条件に
成功を告げる。受け取った同僚は答案画像の無い試験を、警告なしで取り込む。

## 13. 採点済みの答案を「採点なし」と告げて消せる（中・未確認）

**場所**: `src/components/exams/06-student-answers/student-answer-table/components/DeleteConfirmationModal.tsx:65`

`studentAnswerScoreSummaryQuery` の鍵は `["studentAnswerImage", id, "scoreSummary"]` で
`scopeKeys.exam(examId)` の外にあり、07 で採点しても stale にならない。本体は開いている間しか
mount されないので、`gcTime`（5分）内に開き直すとキャッシュがそのまま出て `isPending:false`
になり、関門（:141）は `disabled={isLoadingSummary}` なので通る。

削除ダイアログで「採点データなし」を見て閉じ、07 で採点し、開き直すと再び「採点データなし」と
出て確定でき、いま入れた QuestionScore / ScoreDecision / DrawingAnnotation がカスケードで消える。
撤去した `useEffect` は毎回取り直してボタンを止めていた。

## 14. タグ付けの失敗で同名の小計グループが二重にできる（中・未確認・この枝の回帰）

**場所**: `src/components/subtotal-groups/components/SubtotalGroupModal.tsx:268`

作成とタグ紐付けが同じ `try` に入っているのに `editingGroup` は `null` のままなので、タグ側で
失敗した後にもう一度保存を押すと**作成の枝をもう一度通る**。`findOrCreateTag` が `Tag.name` の
競合で失敗すると、同名のグループがもう1つでき、最初の1つはタグの付かないまま残る。

main ではタグの書き込みが内側の `try` に分かれていて、モーダルは成否に関わらず閉じていた。

## 15. 学級の削除が失敗しても一覧へ遷移する（中・未確認・この枝の回帰）

**場所**: `src/app/(app)/classrooms/[classroomId]/page.tsx:160`

`await` している `handleDeleteClassroom`（:138）が async でなく `mutate` を投げっぱなしにする
ため、成否に関わらず即座に `router.push("/classrooms")` が走る。外部キーや権限で失敗しても
一覧へ移動し、消えていない学級が並ぶ。

同じ塊で一括削除の `try/catch`（:132）も外れており、1件の `mutateAsync` の失敗が未処理の
rejection になって残りの id が黙って飛ばされる。

---

## 重さの低いもの（一覧のみ）

レビューが挙げたが上位を押しのけるほどではないと判断されたもの。**中身は未確認。**

- `DisplaySettingsTab` / `ScreenControlTab`: 投げっぱなしの書き込みの前に成功トーストを出す
- `ScreenControlTab`: 数値入力にデバウンスが無く、編集途中の `1` が保存されうる
- 境界・評価記号の削除後に `order` が詰まらない
- `useScoredAnswerPreview` のプレビューが古いまま
- `useDataFileExports` が黙って何もしない経路を持つ
- `archiveCreator` の archiver `warning` ハンドラが投げっぱなしの `throw` をする
- `useBatchScoring` の `double_mark` の枝が死んでおり、Wマークのボタンとショートカットが効かない

---

## 関連

| 文書                                                             | 関係                                                  |
| ---------------------------------------------------------------- | ----------------------------------------------------- |
| [ipc-and-data-fetching-plan.md](./ipc-and-data-fetching-plan.md) | R7・R8 の枠。段階17・18 の内容                        |
| [asb-ipc-split-plan.md](./asb-ipc-split-plan.md)                 | #1・#8・#9・#10 が触る ASB の分割                     |
| [coding-style.md](./coding-style.md)                             | #3・#9 は「書き込みは `defineMutation` を通す」の周辺 |
