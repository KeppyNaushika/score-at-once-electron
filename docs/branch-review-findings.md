# 全差分レビュー（R7＋R8）で出た指摘 — 裁いた記録

**16件すべて対応済み**（2026-08-20）。本書は**済んだことの記録**である。これからのことは
[remaining-work.md](./remaining-work.md) にある。

[ipc-and-data-fetching-plan.md](./ipc-and-data-fetching-plan.md) の **R7（段階17・ASB の締め）**
と **R8（段階18）** を1回のレビューでまとめて回した結果。**対象は段階17〜18 の差分ではなく
`main...HEAD` の全差分**（114コミット・715ファイル・約93,000行）で、この計画で入れた作り
（エンベロープ撤去・`window.electronAPI` を `src/queries` へ・取得を `useQuery` へ・楽観更新の
撤去・設定JSONの行化・ASB の1レコードずつの書き込み）を通して見ている。

**型検査と 1,459件のテストは全て緑。** ここに並ぶのはすべて**振る舞いの誤り**で、いまの
検査では出ない。

## 実施（2026-08-20）

**16件すべてに手を入れた。** `npm run check-all` は通り、vitest は 1,474件（検査を15件
足した）。判断を仰ぎたい点は §「残した判断」。

**調べたことで分かった副産物**が3つある。

- **#2**: 空行の作り手が**3つ**あった。3つ目 `initializeScoringRecords` は呼び出し元
  ゼロで既に死んでいる（撤去は段階21）
- **#14**: 同じ形が**試験の作成にもあった**（再試行で同じ試験がもう1つできる）。
  併せて直した
- **#16**: 得点化の規則が**2箇所に書かれていて、旧データの扱いだけ食い違っていた**
  （`calculateEffectiveScoreValue` は `final` を0点、`calculateActualScore` は部分点）。
  前者を後者へ委ねて1つにした

## 残した判断

| 件               | いまどうなっているか                                                                                                                                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **#12**          | 決定は「**書き出す前に**確認して続行を選ばせる」だったが「作ってから伝える」にした。欠落が分かるのはアーカイブ生成の最中で、事前に知るには収集後の存在確認をもう一周する必要があり、同じ経路を**一括書き出し**が通るのでダイアログを置けない。**OWNER 了承（2026-08-20）**                 |
| **#10 の余波**   | **対応済み**（2026-08-20）。一括タグ付けの選択を担当分に限り、外した件数を伝えるようにした                                                                                                                                                                                                 |
| **#13**          | 鍵を `scopeKeys.exam(examId)` の中へ入れる分は**やらない**（当初「見送り」と書いたが理由が違った）。次節を参照                                                                                                                                                                             |
| **#13 の残る窓** | 数え終わってから利用者が押すまでに他の教員が採点する窓は残る。塞ぐなら削除の実行時に数え直して中止する（`deleteStudentAnswer` は既にトランザクション内で数えており、中止の判断に使っていないだけ）。**ただし他の削除にも同じ扱いを広げるかの判断が要る**ので保留（OWNER 指摘・2026-08-20） |
| **#14 の本筋**   | 作成とタグ付けを1つの IPC にまとめる案は見送り。対象が2つの流れにまたがり、新しい口と payload 型が要る                                                                                                                                                                                     |

## #13 の機構を訂正した（2026-08-20）

当初「`gcTime` 内に開き直すとキャッシュがそのまま出て**取り直さない**」と書いたが、**誤り**。
`createAppQueryClient` は `staleTime` を設定していないので既定の 0、`refetchOnMount` の既定は
`true` なので、**開くたびに取り直しは走っている**。

本当の穴は「**取り直しの着地前に、古い件数を見せたまま押せる**」ことだった。React Query は
stale なデータがあると古い値を即座に返して裏で取り直すので、`isPending` は false になる。
窓は5分ではなく IPC 1往復ぶんだが、「採点データがありません」を読んで即座に押すのは確認
ダイアログの操作として自然な速さで、踏めば採点・確定・手書き注釈が消える。

したがって:

- **効いた修正は関門を `isFetching` へ変えた1行。** `staleTime: 0` と
  `refetchOnMount: "always"` は既定に依存しないよう明示しただけで、振る舞いは変わらない
- **鍵をスコープへ移す案は不要。** 取り直しを起こさせるための案だったが、取り直しは既に
  起きている。素通しの props を3階層増やして得るものが無い
- 重さは **中 → 低**が妥当（「5分間ずっと古い」ではなく「開いた直後の一瞬」）。ただし踏めば
  採点データが消えるので、直す必要はある

検査は `__tests__/renderer/components/deleteAnswerConfirmation.test.tsx`。**最初に書いたものは
ガードになっていなかった** — 開き直しのたびに新しい QueryClient を作っており、2回目も
キャッシュが空だったので `isPending` へ戻しても落ちなかった。同じ QueryClient を持ち越すよう
書き直して、初めて落ちるようになった。

## この文書の使い方

1件ずつ「直すのか・直す向きが正しいのか」を決めるための作業表である。決めたら **状態**の
欄を埋め、直したらその旨と根拠（どの検査で固定したか）を書き足す。

**確度の欄は2つある。**

| 確度       | 意味                                                                             |
| ---------- | -------------------------------------------------------------------------------- |
| **確認済** | 私がソースを読んで機構を確かめた。再現の筋も追える                               |
| **未確認** | レビューの報告のまま。**機構を自分で確かめていない**（宿題であって事実ではない） |

## 一覧

| #   | 重さ | 場所                                    | 何が起きるか                                         | 確度   | 状態                |
| --- | ---- | --------------------------------------- | ---------------------------------------------------- | ------ | ------------------- |
| 1   | 致命 | `useAnswerSheetDefinition.ts:1045`      | 小問の一部更新が原稿用紙の設定を毎回消す             | 確認済 | **済**              |
| 2   | 致命 | `useAutoCreateQuestionScore.ts:75`      | 設問を表示しただけで採点が未採点へ戻る               | 確認済 | **済**              |
| 3   | 高   | `DataSourcesContainer.tsx:190`          | 欠測の一括設定が常に失敗する                         | 確認済 | **済**              |
| 4   | 高   | `AnnotationBrowserPanel.tsx:188`        | 注釈の付け替えが採点を未採点へ戻す                   | 確認済 | **済**（#2 と同時） |
| 5   | 高   | `queryClient.ts:20`                     | ネットワークが無い端末で全ての取得と書き込みが止まる | 確認済 | **済**              |
| 6   | 中   | `ScreenBlackout.tsx:176`                | 起動直後の目隠しが解除できなくなる                   | 確認済 | **済**              |
| 7   | 高   | `useScoredAnswerPdfExport.ts:229`       | 1ページの失敗で書き出しが永久に止まる                | 確認済 | **済**              |
| 8   | 高   | `answerSheetBuilderHandlers.ts:556`     | 文字位置マーカーを持つ解答用紙を複製できない         | 確認済 | **済**              |
| 9   | 中   | `AnswerSheetBuilderMainView.tsx:106`    | 同時に出た編集の失敗通知が届かない                   | 確認済 | **済**              |
| 10  | 中   | `asbDefinitionTag.ts:38`                | タグ付けだけが担当の確認を素通りする                 | 確認済 | **済**              |
| 11  | 中   | `scoring.ts:59`                         | 採点領域を動かしても白さの測定が古いまま             | 確認済 | **済**              |
| 12  | 中   | `export/exam-archive/index.ts:57`       | 画像が欠けた書き出しを成功と報告する                 | 確認済 | **済**              |
| 13  | 低   | `DeleteConfirmationModal.tsx:65`        | 採点済みの答案を「採点なし」と告げて消せる           | 確認済 | **済**              |
| 14  | 中   | `SubtotalGroupModal.tsx:268`            | タグ付けの失敗で同名の小計グループが二重にできる     | 確認済 | **済**              |
| 15  | 中   | `classrooms/[classroomId]/page.tsx:160` | 学級の削除が失敗しても一覧へ遷移する                 | 確認済 | **済**              |
| 16  | 高   | `scoreResolution.ts:25`                 | 計算層が採点判定の union を捨て、未知の値が0点になる | 確認済 | **済**              |

**#16 はレビューの指摘ではなく、#2 を調べる過程で OWNER が見つけたもの**（2026-08-19）。

**この枝で入れた回帰**は 1・3・14・15。**8・16 は元からある**が、8 は書き直した塊の中に残っている。
2・4・5・9〜13 はこの枝の作り替え（楽観更新の撤去・キャッシュ化・取得の集約）で**踏みやすく
なった**もので、素の原因は前からある。

---

## 1. 小問の一部更新が原稿用紙の設定を毎回消す（致命・確認済・この枝の回帰）

**場所**: `src/components/answer-sheet-builder/hooks/useAnswerSheetDefinition.ts:1045`

> **原因の向きを訂正した（2026-08-19・OWNER 指摘）。** 当初これを「合流の書き方の誤り」と
> して報告したが、正しくは**画面と DB でデータ構造が違うという型規約違反があり、その帰結
> としてこの事故が出た**、という順序である。詳細と直す形は
> [asb-ipc-split-plan.md](./asb-ipc-split-plan.md) §8.5。

### 症状

原稿用紙を 25×15 で有効にした小問の**ラベルを1文字打つ**と、その書き込みが原稿用紙を
切って `20×10` の既定へ戻す。利用者は原稿用紙に触っていない。エラーも出ない。

### 機構

`updateSubQuestion` は「いまの姿（`current`）＋変えた分（`data`）」を組み立てて送る。

```ts
attributes: {
  ...current,
  ...data,
  manuscriptPaper: data.manuscriptPaper && { … },   // ← 常に置かれる
}
```

`data` にラベルしか入っていないとき `data.manuscriptPaper` は `undefined` なので、`&&` の
式全体が `undefined` になり、**直前の `...current` で入れた原稿用紙の設定を上書きして
消す**。「変えないなら触らない」つもりの行が「変えないなら消す」になっている。

行き先は2つある。

- **DB**: `asbSubQuestion.ts:40-46` が `manuscriptEnabled:false / columns:20 / rows:10` を書く
- **画面**: reducer（:560）も同じ形なので、状態から原稿用紙ごと落ちる

**文字位置マーカーが永久に消える筋もある。** マーカーは別テーブルで、小問の更新では
触られないので DB には残る。ところが原稿用紙を失った状態のまま undo / redo を押すと、
これは**全置換の書き込み**で、`deleteRemovedAsbCharGuides`（`asbDefinitionReplace.ts:177`）が
「いま送られてこなかった行」として**マーカーを消す**。2回打鍵して1回戻すだけで足りる。

> 当初「undo しても戻らない」と書いたが、正しくは**undo が消しにいく**方だった。

### なぜこうなったのか（根)

原稿用紙の設定6項目は **DB では小問の列**として平らに並び、**画面では `manuscriptPaper`
という入れ子**に束ね直されている。平らな項目は `{...current, ...data}` の1回で正しく
混ざるが、入れ子だけは手で1段深く混ぜ直す必要があり、その手作業がこれである。

`AsbSubQuestionUpdate` が**原稿用紙だけ入れ子の一部指定を許している**のも同じ根から来て
いる（「列数だけ変える」という操作があるため）。

### なぜ検査で出なかったか

`editorActions.test.ts` は「原稿用紙の列数を変えても文字位置マーカーが残る」方向しか見て
いない。**原稿用紙と無関係な更新**を通していなかった。

### 直す向き（決定・2026-08-19）

**2段で行う。**

1. **いま**: `&&` を三項へ替え、偽の枝に `current.manuscriptPaper` を置く（3行）。あわせて
   検査「**ラベルだけを変えても原稿用紙が残る**」を足す。原稿用紙を止めるのは
   `enabled:false` であってキーごと落とす経路は画面に無い（`SubQuestionForm.tsx:388` が
   唯一の入口で必ず全体を渡す）ので、「`data.manuscriptPaper` が無い＝この更新は原稿用紙の
   話ではない」と読んで確実である
2. **段階6**: 原稿用紙を `AsbManuscriptPaper` テーブルへ出す（[asb-ipc-split-plan.md]
   (./asb-ipc-split-plan.md) §8.5）。`AsbSubQuestionUpdate` の入れ子の例外が消え、
   **この手作業が構造ごと無くなる**

1 は 2 までのつなぎではない。2 は参照60箇所を機械的に触るので、**先に振る舞いの検査を
張ってから作り替える**。その検査は作り替えた後もそのまま生き残る。

**同じ形が他に無いことは確認済み。**

| 場所                                        | 判定                                                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| reducer `withSubQuestionAttributes`（:560） | **問題なし**。受け取る `attributes` は常に全体の写しなので `undefined` は「本当に原稿用紙が無い」を意味する |
| 隣を降ろす枝（:1031）                       | **問題なし**。`subQuestionAttributes(...)` の全体に `cleared` を重ねている                                  |

## 2. 設問を表示しただけで採点が未採点へ戻る（致命・確認済）

**場所**: `src/components/exams/07-score-at-once/ScoringIndividual/hooks/view/useAutoCreateQuestionScore.ts:75`

### 症状

採点した直後に、その採点が消えて未採点へ戻る。**エラーもトーストも出ない。**

### 機構

`create-question-score` は名前に反して **set**（無ければ作る・**有れば `status` と
`partialScore` を上書きする**）である（`electron-src/lib/prisma/questionScore.ts:163-182`）。
`QuestionScore` には (examStudentId, cropRegionId, userId) の unique 制約が無く
（`schema.prisma:302`。あるのは `@@index([examStudentId])` だけ）、`upsert()` が使えないため
`findFirst` ＋ 分岐を手書きしている。**「1採点者・1セル・1行」はこの関数だけが守っている。**

呼ぶ側は3つあり、欲しいものが違う。

| 呼ぶ側                                       | 意図                             | set で困るか                 |
| -------------------------------------------- | -------------------------------- | ---------------------------- |
| `useBatchScoring`                            | 「この答案を正解にする」         | 困らない（上書きが正しい）   |
| `useAutoCreateQuestionScore`                 | 「行が無いなら空の行を用意する」 | **困る**（触ってほしくない） |
| `AnnotationBrowserPanel.ensureQuestionScore` | 同上（注釈のドラッグ）           | **困る**（#4 はこれ）        |

後の2つは `status:"unscored"` を送る。前者は **effect から、設問を表示しただけで**出る
（:105）。利用者は何も採点していない。関門は `currentQuestionScoreId === null` で、これは
段階13 以降**キャッシュ（採点領域の木）**を見ている（:50）。採点の直後は取り直しが着地する
まで `null` のままなので、

1. 採点の書き込み（正解）
2. 表示だけで出る自動作成（未採点）← 共有 `scope` で 1 の後ろに直列化される

の順に届き、入れたばかりの点数が消える。

### 調査: 行の不在は、既に**全経路**で未採点として読まれている

**OWNER 指摘（2026-08-19）を受けて全数を取った**（当初は目についた4件だけを挙げていた）。
**例外は1つも無い。**

| 経路                                                            | 行が無いとき               | `unscored` の行          |
| --------------------------------------------------------------- | -------------------------- | ------------------------ |
| 採点画面 `07-score-at-once/types.ts:172`                        | `"unscored"`               | `"unscored"`             |
| **確定リゾルバ** `calculations/scoreResolution.ts:161`          | 候補ゼロ                   | **候補から除外**         |
| 確定サマリ `prisma/scoreDecisionSummary.ts:131`                 | 出てこない                 | `continue` で飛ばす      |
| **成績算出・試験合計** `examScoreCalculator.ts:56`              | `find` が空 → 加算されない | 得点 null → 加算されない |
| **成績算出・設問単体** `examScoreCalculator.ts:93`              | `return null`（欠測）      | null（欠測）             |
| 得点化 `calculations/actualScore.ts:34`                         | —                          | `null`                   |
| Excel 出力 `export/excel/dataFetcher.ts:277`                    | `"unscored"`               | `"unscored"`             |
| 個人成績表の統計 `individual-report/statisticsCalculator.ts:38` | 母数外                     | 母数外                   |
| 平均行 `export/excel/averageRows.ts:44`                         | 除外                       | 除外                     |
| SP分析 `08-export/hooks/useSpAnalysis.ts:34`                    | 行が無い                   | `isScored: false`        |
| 生徒詳細（成績カード・タグ分析）                                | —                          | 未採点として表示         |

**成績算出も同じ。** 入口で確定リゾルバを通し、その先の合計計算でも「得点が null なら加算
しない」ので、行の有無と `unscored` は区別されない。設問単体を成績データソースにした場合も
どちらも欠測になる。

**つまり未採点の行を作っても情報が1ビットも増えない。** 実体として持たねばならない理由は
1つだけで、`DrawingAnnotation.questionScoreId` が必須のFK（`schema.prisma:350`）であること。

### 副作用: 空行が量産される

設問をめくるたびに行ができる。40人×30問の試験を一通り見ただけで**1教員あたり1200行**の
空行ができ、同期にも流れる。行が増えるほど[段階20 の衝突](./sync-secondary-unique-hazard.md)の
機会も増える。

### 3つ目の作り手（調査で判明）

`initializeScoringRecords`（`prisma/scoringInitializer.ts`）は「全答案 × 全設問」の空行を
まとめて作る。**リゾルバの `unscored` 除外は、もともとこれへの防御として書かれていた。**
この関数は**呼び出し元がゼロ**（IPC チャンネルも無い）で、既に死んでいる。撤去の候補。

### 直す向き（決定・2026-08-19）

**2段で行う。**

1. **いま（#2 の修正）**: main の口を2つに割る。`setQuestionScore`（採点する。いまの中身。
   名前を実態へ）と `ensureQuestionScore`（無ければ作る・**有れば何も書かずにその行を返す**）。
   呼ぶ側は #2 と #4 の2箇所を後者へ替える。**キャッシュ頼みの関門が外れても採点は壊れない**
2. **段階21**: 表示での作成そのものをやめ、**注釈を書くときに main が採点行を用意する**。
   注釈の保存が `questionScoreId` ではなく「答案＋設問＋採点者」を受ける。renderer が
   `questionScoreId` を先に必要とする作りを解く

**どちらにせよ**: `status:"unscored"` を書いてよいのは、利用者が明示的に「未採点に戻す」を
選んだときだけにする。

### リゾルバの `unscored` 除外は**残す**（決定・2026-08-19）

「掃海して防御を消す」案を検討したが、**残す**。

理由は、**`unscored` の行には正当な存在理由がある**こと。`DrawingAnnotation` は親の
`questionScoreId` が必須なので、**注釈だけ付けて採点はまだ**という状態を表すには
`unscored` の行が要る。したがって「行はあるが採点の提案ではない」は**過去の掃き残しでは
なく、これからも起きる正しい状態**であり、除外はその不変条件の表明になる。

ただし2つ直す。

- **理由の書き換え。** いまのコメントは「`scoringInitializer` が量産するため」という過去の
  事情を書いており、「掃海すれば要らない」と読める。本当の理由は
  **「`unscored` は採点の意思表示ではない」**である
- **型で守る。** いまは `string` 同士の比較で、綴りを間違えても値が増えても検査に掛からない
  （#16）

### 空行の掃海（別途・要許可）

防御を消すためではなく、**意味のない行を減らすため**（同期の衝突機会・DB サイズ）に、
旧版が量産した空行を落とす価値はある。

- 条件は「`status='unscored'` **かつ** 注釈が無い **かつ** `ScoreDecision.sourceQuestionScoreId`
  から参照されていない」。`sourceQuestionScoreId` は FK ではない生の文字列なので、消すと
  ぶら下がりが残る
- **破壊的操作なので事前の許可が要る**
- **アーカイブ側（トランスフォーマー）では落とさない。** 「アーカイブは正本・存在について
  忠実復元」という裁定に反する。旧アーカイブが空行を持ち込んでも、防御があるので無害

## 3. 欠測の一括設定が常に失敗する（高・確認済・この枝の回帰）

**場所**: `src/components/grades/03-data-sources/DataSourcesContainer.tsx:190`

### 症状

データソースを選んで欠測設定を「適用」しても、**必ず全件失敗する**。

### 機構

呼ぶ側は `{ id, data: {…} }[]` を渡すが、`batchUpdateDataSourceEstimationMutation`
（`src/queries/grade.ts:409`）は**平坦なフィールド**を宣言していて
`updates.map(({ id, ...data }) => updateDataSource(id, data))` とするので、`{ data: {…} }` が
そのまま `prisma.gradeDataSource.update({ data })` へ渡り `Unknown argument 'data'` で落ちる。

削除した `useDataSources` フックが `{id, data}` を取っていた名残。

**`tsc` で出ない理由が、そのまま次の節の原因でもある。** `updates` が変数なので余剰プロパティ
検査が働かず、宣言されたフィールドは**全て optional** なので `{ id, data }` を渡しても
「必須の欠落」にならない。

### 根: 一括用のラッパーが行の型を手写ししている（OWNER 指摘・2026-08-19）

```ts
updates: {
  id: string
  absentMethod?: AbsentMethod
  absentRatio?: number
  …
}[]
```

`GradeDataSource` の**行の手写し**で、しかも全 optional。個別更新の口が同じフィールドを既に
宣言しているので、**同じ形が2箇所に手書きされている** — 段階19 が消そうとしている形そのもの。
**型を緩めたことが、検出を殺している。**

`batch` という名前も実体に合わない。コメント自身が「一括専用の IPC は持たない／同じ操作を
対象分だけ繰り返すだけ」と書いており、`batch` は操作の名ではなく**失敗の知らせを1回に
まとめるという都合**の名である。

### 直す向き（決定・2026-08-19）

**ラッパーを撤去し、呼ぶ側が個別の mutation を対象分だけ回す。**

一括専用の IPC は元から存在しない（中身は `updateDataSource` を対象分呼んでいるだけ）。
自ソース除外も呼ぶ側にある。**残っていた存在理由「トーストが20枚出るのを防ぐ」も、既に
`MutationCache` が担っている** — `queryClient.ts:49` が `isMutating({ mutationKey })` で
「同じ行き先へ書いているものが他に走っている間は後始末を出さない」ようにしており、
`mutationKey` は `defineMutation` が `meta.invalidates` から付ける（段階11）。

撤去すると3つ同時に片付く。

- 行の手写し（全 optional）が消える → **この不具合が `tsc` をすり抜けた原因ごと消える**
- `{ id, data }` の包み違いは個別の口の引数に直接当たるので**コンパイルエラーになる**
- 実体に合わない `batch` の名が消える

**同じ形のラッパーが他の画面にも無いか、併せて数える。**

## 4. 注釈の付け替えが採点を未採点へ戻す（高・確認済 → **#2 に含む**）

**場所**: `src/components/exams/07-score-at-once/ScoringSidePanel/AnnotationBrowserPanel.tsx:188`

**#2 と同じ口・同じ値で、独立した修正は要らない**（現物を確認したので確度を「未確認」から
「確認済」へ上げた・2026-08-19）。

`ensureQuestionScore`（:169）は名前こそ ensure だが、中身は `createQuestionScore` を
`status: "unscored"` で叩いている。関門も同じくキャッシュ（`findQuestionScore(cropRegion, …)`）
なので、**採点した直後に保存済みの注釈をその答案へドラッグすると、注釈は付くのに採点が
未採点へ戻る**。

#2 の決定（`setQuestionScore` と `ensureQuestionScore` に割り、呼ぶ側2箇所を後者へ替える）の
**「2箇所」の片方がこれ**である。#2 を直せば同時に塞がる。

## 5. ネットワークが無い端末で、全ての取得と書き込みが止まる（高・確認済）

**場所**: `src/queries/queryClient.ts:20`

### 機構

`createAppQueryClient` の既定は `refetchOnWindowFocus` と `retry` だけを指定しており、
**`networkMode` を指定していない**。指定が無いと TanStack Query の既定 `"online"` になり、
`canFetch`（`@tanstack/query-core/src/retryer.ts:54`）が `onlineManager.isOnline()` で
**全クエリ・全ミューテーションを止める**。クエリは `fetchStatus:"paused"` のまま
「読み込み中」で固まり、書き込みは走らない。`onlineManager.setOnline` を呼ぶ箇所はアプリ内に
無いので、判定は `navigator.onLine` 任せ。

Wi-Fi を切った端末で**採点画面が進まず、採点も保存されない**。ローカルインストール＋個人利用は
想定内の使い方（`project_collaborative_scoring_constraints`）なので実際に踏む。

### この作りに `"online"` が正しく働く経路は1つも無い（OWNER 確認・2026-08-19）

**アプリは常にローカルの複製だけを読み書きする。** `getDatabasePath()` は同期が有効なとき
`getLocalDbPath()`（`userData/score-at-once/database.db`）を返し、NAS の共有ファイルに触れるのは
`sqlite-nas-sync` が同期を回すときだけ。しかも同期は**ファイル単位のコピーではなく行レベルの
マージ**で、経路そのものが別物である。

したがって `useQuery` / `useMutation` は**1つ残らずローカル完結**で、`navigator.onLine` が
false でも成功する。逆に同期の失敗は React Query を一切通らず、ライブラリの `warnings` に
積まれる。NAS は SMB のファイル共有なので、同期にとっても `navigator.onLine` は正しい信号では
ない。

### 直す向き（決定・2026-08-19）

`defaultOptions` の **`queries` と `mutations` の両方**へ `networkMode: "always"` を置く。

理由（IPC はネットワークを跨がない／NAS は `sqlite-nas-sync` が行レベルで仲介するので
アプリから見れば常にローカル）をコメントに残す。**すぐ上の `retry: false` と同じ根拠**なので
並べて書く。

検査は `onlineManager.setOnline(false)` した状態で `useQuery` が `paused` にならないことを見る。

## 6. 起動直後の目隠しが解除できなくなる（中・確認済）

**場所**: `src/components/common/ScreenBlackout.tsx:176`

> **重さを「高」から「中」へ下げた（OWNER 指摘・2026-08-19）。** この機能は**見た目だけで、
> セキュリティが目的ではない**。強制リロードで解除できる仕様であり、データも失われない。
> 実害は「再読み込みを強いられる」ことに留まる。

### 機構

状態が2つある — `isBlackout`（画面が隠れている）と `isLocked`（暗証番号を入れないと戻れない）。

**施錠するかどうかは、目隠しが始まる瞬間に決まる**（:118 `if (hasDigitPasscode) setIsLocked(true)`）。
ところが**解除側は、その後に読み直した `hasDigitPasscode` を見る**（:177, :298）。

`ScreenBlackout` は `AuthGate` の**外側**（root layout の `AppShell`）にあり、
`hasDigitPasscode` は利用者一覧から導かれるので**起動直後のまだ届いていない間は false**。
そして Ctrl/Cmd+L の受け口（:158）には**準備完了の関門が無い**。

暗証番号を設定した教員がその窓で Cmd+L を押すと:

```
押した瞬間:      hasDigitPasscode = false → isBlackout だけ立ち、isLocked は立たない
利用者一覧が届く: hasDigitPasscode = true  へ変わる
```

出口が全て塞がる。

| 出口                       | なぜ効かないか                                                  |
| -------------------------- | --------------------------------------------------------------- |
| 操作すると解除（:176-177） | `!hasDigitPasscode` の枝に入らない（いまは true）               |
| 画面クリック（:297）       | `!isLocked && !hasDigitPasscode` にも `isLocked` にも当たらない |
| 暗証番号の入力（:254）     | `if (!isLocked) return` なので**受け口自体が張られない**        |

**再読み込み以外に出口が無い。**

コメント（:109）は「発火した時点の値を読む。閉じ込めると利用者一覧が後から届く場合に困る」と
**まさにこの問題を意識して `useEffectEvent` を使っている**。直したのは「タイマーを張ったときの
値で固定されること」だけで、**発火時点でまだ false であること**は残った。

### 直す向き（決定・2026-08-19）

**解除側も、始めた時点の判断に従う。** 施錠したかどうかは `isLocked` が既に持っているので、
解除の分岐から `hasDigitPasscode` を外し、**`isLocked` だけで決める**。

#1 と同じ形 —「開始時の値」と「現在の値」を混ぜたのが原因なので、**判断の拠り所を1つにする**。
「準備できるまで目隠しを始めない」（関門を足す）案も出たが、混在自体は残るので採らない。

## 7. 1ページの失敗で書き出しが永久に止まる（高・確認済）

**場所**: `src/components/exams/08-export/hooks/useScoredAnswerPdfExport.ts:229`

### 機構

```ts
try {
  await addPageToStreamingSession({ sessionId, pageIndex, imageData })
  setEmbeddedPagesCount((prev) => prev + 1)   // ← 成功したときだけ進む
} catch (error) {
  console.error(...)                          // ← 握り潰し。カウンタも進まない
}
```

1ページでも失敗すると `embeddedPagesCount` が最終ページ数に届かず、完了を待つ関門が
**永久に開かない**。進捗は「41/42」で止まる。**`console.error` だけなので画面には何も出ない。**

後始末も2つ残る。

- main 側の pdf-lib のセッションとページのバッファが**解放されずに残る**
- `setIsExporting(false)` は `finalizePdf` の `finally` にしかないので **`isExporting` が
  true のまま**になり、以後どの書き出しも `runValidatedExport` が黙って return する

**一度踏むとアプリを再起動するまで PDF 出力が一切できない。**

根は「失敗を無かったことにしている」こと。`isExporting` の解放が成功経路にしか無いのも同じ。

### 直す向き（決定・2026-08-19）

**1ページでも失敗したら書き出しを中止する。** 欠けた PDF を作らない。答案の PDF は印刷して
生徒に返すものなので、**ページが欠けたまま成功と見える**ほうが害が大きい。#12（画像が欠けた
書き出しを成功と報告する）と同じ論点なので揃える。

- 成功と失敗の**両方でカウンタを進める**（あるいは失敗を別に数える）。全ページの結果が
  出そろった時点で関門を開く
- 失敗が1件でもあれば**中止**し、main のセッションを破棄する
- **`isExporting` は必ず戻す**（成功経路だけでなく、中止経路でも）

**知らせは親切に（OWNER 指定）。** `console.error` で済ませない。少なくとも次を画面に出す。

- **どのページで失敗したか**（生徒名・ページ番号）
- **なぜ失敗したか** — 例外のメッセージ／エラーコードをそのまま伝える。丸めない
- **ファイルは作られていない**こと（欠けたものが保存されたのではない、と分かるように）

## 8. 文字位置マーカーを持つ解答用紙を複製できない（高・確認済・元からある）

**場所**: `electron-src/ipc-handlers/answerSheetBuilderHandlers.ts:556`

### 機構

複製は子の id を振り直すが、**文字位置マーカーだけが素通りする**。

| 子                                                     | id の振り直し             |
| ------------------------------------------------------ | ------------------------- |
| 定義本体・ヘッダー項目・大問・小問・枝問・テキスト要素 | ✓                         |
| 画像要素                                               | ✓（ファイルもコピーする） |
| **文字位置マーカー**                                   | **✗**                     |

小問は `{ ...subQuestion, id: crypto.randomUUID(), … }` で作り直すが、`manuscriptPaper` は
スプレッドでそのまま運ばれる。中の `charGuides` は元の `AsbCharGuide.id` を持ったままなので、
`writeAsbCharGuides` が**既にある主キーで作成しようとして衝突**する。

**順番も悪い。** 画像ディレクトリの作成とコピーは先に走る（:528, :544）ので、トランザクションが
巻き戻っても**孤児のディレクトリと画像ファイルが残る**。失敗を繰り返すほどゴミが溜まる。

OMR は同種の問題を既に直してある（`asbOmrConfig.ts` が新しい uuid を振る）。**マーカーだけが
取り残されている。**

### 直す向き（決定・2026-08-19）

**いま単独で直す。** 複製処理の小問の枝で `manuscriptPaper.charGuides` にも id を振る（数行）。

段階6（原稿用紙をテーブルへ出す）でこの形は作り替わり、マーカーの親が「小問」から「原稿用紙」へ
移って OMR と同じ扱いに揃う。**それでも先に止める** — 段階6 までの間ずっと「マーカーを置いた
解答用紙は複製できない」状態が続き、そのたびに孤児ファイルが残るため。

**id を振り直すときは、親子の対応（FK の指し先）も必ず新しい id へ揃える**（OWNER 指定）。
段階6 でテーブル化するときも、`onDelete` と FK は OMR と同じ形に揃える。

あわせて決めること: **画像ファイルのコピーをトランザクションの後ろへ回す**か、失敗時に作った
ディレクトリを片付けるか（#8 の本体とは別だが同じ関数の中）。

## 9. 同時に出た編集の失敗通知が届かない（中・確認済・この枝で入れた作り）

**場所**: `src/components/answer-sheet-builder/AnswerSheetBuilderMainView.tsx:106`

### 機構

**1つの `useMutation` 観測子へ、呼び出しごとのコールバックを渡している。**

```ts
const { mutate: applyEdit } = useMutation(
  applyAnswerSheetEditMutation(definitionId)
)
applyEdit(action, {
  onSuccess: showSaved,
  onError: () => handleWriteFailure.current(),
})
```

`MutationObserver.mutate` は `#mutateOptions` を上書きして前の mutation を切り離すので、
**解決前に次の `mutate` が来ると先の `onError`/`onSuccess` が発火しない**。

稀な重なりではない — `updateSubQuestion` は隣の設定を降ろす分と本体の分を同じ tick で2本出し、
`useAsbWriteGate.flush` は溜めた分をまとめて出す。

| 起きること           | 見た目                                             |
| -------------------- | -------------------------------------------------- |
| 先が失敗し、後が成功 | 立て直しが走らないまま「**保存されました**」と出る |
| 最後の1本が失敗      | 「保存しています...」で**固まる**                  |

前者が悪質。**DB に書けていないのに保存済みと表示され、画面には書けたはずの値が残る。**

### 根: ASB だけが木の複製を持っている（OWNER 指摘・2026-08-19）

`handleWriteFailure` の ref は**アプリ全体でここ1箇所だけ**。他の画面は持っていない。

`MutationCache` は `onSettled` で**成功しても失敗しても** DB から取り直す（「失敗したときこそ
手元の表示を DB に揃える」）。だから他の画面は取り直しが着地すれば勝手に揃い、失敗時に何も
しなくてよい。

**ASB だけが編集中の木を reducer に複製として持っている**（undo/redo のため）ので、クエリを
取り直しても reducer の中身は古いまま。「取り直したあと reducer へ入れ直す」手当が要り、その
関数は編集フックより後でしか作れないので ref を経由している。

**ref は病気ではなく症状で、本体は複製を持っていること。** #9 も同じ根から出ている。

### 直す向き（決定・2026-08-19）

**`mutateAsync` で待ち、呼び出し側で立て直す。**

- コールバックの取りこぼしが消える（観測子の共有に依存しない）
- **ref が消える** — 立て直しを呼び出し側に直接書けるため
- ASB の書き込み口は `write` と `restore` の**2箇所だけ**なので、try/catch が戻ると言っても
  実質2つ

`meta`（`defineMutation` の宣言側）へ寄せる案も出たが、**宣言には「reducer へ入れ直す」関数を
渡す先が無く、ref が消えずに置き場所が変わるだけ**なので採らない。

**複製を持つこと自体をやめる**（reducer を捨ててクエリキャッシュを唯一の状態にする）のが本筋
だが、それは undo/redo の作り替えで、`asb-ipc-split-plan.md` §11「やらないこと」に明記された
範囲。今回は触らない。

## 10. タグ付けだけが担当の確認を素通りする（中・確認済）

**場所**: `electron-src/lib/prisma/asbDefinitionTag.ts:38`（`createAsbDefinitionTag` :22 も）

### 機構

書き込み2本とも **`writeAsbDefinitionContent`（段階17 で置いた関所）を通っていない**。素の
`prisma.$transaction` を直接開いている。通らないことで2つ抜ける。

| 関所がやること                                | 抜けると                                             |
| --------------------------------------------- | ---------------------------------------------------- |
| `assertAsbDefinitionEditableBy`（担当の確認） | **担当でない教員が他人の解答用紙にタグを付けられる** |
| 親の `updatedAt` の繰り上げ                   | 一覧の更新日時・並べ替え・期間の絞り込みが古いまま   |

前者が効くようになったのはこの枝の変更のため。`listAsbDefinitions` から `where: { userId }` を
落として**全員の解答用紙を一覧に出す**ようにしたので、他人の解答用紙が画面に並ぶ。他の編集は
全て弾かれるのに、**タグ付けだけが通る**。

`setAsbDefinitionTags` の中身自体は正しい（「外れたものだけ消し、付いたものだけ作る」で同期の
巻き添えを避ける）。**問題は中身ではなく、関所を通っていないことだけ。**

### 直す向き（決定・2026-08-19）

**`writeAsbDefinitionContent` でくるむ。** 中身はそのまま `tx` を受け取る形にし、変更があった
ときだけ `true` を返す（親の `updatedAt` が正しく動く）。

**タグ付けも「担当でないと編集できない」に含める**（OWNER 決定）。他の編集と同じ扱いにする。
`AsbDefinitionTag` は `userId` を持たない＝**タグは利用者ごとの分類ではなく解答用紙そのものの
属性**（教科・試験種別）なので、扱いを分ける理由が無い。

## 11. 採点領域を動かしても白さの測定が古いまま（中・確認済）

**場所**: `src/queries/scoring.ts:59`

### 何の話か

「白さ」は答案の切り抜き領域がどれだけ白いか（＝空欄らしいか）の測定値で、07 の一覧を開いた
時点で**そのページの全答案 × 全採点領域**をまとめて先読みする（`useAnswerWhiteness.ts:2`）。
空欄の答案をまとめて見つけるためのもの。

### 機構

測定に渡すのは2つ。

```
答案画像:  studentAnswerImageId と imagePath
採点領域:  cropRegionId と x / y / width / height    ← 鍵に入っていない
```

```ts
queryKey: ["answerWhiteness", examPageId, answerImagesSignature]
```

**鍵は答案の顔ぶれしか見ていない。** 領域の矩形を変えてもキャッシュは「同じ問い合わせ」と
判断して前の答えを返す。さらにこの鍵は `scopeKeys.exam(examId)` の**外**（頭が
`"answerWhiteness"` なので前方一致に当たらない）なので、どの書き込みでも無効化されない。

一番踏みやすいのは1人で往復する場合。

```
07 で一覧を開く            → 白さを測ってキャッシュに載る
02 へ行って解答欄をずらす  → cropRegion の x/y が変わる
07 へ戻る                  → 鍵が変わらないので測り直さない → 古い矩形の白さが出る
```

**領域を足した場合は、測定結果の Map にその領域が無いので黙って空になる**（エラーは出ない）。

> **現実には「採点中に x/y を動かす」のは事故に近い場面**（OWNER 指摘・2026-08-19）。それでも
> 直す理由は、**鍵が入力を表していないこと自体が誤り**だから。

### 直す向き（決定・2026-08-19）

**測定に渡しているものを全部鍵に入れる。** 領域の id と矩形も署名にまとめて鍵へ足す。答案画像
について既に `buildMeasurementSignature` が同じことをやっているので、そこへ寄せる。

**`scopeKeys.exam(examId)` の中へは移さない。** 白さは画像と矩形だけで決まり、採点結果には
依存しない。スコープに入れると採点のたびに画像を読み直して測り直すことになり、重いわりに答えは
変わらない。**鍵が入力を正しく表していれば、無効化に頼る必要がない。**

型は既存の `WhitenessTargetRegion`（`src/types/answerWhiteness.types.ts`）をそのまま使い、
署名のために新しい形を手書きしない。

## 12. 画像が欠けた書き出しを成功と報告する（中・確認済・**保留**）

**場所**: `electron-src/lib/export/exam-archive/index.ts:57`

### 機構

`createArchive` は `missingFiles` を返す（`archiveCreator.ts:209/222` で埋まる）が、
**`exportExamTo` も `exportExam` も読まずに捨てている**。

```ts
const archiveResult = await createArchive(...)
…
await recordAuditLog({ action: "exam.export", … })   // ← 成功として記録
return { outputPath: archiveResult.outputPath }      // ← outputPath しか見ていない
```

共有フォルダの `data/` の一部が外れている状態（NAS が一時的に見えない、画像実体が別端末に
しかない）で書き出すと:

- 欠けた画像は `missingFiles` に**記録される**
- ZIP は**欠けたまま作られる**
- 監査ログは**成功**、画面も**成功**
- 受け取った同僚は**答案画像の無い試験を警告なしで取り込む**

### 直す向き（方向のみ合意・確定は保留・2026-08-19）

#7（1ページでも失敗したら中止）とは**性質が違う**。#7 は PDF が壊れた成果物になるが、#12 は
ZIP 自体は正しく、中身の一部が無いだけで取り込みは成功する。よって中止一択ではなく
**伝えたうえで選ばせる**。

> 書き出す前に欠落を数えて「画像が N 件見つかりません。このまま書き出すと、受け取った側では
> 答案画像が表示されません」と示し、続行するか選ばせる。続行したら**監査ログにも欠落件数を
> 残す**。全部揃っているときは何も出さない。

**「伝えずに成功と言う」ことだけは無くす**、という線。

### 保留の理由（先に確かめること）

**`missingFiles` に何が入るのかを確認していない。** 本当に「無かった」ファイルだけなのか、
意図的に除外したものも入るのか。`exportMode` に `"full"` 以外があるので、**モードによっては
欠けているのが正常**かもしれない。ここを確かめてから確定する。

## 13. 採点済みの答案を「採点なし」と告げて消せる（中・確認済）

**場所**: `src/components/exams/06-student-answers/student-answer-table/components/DeleteConfirmationModal.tsx:65`

### 機構

関門は **`isPending`（初回取得中か）だけ**。キャッシュに残っていれば false なので、**古い値の
まま確定できる**。

```ts
const { data: summary = null, isPending: isLoadingSummary } =
  useQuery(studentAnswerScoreSummaryQuery(fileId))
…
<AlertDialogAction onClick={handleConfirm} disabled={isLoadingSummary}>
```

鍵は `["studentAnswerImage", id, "scoreSummary"]` で **`scopeKeys.exam(examId)` の外**
（#11 と同じ形）。07 で採点しても古くならない。本体は開いている間しか mount されないので、
`gcTime`（5分）内に開き直すとキャッシュがそのまま出る。

```
06 で削除ダイアログを開く → 「採点データなし」を見て閉じる
07 へ行って採点する
06 に戻って開き直す        → 5分以内なら再び「採点データなし」
削除する                   → QuestionScore / ScoreDecision / DrawingAnnotation が
                              カスケードで消える
```

**「採点データなし」と表示したうえで、採点データを消す。** 撤去した `useEffect` は毎回取り直して
ボタンを止めていた。

### 直す向き（決定・2026-08-19）

**両方やる。**

- **鍵を `scopeKeys.exam(examId)` の中へ入れる** — #11 とは逆の判断だが理由が違う。白さは
  「画像と矩形だけで決まる」ので鍵に入力を入れれば済んだ。**こちらは採点結果そのものが答え**
  なので、**採点を書いたら古くなるのが正しい**。依存が実在するのだから鍵で表す
- **開くたびに必ず取り直す**（`staleTime: 0` ＋ `refetchOnMount: "always"`、関門は `isPending`
  から `isFetching` へ）— 無効化だけでは**他の教員が採点した場合に届かない**（同期はキャッシュを
  触らない）。**消す前に必ず数える**性質の操作なので、開いたら必ず取り直す

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

## 16. 計算層が採点判定の union を捨て、未知の値が0点になる（高・確認済・元からある）

**場所**: `electron-src/lib/shared/calculations/scoreResolution.ts:25` ほか

**OWNER 指摘（2026-08-19）。** #2 の「リゾルバの防御」を見ていて出てきたもので、レビューの
15件には入っていない。

### 何が違反しているか

`src/types/scoringStatus.types.ts` は自ら唯一の定義源だと宣言している。

> scoring / export / 表示色など**全レイヤーがこの1ファイルから `ScoringStatus` を導出する
> こと**（各所での union 手書き重複は禁止 — 過去に hold/pending のドリフトを生んだ原因）

ところが計算層はこうなっている。

```ts
export interface ResolvableScore {
  examStudentId: string
  cropRegionId: string
  status: string // ← union を捨てている
  partialScore: number | string | { toString(): string } | null // ← Decimal の当て逃げ
  id?: string // ← 行には必ずある
  updatedAt?: Date | string
}
```

3つ違反している。

1. **`status: string`** — union を手書き重複したのではなく**捨てている**。規約が禁じた
   ドリフトより一段悪い。`EffectiveScore.status` も `string` なので下流へ伝播する
2. **`partialScore` の構造的な逃げ道** — Decimal を受けるために `{ toString(): string }` を
   許している。境界で `serializePrisma` を通す規約の迂回
3. **`ResolvableScore` 自体が DB 行の手写し**（`id?` が optional なのは行の実体と合わない）。
   段階19 の対象そのもの

### 実害

**① 防御が型で守られていない。** `group.filter((p) => p.status !== "unscored")` は `string`
同士の比較なので、綴りを間違えても `SCORING_STATUSES` に値を足しても**コンパイルは通る**。

**② 下流で `as` を強いている。** `export/excel/dataFetcher.ts:277`:

```ts
status: (scoreRecord?.status as ScoringStatus) || "unscored",
```

`as` は原則禁止だが、上流が `string` を返すので消せない。**広げた型が下流に規約違反を
作らせている。**

**③ 未知の値が「0点」になる。** `calculations/actualScore.ts`:

```ts
calculateActualScore(questionScore: { status: string; … })
  switch (questionScore.status) {
    case "unscored": return null      // 未採点 = 欠測
    …
    default:         return 0         // ← ここ
  }
```

`ScoringStatus` を受けていれば網羅漏れがコンパイルエラーになる。いまは `string` なので
黙って通り、**「未採点（欠測）」ではなく「0点」として成績に算入される**。
`SCORING_STATUSES` に値を1つ足すだけで踏め、型検査もテストも鳴らない。

### 直す向き（決定・2026-08-19）

`ScoringStatus` は renderer / electron 横断の共有型として `src/types/` にあり、計算層から
普通に import できる。境界コンバータ `toScoringStatus` も既にある。

- **境界で `toScoringStatus` を1回通し、以後は union のまま持つ**
- **`default` を `assertNever` にする。** 値が増えたらコンパイルエラーになる
- **`partialScore` は境界で `number | null` へ落とす**（`serializePrisma` の担当）
- `dataFetcher.ts:277` の `as` はこれで消える

**段階19（DB行の手写し型の是正）の対象**だが、③は振る舞いの誤りなので**段階19 を待たずに
扱う**。

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

| 文書                                                                 | 関係                                                        |
| -------------------------------------------------------------------- | ----------------------------------------------------------- |
| [ipc-and-data-fetching-plan.md](./ipc-and-data-fetching-plan.md)     | R7・R8 の枠。段階17・18 の内容                              |
| [asb-ipc-split-plan.md](./asb-ipc-split-plan.md)                     | #1・#8・#9・#10 が触る ASB の分割                           |
| [coding-style.md](./coding-style.md)                                 | #3・#9 は「書き込みは `defineMutation` を通す」の周辺       |
| [sync-secondary-unique-hazard.md](./sync-secondary-unique-hazard.md) | #1 の調査中に別途見つかった同期の詰まり（この枝とは無関係） |
