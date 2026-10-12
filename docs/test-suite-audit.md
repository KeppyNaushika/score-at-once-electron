# テストとデッドコードの全数調査

調査と対処: 2026-10-12。前回の調査（2026-08-23）で挙げた項目のうち未着手だったもの
（`cropRegionOmrConfig` の写し・`omrArchiveRoundTrip` の自作往復・表明の無い II-8/II-9/EC-7・
`idMappings.test.ts`）は、今回の対処に含めて片付けた。

同じ日に行った2回目の調査と対処は §9 にある。

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

---

## 9. 2回目の調査と対処（2026-10-12）

§1〜§7 を片付けた直後に、同じ手順（§8）でもう一度全数を見た。§8 の5「読まないと見つからない」
ものが中心で、1回目と同じ類型の、より見つけにくい版が約100点見つかった。

**§9.10「判断待ち」と §9.12「残したもの」を除き、すべて直した。** 以下の一覧は見つけた時点の
ファイル名・行番号で書いてある（直した後の名前は §9.12）。直したテストは、本番の該当箇所を
壊すと落ちる形にしてある（`spAnalysis` の並べ替え・`jsonFileStore` の書き込み順・ExecuteStep の
エラー表示は、実際に壊して落ちることを確かめた）。
確信度は（高）（中）（低）で付ける。（高）のうち ExecuteStep・jsonFileStore・`mockWizard`・
`buildGridLayout` はコードで裏を取った。

### 9.1 デッドコード・不要ファイル

- **テストからしか使われない本番コード: 0件。** テストのために export している関数は、どれも
  同じファイルの中で本番として使われている
- **export だけ余計なもの**: 値12件（shadcn の部品を除く）と型59件。どれも同じファイルの中で
  使われている。§4.3 の残り
- `check:hooks` の `useExamAccess`（`canManageExam`/`tabs`/`phases`）は §6 と同じ誤検知
- `public/`・`scripts/` は全部どこかから参照されている

| 対象                                                    | 状態                                                                                                              |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `package.json` の `db:seed` / `db:setup` / `db:reset`   | `prisma/seed.js` は 2025-08 に削除済みで、3つとも動かない。`db:setup` は Prisma 7 で動かない `migrate dev` も使う |
| `.env.test`                                             | どこからも読まれない。テスト DB は `globalSetup.ts` が `--url` で明示する                                         |
| `__tests__/setup.ts:14-15`（`DATABASE_URL`/`NODE_ENV`） | 同じ理由で効いていない。`NODE_ENV` は Vitest が既定で入れる                                                       |
| `docs/remaining-work.md` 段階71                         | 削除済みの `helpers/databasePathProbe.ts` を名指ししている                                                        |
| `.ncurc.json`                                           | npm-check-updates で Prisma を上げない設定。今も要るかは判断待ち                                                  |

### 9.2 名前の言う不具合を再現できていない

- **`tests/electron/queryCacheRegressions.spec.ts:49, 149, 176, 211`**（高）: 「画面を移って
  戻る」ときのキャッシュの不具合を捕まえる spec だが、移動が `page.goto` で文書ごと読み直す。
  `QueryClient` に永続化は無いので、移るたびにキャッシュは空になり、キーの衝突も古いキャッシュの
  持ち込みも再現しない。画面内の遷移（サイドバー等）で移る。同 `:106` は「担当でないものは
  編集を出さない」を確かめていない（高）
- **`sync/userSettingsSync.test.ts:200`**（高）: B が A の行を取り込んでから書くので、同じ行の
  普通の更新になり後勝ちが働かない。両端末で書いてから同期する（`scoringColorSync:236` の並べ方）
- **`hooks/useImportWizard.test.ts:700` IW-78**（高）: `preMatch` が失敗すると `archivePath` が
  null のまま残り、`executeImport` は手前の早期 return に入る。「事前照合データがありません」の
  分岐（`useImportWizard.ts:414-419`）には入らず、IW-77 の重複。**この分岐は本番でも到達
  できない可能性があり、本番側も見直す**
- **`localPreferenceHandover.test.tsx:223`「二度は書かない」**（高）: 2回目の描画が鍵の消えた
  後なので、`handedOverUserIds` を消しても通る。鍵を残したまま二重に描画する

### 9.3 時刻の一致で「書き換えていない」を見ている（作成と同じミリ秒で通る）

作成の直後に操作するので、誤って書き換えても同じミリ秒なら一致する。事前に `createdAt` /
`updatedAt` を過去の固定時刻へ書き換えてから比べる（`aiRubricProposalAnswer.test.ts:513` の形）。

- `answer-sheet-builder/recordWrites.test.ts:140, 159, 184`、`saveDiffUpdate.test.ts:154, 253`（中）
- `answer-sheet-builder/saveDiffUpdate.test.ts:337-356`（高）: `toBeGreaterThanOrEqual(before)` で、
  繰り上がらなくても通る
- `exam/integration/subtotalGroupUpdate.test.ts:186, 218, 245, 302`、
  `examStudentAssignment.test.ts:130`、`masterAnswerPage.test.ts:361`（中〜低）
- `grade/integration/gradeConstraintCrud.test.ts:177, 206`（低）: id を比べれば足りる
- `audit/auditLogCoverage.test.ts:124`、`user/integration/changeExamMemberRole.test.ts:250`（低）:
  立て続けに作った行を `createdAt` で並べている

### 9.4 入力がはじめから期待の順・期待の値で、検査したい処理を通っていない

- `calculations/spAnalysis.test.ts:34-96`（高）: 生徒も設問もはじめから降順。`.sort` を消しても通る
- `grade/integration/gradeStudentCrud.test.ts:175`（高）: 作成順と出席番号順が同じ
- `grade/unit/gradeResultSheet.test.ts:191`（高）: 比較列の cells が students と同じ並び。
  添字で引く実装でも通る
- `answer-sheet-builder/editorActions.test.ts:408-421`（高）: 元のラベルとプリセットが同じ値
- `omr/unit/imageProcessor.test.ts:272-286`（高）: 検査位置が白で `0 === 0`
- `omr/unit/markRecognizer.test.ts:669-684`（高）: 真っ白な画像で、しきい値によらず同じ結果
- `pdf-tools/pdfMergerNUp.test.ts:226`（高）: `1 0 0 1 0 0 cm` は位置によらず出る。`drawnPages()` で x を見る
- `import-export/unit/gradeTransformerChain.test.ts:543-567`（高）: `gradeDataSources` が空で `every` が真
- `import-export/unit/examTransformerChain.test.ts:1502-1559`（高）: 1.0.0 形に無いキー
  （`examStudents`/`examPages`/`tagsData`）を消していて3件が空振り。消すべきは `projectStudents`/`projectPages`
- `import-export/integration/scoringConflictDetector.test.ts:457-489`（高）: 受験者行・採点者の対応も
  欠けており、名前の分岐以外の理由で新規になる
- `exam/integration/studentAnswerPlacementApply.test.ts:336-357`（高）: 移動先が埋まっていて、
  carry の検査を消しても占有の検査で投げる。`toThrow(/ページを跨ぐ移動/)` にする
- `exam/integration/examDecisionSummary.test.ts:374-389`（中）: 全員に答案があり、分母の区別を見ていない
- `calculations/subtotalCalculator.test.ts:278`（高）: フォールバックを消しても例外を catch して null で通る
- `settings/jsonFileStore.test.ts:89`（高）: 失敗させているのは updater で、書き込みより前。
  `writeFile` とメモリ更新の順を入れ替えても通る。書き込みそのものを失敗させる

### 9.5 表明が弱い・読み込み前に確かめている

- **件数を固定せずループの中だけで表明**（中）: `exam/.../answerImagePayload.test.ts:54, 71`、
  `returnSnapshot.test.ts:65`、`exportScoringData.test.ts:83, 181`、`individualReportData.test.ts:189`、
  `examDecisionSummary.test.ts:384`、`aiGrading/gradingJobRunner.test.ts:309, 338`
- **文言の無い `rejects.toThrow()`**（中）: `exam/integration/examScopeGuard.test.ts:107, 133, 151`、
  `grade/integration/gradeScopeGuard.test.ts:121`、`coursework/courseworkCrud.test.ts:331`、
  `exam/unit/slotPermutation.test.ts:159`（低）、`sync/sharedProfileSetup.test.ts:284`（低）、
  `import-export/integration/idIntegrationImporter.test.ts:1086-1156` II-19（中。準備とコメントも効いていない）
- **読み込みが終わる前に「無い」を確かめる（§5.1 と同型）**: `courseworkLetterInput.test.tsx:395`（中〜高）、
  `aiExamCostBadge.test.tsx:150`（中）、`hooks/useAiGradingAvailability.test.tsx:71`（中）、
  `aiQuestionImages.test.tsx:124`（高。`toast.error` を見る）
- `hooks/useNameRegion.test.ts:97`（高）: どんな実装でも null。削除
- `hooks/useImportWizard.test.ts:266` IW-26・`:407` IW-33（高）: モックの差し替え順・初期値のままで区別できない
- `hooks/scoring/useDrawingAnnotations.test.ts:130`（中）: `create` が入力をそのまま返すので区別できない
- `sync/syncTableConfig.test.ts:46, 55`（中）: L103 が除外を `[]` に固定しているので空振り
- `sync/sharedProfileSetup.test.ts:351, 540`（中）: macOS は開いたファイルも rename・削除できる。実際の検査は `openFilesUnder`
- `omr/unit/cornerMarkerDetector.test.ts:517-616`（中〜高）: #1445 と同じ現象で、ずれた位置のまま
  `success`。同 `:218, 290, 322, 389, 460, 702, 732`（中）は位置を見ていない
- `regionInfoTable.test.tsx:182`（中）: harness 自身の state を見ており恒真
- `comboboxCheckList.test.tsx:221`（低）、`schemaBootstrap.test.ts:265`（低）、`promptBuilder.test.ts:50`（低）、
  `itemAnalysisStats.test.ts:115`（低。同点の入力順に依存）、`aiGradingRunList.test.ts:123`（中。直前の filter で必ず真）

### 9.6 名前と中身の食い違い

- `steps/ExecuteStep.test.tsx:109` EX-5（高）: 当たっているのは固定の見出しで、`state.error` を見ていない
- `combobox.test.tsx:82`（高）: placeholder を見ていない
- `import-export/integration/courseworkArchiveRoundTrip.test.ts:377`（高）: `nameCandidates` を見ていない
- `sync/studentAnswerPlacementSync.test.ts:728`（中）: 勝った行も `folds` も見ていない
- `import-export/scenarios/edgeCases.test.ts:247` EC-5（中）: どの小計に結ばれたかを見ていない
- `migration/migrationGuard.test.ts:139`（中）、`deployPendingMigrations.test.ts:325`（低）
- `masterAnswerPage.test.ts:381`（中）: 古い手元の状態を再現できず、連続した入れ替えでしかない
- `hooks/scoring/useDrawingState.test.ts:567`（中）: DB 同期を見ていない
- `aiGrading/aiGradingCalculations.test.ts:110`（中）、`classroomAverageRows.test.ts:1-8, 74`（中）、
  `audit/auditLog.test.ts:413`（中。`_` を見ていない）、`aiGradingRunList.test.ts:85`（中）
- `unifiedArchiveExportDialog.test.tsx:470`（低〜中）、`entityListPage.test.tsx:431`（低〜中）、
  `entityOverviewPageAdoption.test.ts:106`（低。ソースの書式の文字列一致）、
  `annotationPlacement.test.ts:123`、`anthropicProvider.test.ts:593`、`editorActions.test.ts:145`、
  `useAllStudentAnnotations.test.ts:60`、`asbTransformerChain.test.ts:237`（いずれも低）
- 書き出しの撤去後も名前に RoundTrip が残る: `archiveRoundTrip`・`courseworkArchiveRoundTrip`・
  `gradeArchiveRoundTrip`・`exportImportRoundTrip`（低）

### 9.7 前提が古い（§5.4 と同型）

- `renderer/helpers/mockWizard.ts:33-87` と `steps/ExecuteStep.test.tsx:48-101`（高）: `executeImport` の
  戻り値に今の型に無い `success` と、改名前の `classes`。`mockData.ts` の `createMockImportSummary()` を使う
- `import-export/integration/idChangeExecutor.test.ts:8, 263, 501`（中）: temp-value の主張が、外れた UNIQUE を前提にしている
- `sync/twoClientHarness.ts:117-124`（高）、`sync/studentAnswerPlacementSync.test.ts:657-659`（高）: 0.19 までの同期の説明
- `regionInfoTable.test.tsx:113-114`（高）: 担当列の頃の使われないモック
- `import-export/scenarios/examMergeOrSeparate.test.ts:244`（低）: Exam の列のコメントに `anonymousScoringEnforced` が無い
- `sync/twoClientHarness.ts:135` の `blockingWarnings` は `"Sync failed"` を拾わない。
  `studentAnswerPlacementSync.test.ts:133` の `fatalWarnings` へ統合する（中）

### 9.8 重複

- `answer-sheet-builder/buildGridLayout.test.ts`: L742=L380（高。名前も食い違う）、L235=L547、
  L839=L460、L854=L940（高）、L755≒L363、L262≒L563（中）
- `manuscriptWidth.test.ts:389`（中）、`verticalTransform.test.ts:40`（高）
- `omr/unit/reevaluateResults.test.ts:262`（高）: 消し跡の規則を切り分けているのは L272
- `aiGrading/stage1ResponseRules.test.ts:117`（高）、`calculations/examPaperSize.test.ts:13/22`（高）
- `aiQuestioning.test.tsx:872, 1339`（中。`:1312`・`:1332` と重複し、戻る方向も見ていない）
- `import-export/integration/archiveRoundTrip.test.ts:66` RT-1（中。RT-F の部分集合）
- `unifiedArchiveImport.test.ts:251` と `unifiedArchiveRoundTrip.test.ts:136`（中）
- `grade/unit/gradeDetailSheet.test.ts:157/184`（中）
- 低: `individualReportData:178`/`exportScoringData:173`、`studentAnswerDelete:225, 355, 445`、
  `preMatching` PM-1/3/4/9、`unifiedArchiveScope:238`/`unifiedArchiveCreate:260`、
  `entityOverviewPage:314/391, 347`、`auditLog:216/636`、`changeExamMemberRole:113/135`、
  `routeShell:46`、`gradeWriteLock:68`/`queryClientMutationMeta:203`、`otsuThreshold:17, 20`（定数の写し）

### 9.9 使われない準備・ヘルパー

- `aiGrading/helpers/aiGradingFixture.ts:131, 175` の `cancelBatch`（高）
- `edgeCases.test.ts:450-490` EC-8 の `scoringConflicts` と、ここだけが使う
  `testDataFactory.createScoringConflict`（低。§5.2 のとおり取り込みの判断に使われない）
- `cornerMarkerDetector.test.ts` が `/tmp/omr-test-*.png` を消さない

### 9.10 判断待ち

- **import の B5（重複回避の後置き `_1`・` (2)`）**: `studentProcessor.test.ts:503-584`・
  `classroomProcessor.test.ts:405-478` が固定している。避けていた UNIQUE はもう無く、
  `duplicateHumanKeys.test.ts` は「同じ値が並ぶのが正常」としている。仕様として残すか
  → **裁定: やめる。** 新規作成する生徒・学級はアーカイブの値のまま作り、id で区別する。
  同一人物か同姓同名かを見分けにくいなら、それは取り込みと名簿の UI で直す（§9.12）
  同じ理由で、旧形式の取り込みが試験名（「別の試験として取り込む」）と小計グループ名に付けていた
  ` (2)` もやめた。同じグループの中の小計の名前も同じ。見分ける材料は UI で出す（#1452）
- `.ncurc.json` → 削除した（Prisma 6 の頃に 7 へ上がらないよう止めた設定で、役目を終えていた）
- `.ncurc.json`（§9.1）
- 撤去済みの部品・列が戻っていないことを見る見張り（`regionInfoTable:189`、
  `entityListPage:230`、`entityOverviewPageAdoption:80, 100, 132`）を残すか
  → `entityListPage:230` だけ削除した（`entityListPageAdoption` の「「詳細」の語を残さない」が
  ソースで同じことを見ている）。残りは設計の判断を守る見張りとして残す
- `gradeCalculator.test.ts` の `buildGrade` が、撤去済みの `GradeDataSource.maxScore` を載せている（低）
  → 判断の要らない取り残しだったので直した（coursework 型の参照先の満点にだけ使う）

### 9.11 1回目の類型で、今回は0件だったもの

規約テストの一覧に載る名前（`rowTypeConventions`・`ipcBoundaryConventions`・
`normalizeDatetime` の `POST_MIGRATION_TABLES` ほか・`gradeWriteLockTables`）はすべて実在し、
外すと違反が出る（効いている）。skip / todo / コメントアウトされたテスト、内部の状態を見る
テスト、撤去済みの機能を見るテスト、使われていないフィクスチャは無かった。

参考: migration の回帰テスト11本が、migration 前の DB を組む手順を写して持ち、本番の
`applyMigrationSql`（外部キー OFF）を通さずに当てている。今の対象は自分で外部キー OFF を
敷くので実害は無い。共通の helper にまとめて本番の当て方を通すのが望ましい。

### 9.12 対処の記録と、残したもの

**名前を変えたファイル**（中身は取り込みだけで、往復していなかった）:
`archiveRoundTrip` → `examArchiveExtract`、`courseworkArchiveRoundTrip` → `courseworkArchiveImport`、
`gradeArchiveRoundTrip` → `gradeArchiveImport`、`exportImportRoundTrip` → `examArchiveImport`。

**本番を変えたもの**:

- `useImportWizard.ts` の `executeImport` から、到達できない「事前照合データがありません」の分岐を
  消した（`archivePath` と `fileOverviewData` は `loadExamArchive` が必ず揃えて入れる）
- PDF ツールの並び順と、その材料（出力モード・交互挿入の設定）を1つの組 `PageArrangement` で持ち、
  操作ごとの移り変わりを `outputPageOrder.ts` の関数にした。テストが画面の処理を写さずに本番を通す
- migration の回帰テスト11本の「migration 前の DB を組む手順」を `__tests__/helpers/preMigrationDatabase.ts`
  にまとめ、本番の deployer と `applyMigrationSql` を通すようにした
- export だけ余計だった69件の `export` を外した。`package.json` の `db:*` 3つと `.env.test` を消した

**後から直したもの**（同じ時期に別の作業が同じファイルを変えていたため、その作業の後に直した）:

- `aiQuestionImages.test.tsx:124` は拒否の `toast.error` を見る。`useAiGradingAvailability.test.tsx:71` は
  同じキャッシュの見張りで状態が届いたことを待ってから見る。どちらも本番を壊して落ちることを確かめた
- `MasterStatus` の余計な `export` を外した。`AUDIT_TARGET_TYPES` は型を作るためだけの配列だったので、
  `AuditTargetType` を直接の union にした

**対処の途中で新しく見つかったこと**:

- `cornerMarkerDetector` は、マーカーが探索範囲からはみ出すと見えている部分の中心を返し、
  それでも `success` になる（A3 で 7px、答案が下へ 15px ずれると下の2隅が 7.5px）。#1445 に追記した
- 個人成績表の `buildSubtotalScoresFromGroups`（`individual-report/dataFetcher.ts`）と Excel の
  `buildSubtotalScores`（`excel/dataFetcher.ts`）が同じ中身の写しになっていた。個人成績表は先に
  Excel 側の `fetchExportData` を呼んでおり、同じ入力で計算済みの小計を DB から引き直して
  再計算していた。個人成績表側の再計算を消し、Excel 側の結果をそのまま使うようにした
- B5 をやめたことで、取り込みと名簿の UI に見分ける材料が足りない点がはっきりした:
  - 旧形式の取り込みの照合行（`MatchedItemRow.tsx`）は既存側の情報を一つも出さない
    （`existingData` を受け取っているのに描いていない）。候補が複数あっても選べず、
    未照合の生徒・学級を既存へ手で紐づける口も無い（小計グループだけにある）
  - 統合アーカイブの取り込み（`ArchiveMatchRow.tsx`）は、候補が1件のとき紐づけ先の添え書きを
    出さない。生徒の添え書きはカナだけで、入学年度・所属学級が無い。学級に人数・作成日が無い
  - 名簿と選択欄（`StudentTableRow.tsx`・`ClassroomManagementRow.tsx`・`searchKeywords.ts`）は、
    番号・氏名・入学年度が同じ2人、コード・学年まで同じ同名の学級を見分ける材料を出さない
