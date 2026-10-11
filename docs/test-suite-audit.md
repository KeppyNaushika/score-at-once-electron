# テストとデッドコードの全数調査

調査と対処: 2026-10-12。前回の調査（2026-08-23）で挙げた項目のうち未着手だったもの
（`cropRegionOmrConfig` の写し・`omrArchiveRoundTrip` の自作往復・表明の無い II-8/II-9/EC-7・
`idMappings.test.ts`）は、今回の対処に含めて片付けた。

---

## 1. 何を問うたか

テストは全部緑だった。問うたのは次の2つである。

- **その緑は本番の正しさを言っているか。** 本番を通らないテスト、どんな実装でも通るテスト、
  前提が古くなったテストは、緑のまま何も守らない
- **本番に、誰も使わないコードが残っていないか。** 特に「テストからしか使われないコード」は、
  テストを走査の起点に含める限り見つからない

---

## 2. 調べ方

| 手段                                            | 見つけるもの                                                                  |
| ----------------------------------------------- | ----------------------------------------------------------------------------- |
| knip（テストを起点に含める）                    | どこからも使われないファイル・export・依存                                    |
| knip（テストを起点から外し、vitest 連携も切る） | **テストからしか使われない本番コード**（上との差分）                          |
| `npm run check:hooks`                           | フックの返り値で、どの呼び出し元も使わないもの                                |
| 参照の grep                                     | `public/`・`scripts/`・フィクスチャで、どこからも参照されないファイル         |
| テスト 415 ファイルを全部読む                   | 本番を通らない・必ず通る・重複・名前と中身の食い違い・規約一覧の空振り        |
| 実在の確認                                      | 規約テストの一覧に載る名前が schema・ソースに実在し、例外が実際に効いているか |

knip の設定はリポジトリに置いていない。§8 の手順で毎回書く。

---

## 3. 本番の不具合（調査の途中で見つかったもの）

**採点確定の行を返す経路が、確定者の User を全列で返していた。**
`scoreDecision.ts` の `include: { decidedBy: true }`（2か所）は、パスコードのハッシュを含む
User の全列を renderer へ渡していた。

これを捕まえるはずの `publicUserOmit.test.ts` は、User を指す関連名を手で書いた一覧で
走査しており、その一覧に schema に無い名前（`owner`, `decider`）が入り、実在する
`decidedBy`・`createdBy`・`frozenBy`・`capturedBy` が抜けていた。**規約テストが緑のまま
空振りしていた。**

対処:

- `decidedBy` を `{ omit: PUBLIC_USER_OMIT }` にした。手書きの `omit: { passcode: true }`
  （`scoreDecisionSummary.ts`・`cropRegionAssignment.ts`・`examStudentAssignment.ts`・
  `userExam.ts`・`drawingAnnotation.ts`）も `PUBLIC_USER_OMIT` へ寄せた
- `publicUserOmit.test.ts` は関連名を `schema.prisma` から引くようにし、手書きの omit も禁じた

---

## 4. デッドコード

### 4.1 テストからしか使われていなかったもの（削除）

テストを起点に含めた knip には一切出ない。テストを外して初めて見える。

- ファイル: `electron-src/lib/omr/autoScorer.ts`、`electron-src/lib/prisma/compoundAnswer.ts`
  （連鎖して `assertCompoundAnswersInSameExam`）
- 関数: `getGradeItemsByExamId`、`getDataSourcesByGradeItemId`、`normalizedRectToPixelRect`、
  `computeCircularFillRatio`、`stripMarkup`、`estimateAnnotationCharacterLimit`

OMR の自動採点は本番では renderer の `reevaluateWithThreshold` が担っている。
`autoScorer.ts` のテストにだけあった部分点・複数正解のケースは、本番の
`reevaluateWithThreshold` を通るテストへ移した（この分岐を見るテストはそれまで無かった）。

### 4.2 どこからも使われていなかったもの（削除）

- `aiGradingSource.ts` の `listOwnQuestionScores` / `listAiGradingAttemptsByIds`
- `aiSendingCropPreviewQuery` から preload の `previewCrop`、ハンドラ、lib 関数まで一式
- `rubricItemsOfExamQuery` から preload の `listItemsByExam`、ハンドラ、lib 関数まで一式
- フックの返り値 `useAssignedExamStudents().hasStudentAssignments`、
  `useAiGradingAvailability().isUnlocked`
- コンテキストキー `sidePanelVisible`（書くだけで、読む when 句が無かった）

**後ろの2つの IPC 一式は、`ipcBoundaryConventions.test.ts` を素通りしていた。** この検査は
「preload メソッドが renderer のどこかで `.メソッド名` として呼ばれているか」を見るが、
呼んでいたのが使われていない query 定義の本体だったため、生きていると数えられた。
いまは `src/queries/` の定義が src のどこかから使われていることも確かめ、使われていない
定義の中の呼び出しは数えない（§7）。

### 4.3 export だけ余計だったもの

同じファイルの中でしか使わない export を約100件外した。完全に未参照だった型4件は削除した。
`export const { is, to } = defineStringUnion(...)` は、使われていない側だけを分割代入から外した。

### 4.4 不要なファイル（削除）

| ファイル                                   | 理由                                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| `scripts/bulk-rename.mjs`                  | Project→Exam の改名に1回使った道具                                               |
| `scripts/create-test-user.js`              | 既に動かなかった（User に `passwordHash` 列が無く、adapter 無しの Prisma 7）     |
| `public/score-assets/0.png`〜`9.png`       | 採点マークの読み込みは `correct`/`incorrect`/`partial`/`pending`/`unscored` だけ |
| `scripts/importTempSaiten.ts` とその設定例 | 旧版のデータの取り込みは scoring_at_once 側の変換へ移った                        |
| ルートの `playwright.config.ts`            | 存在しない `./tests` を指し、素で叩くと0件で緑になっていた                       |

依存では、`forge.config.js` とテストが直に使う `@electron/asar` を devDependencies に書いた。
`forge.config.js` の `FORBIDDEN_IN_PACKAGE` に `.next-screenshot` を足し、`.next-e2e` と並べた。

---

## 5. テストの指摘 ── どう「緑なのに守っていない」か

415 ファイルのうち、丸ごと不要だったのは `import-export/unit/idMappings.test.ts`
（テストヘルパーとオブジェクトへの代入を確かめていた）と `omr/unit/autoScorerDb.test.ts`
（§4.1）、それに写しを検査していた `omr/integration/omrArchiveRoundTrip.test.ts` だけだった。
残りは個々の it の問題で、約100件を直した。類型と代表例を残す。

### 5.1 どんな実装でも通る

- **表明が無い・恒真の表明**: `idIntegrationImporter` II-8/II-9（expect 無し）、
  II-4/II-5/II-10（`>= 0`）、`edgeCases` EC-7（経路上、検証のしようが無かった）
- **読み込みが終わる前に「無い」を確かめる**: 既定値と期待値が同じなので、データが届く前に
  通る。`scoringAnonymity`・`aiGradingMode`・`aiExamCostBadge`・`gradeLabelOverride`・
  `useGridAnnotations`・`useAllStudentAnnotations`。届いたことを待ってから確かめる形にした
- **構造的に必ず0件になる条件で数える**: `gradeFrozenScore`（カスケードで消える関係を条件に
  数えていた）、`examStudentRemoval`（新しい uuid で数えていた）、`freshInstallChain`
  （行の無い DB で `foreign_key_check`）
- **if/else のどちらの枝でも通る**: `markRecognizer` のダブルマーク判定、
  `cornerMarkerDetector` の罫線接触

### 5.2 偶然通っていた ── LWW を確かめていなかった

`idIntegrationImporter` II-5/II-7 と `edgeCases` EC-8 は、取り込みの後勝ち（LWW）を確かめる
名前だったが、アーカイブ側と DB 側の `updatedAt` が同じ値で、後勝ちが一度も働いていなかった。
テストは `createScoringConflict` で時刻を渡していたが、**事前照合の `scoringConflicts` は表示用で、
本番の取り込み（`importScoring.ts`）は判断に使わない。** 時刻はアーカイブの行そのものに
持たせる必要がある。直した後は、後勝ちを壊すと落ちる。

### 5.3 本番ではなく写しを検査していた

- `cropRegionOmrConfig.test.ts` は本番の `upsertOmrConfig` をテスト内に書き写し、写しを
  検査していた。写しはしきい値2列とバブル位置5列を書かず、本番から乖離していた。
  `vi.mock(".../prisma/client")` でテスト DB へ向け、本番の3関数を通す形にした
- `omrArchiveRoundTrip.test.ts` の往復は、書き出しと取り込みをテスト内で手書きしていた。
  生きていた変換器のテストだけを `omrArchiveTransformer.test.ts` へ移し、ファイルは削除した
- `schemaBootstrap` のトランザクションの検査は、テスト内で `db.transaction` を自作して
  SQLite の振る舞いを確かめていた。本物の `bootstrapSchema` を通す形にした

### 5.4 前提が古くなっていた

- **sqlite-nas-sync 0.19 までの方式を前提にした検査とコメント**: 削除の順序の鍵は 0.20 から
  `_tombstone._sns_ts` で、`deletedAt` ではない。`deletePropagation` の時刻の検査を書き直し、
  ライブラリを通っていなかった検査を削除した。「途中で UNIQUE 違反になると同期が止まる」という
  コメントは、根拠を手元の SQLite の UNIQUE に改めた（置換の計画が衝突を避ける必要は今もある）
- **migration を `;` で分割して当てる前提**: deployer は `db.exec` で当てる。分割の健全性を
  確かめる検査を削除し、`promoteCoursework` も本番と同じ当て方にした
- **撤去済みの `"manual"` 型のデータソース**: `gradeItemCrud` と `gradeCalculator` のテスト内の
  互換層を片付けた
- **撤去済みの API のモック**: `mockElectronAPI` の `exportExam`
- **古い `{ success, data }` の封筒を返すモック**: `useImportWizard` の一部
- **撮影の spec が掴む文言**: 共有のプロファイル化で消えた「同期フォルダ」を掴んでいた

### 5.5 規約テストの一覧が空振り・陳腐化していた

- `publicUserOmit`（§3）
- `ipcBoundaryConventions` の `UNCALLED_PRELOAD_METHODS` に、既に呼ばれている `getScopes`
- `rowTypeConventions` の解答用紙作成の例外2件が、外しても違反0件
- `scoringKeyGuards` の when 句の走査が、when を組み立てる `scoringKeybindings.ts` を
  見ておらず、6つの文脈のうち3つを検出できていなかった
- `uuidIdCoverage` の正規表現が `@default` の無い id しか拾わず、`cuid()` 等を見逃していた

### 5.6 重複・名前と中身の食い違い

同じ振る舞いを同じ粒度で見ている it は片方に寄せ、名前が言う性質を確かめていない it は
表明を足すか名前を直した。例: `ImportWizardModal` IM-8、`buildGridLayout`、
`stage1Grading` の it.each（`stage1ResponseRules` と重複）、`syncServiceFoldIntegration`
（`twoClientSync` と重複）、`grade/integration/manualScoreCrud.test.ts`（中身は境界と並べ替え
だったので `gradeItemCrud` へ統合）。

---

## 6. 残したもの

| 対象                                                         | 理由                                                                                         |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| devDependency の `shadcn`                                    | UI 部品を足す CLI。コードからは参照しないので knip には未使用と出る                          |
| `unifiedArchiveExportWorker.ts`                              | `scripts/buildMain.js` の別エントリ。knip の誤検知                                           |
| `check:hooks` が挙げる `useExamAccess` の返り値              | `access.tabs` の形で使われている。スクリプトが分割代入しか見ない誤検知                       |
| `editorActions.test.ts` の「触っていない大問が参照ごと残る」 | `definitionTree.ts`・`definitionReducer.ts` が掲げる設計上の約束を、フックの返り値で見ている |
| 定数の既定値を固定するテスト（`answerOverlayLength` 等）     | 仕様として決めた値を固定する意味がある                                                       |

### 別件として残る課題

- **複数正解の設問で、正解をすべて正しく塗った答案が「保留」になる。** `choiceEvaluation.ts` は
  2つ以上塗られたセルの信頼度を正解の数にかかわらず一律 0.3 にしており、既定のしきい値
  （0.7）を下回る。部分点の答案（塗りが1つ）は保留にならないので、満点の答案だけが人の確認へ
  回る。`reevaluateResults.test.ts` が現状の挙動を名指しで固定している。#1444
- **`cornerMarkerDetector` は、罫線が隅のマーカーに接していると「マーカー＋罫線」の横長の
  成分を左上として採る。** 中心は大きくずれるが、`success: true` で4隅を返す。テストは
  信頼度が低い（0.5 未満）ことを固定した。下流は信頼度を見ていないので、ずれた隅のまま読み取る。#1445

---

## 7. 今回足した、空振りを防ぐ仕組み

- `ipcBoundaryConventions`: `src/queries/` の定義が src のどこかから使われていることを確かめる。
  使われていない定義の本体にある preload 呼び出しは「呼ばれている」と数えない
- `publicUserOmit`: User を指す関連名を schema から引く。拾えていることも確かめる
- `rowTypeConventions`: 例外のそれぞれについて、外すとその場所に違反が出る（＝効いている）
  ことを確かめる
- `scoringKeyGuards`: when 句を AST で集め、走査が当該の文脈を拾えていることを確かめる

---

## 8. 次に調べるときの手順

1. knip を2回走らせる。設定はリポジトリに置かないので、毎回一時ファイルに書く
   - 起点: `src/app/**/{page,layout,error,…}.{ts,tsx}`、`electron-src/index.ts`、
     `electron-src/preload.ts`、`scripts/**`、各 config、`prisma/seed.js`、
     `__tests__/**/*.{test,spec}.{ts,tsx}` と各 globalSetup
   - `ignore`: `generated/**` `main/**` `**/*.d.ts`
   - 2回目は `__tests__` を起点からも project からも外し、`"vitest": false, "playwright": false`
     を付ける（付けないと vitest 連携がテストを起点に戻す）。1回目との差分が
     「テストからしか使われないもの」
2. 未使用の export は「同じファイル内で使われている（export だけ余計）」と「完全に未参照」に
   分けてから扱う。前者を消すと機能が壊れる
3. `npm run check:hooks`。`result.current.x` や `access.x` の形は拾えない
4. 規約テストの一覧（ホワイトリスト・例外）に載る名前が実在し、例外が実際に効いているかを見る
5. 「読み込み前に既定値を見ていないか」「時刻やデータの都合で分岐に入っていないか」は、
   機械的な走査では見つからない。読む
