# main 側の計算専用 IPC 撤去 実装計画（#1117 の残件）

## 1. 背景

`docs/coding-style.md:352-361` に次の規約がある。

> DB で管理されるデータを **計算した値** を使いたい場合：
>
> 1. **原則そのコンポーネント内で計算する**。renderer にデータが揃っていれば再フェッチにはならない（禁止なのは「データ不足で再クエリ／再フェッチ」する方）。**main 側で特殊な計算をして専用 IPC を生やさない。**

規約どおりの実装は既に存在する。`shared/calculations/itemAnalysis.ts` / `spAnalysis.ts` / `numericStats.ts` は純粋関数で、`useItemAnalysis.ts:9` / `useSpAnalysis.ts:11` / `computeReportData.ts:17` が renderer から直接 import している。これが目標形である。

一方で、main 側に計算を置いた IPC が残っていた。#1117 でそのうち 2 件を撤去した。本書は残る 3 件の計画である。

### 判定基準

**計算値を main で作って renderer へ渡していないか**で判定する。作っていれば違反。

> **⚠️ 2026-08-02 訂正**
>
> 当初は「renderer が入力データを既に持っているか。持っておらず DB の集計（count / 存在判定）が
> 必要なら正当」としていた。**この但し書きが誤り。** 件数も存在判定も計算値であり、
> 「集約だから例外」は規約のどこにも書かれていない。判定者が作った例外だった。
> 下表の「正当」4 件は保留に落とし、§8 の基準で再判定する。

| 判定   | 対象                                                                   | 状態                      |
| ------ | ---------------------------------------------------------------------- | ------------------------- |
| 違反   | `grade:calculateSourceMaxScore`                                        | ✅ #1117 で撤去           |
| 違反   | `get-exam-progress`                                                    | ✅ #1117 で撤去           |
| 違反   | `export:getIndividualReportData`（統計計算部のみ）                     | ✅ 撤去済み（§2）         |
| 違反   | `grade:calculateGrades` / `grade:computeSourceFits`                    | **§3・§9**                |
| 誤検出 | `export.onExportProgress`                                              | ✅ 撤去済み（§4）         |
| 保留   | `export:getExcelPreviewData`                                           | 再判定（§8）。旧判定は §5 |
| 保留   | `get-exam-decision-summary`                                            | 再判定（§8）。旧判定は §5 |
| 保留   | `getStudentAnswerScoreSummary`                                         | 再判定（§8）。旧判定は §5 |
| 保留   | `grade:classroomRemovalPreview` / `coursework:classroomRemovalPreview` | 再判定（§8）。旧判定は §5 |
| 違反   | `_count`（本番 9 箇所）                                                | ✅ 撤去済み（§8.2）       |
| 違反   | 縮小射影 `select`（280 箇所 / 52 ファイル）                            | ✅ 撤去済み（§8.3）       |

§5 には当初の調査記録（実装の所在・入力の内訳）を残してある。結論は採らないが、再調査の手間は省ける。

---

## 2. `export:getIndividualReportData` の統計計算部

### 2.1 現状

`electron-src/lib/export/individual-report/dataFetcher.ts:45-237` の DB 取得部は正当。問題は `statisticsCalculator.ts:303-409` の `calculateStatisticsForStudent` で、**DB に一切触れない完全な純粋計算**である。

そして main は同じ応答の中に **計算の元データも同梱している**。

- `rawTotalScores`（`statisticsCalculator.ts:381-389`）— 全生徒の studentId / totalScore / status / className / grade
- `subtotalRawScores`（同 179-220）

コメントにも「renderer 側での統計再計算用」と明記されている（同 176, 380）。

### 2.2 二重実装になっている

`src/components/exams/08-export/components/individual-report/computeReportData.ts:54-136` の `computeFilteredStats` が、overall の average / stdDev / total、学級ごとの average / stdDev / deviation / total / rank、personal の deviation / overallRank を **同じ式で再計算**している。プリミティブ（`numericStats`）は共有しているが、集計ロジックは別実装。

箱ひげ図も同様。main の `subtotalStatistics`（`statisticsCalculator.ts:137-173`）に対し `BoxPlotChart.tsx:79-89` が `computeFilteredSubtotalStats` で再計算し、`statistics.classrooms` はラベル供給にしか使われていない。

**しかも消費経路は全て renderer 版を通る。** `IndividualReportPreview.tsx:88` と `generatePrintHtml.ts:182` の両方が `computeReportData` を経由し、main の値が使われるのは「フィルタ全 ON」の短絡時（`computeReportData.ts:61-63`）だけである。

つまり **main 側の統計値は実質デッドで、二重実装が変更未追従を招くリスクだけが残っている**。

### 2.3 対応

`getExamProgressSource` と同じ形にする。main は元データだけを返し、計算は renderer の 1 本に寄せる。

**返すもの（元データ）**

- `rawTotalScores`
- `subtotalRawScores`
- `classrooms`（classroomId / className / grade / memberStudentIds の所属情報のみ）
- `questionCorrectRates` 等

**返さなくするもの（計算結果）**

- `statistics.overall` / `statistics.personal` / `statistics.classrooms` の数値
- `subtotalStatistics` の統計値

**削除**

- `statisticsCalculator.ts` の `calculateStatisticsForStudent`

**テスト**

- 検証は `__tests__/calculations/computeReportData.test.ts` へ寄せる
- 箱ひげ図の `computeFilteredSubtotalStats` にも同様の固定を追加する

### 2.4 対象外

`calculateQuestionCorrectRates` / `calculateQuestionScoreRates` は main 側に残した。renderer は全受験者の設問別得点を持たず、素点を渡すと受験者数×設問数のペイロードになるため、判定基準の「正当」側に落ちる。`shared/calculations/itemAnalysis.ts:151-211` と式が重なるが、**意図的な別実装である旨がコメントに明記されている**（`itemAnalysis.ts:13-14`「消費者・集計セマンティクスが異なるため別実装」）ので統合しない。

### 2.5 実施結果

計画どおり実施。加えて次を処理した。

- **応答が O(N²) だった**: `dataFetcher.ts:177,194` が生徒ごとに `calculateStatisticsForStudent` を呼び、戻り値の `rawTotalScores` / `subtotalRawScores` / `subtotalStatistics` は全生徒で同一だった。母集団を `ReportPopulation` として試験に 1 つへ引き上げ、重複を解消（120 名なら 14,400 行 → 120 行）
- **消費者ゼロのフィールドを削除**: `overall.boxPlot` / `ClassroomStatisticsEntry.boxPlot` / `SubtotalStatistics.stdDev` / `subtotalGroupName` / `RawTotalScoreEntry.className`・`grade`
- **受験状態フィルタの 4 重実装**を `isIncludedStatus` へ集約
- **`calculateDiscriminationIndices` / `getDiscriminationLevel` を削除**: 本番参照ゼロで、テストだけが生かしていた（`itemAnalysis.ts:61` が同一ロジックの private 版を別に持つ）。規約 §210 に従い `discriminationIndex.test.ts` ごと撤去

`computeFilteredStats` の返り値には型名を付けていない（規約 §358）。名前を付けたのは IPC 境界を越える `ReportPopulation` / `ReportClassroom` / `ReportSubtotal` のみ。

---

## 3. `grade:calculateGrades` / `grade:computeSourceFits`

### 3.1 現状

`electron-src/lib/shared/calculations/gradeCalculator.ts`（761 行）が `shared/calculations/` に置かれながら `import prisma from "../../prisma/client"`（同 17 行）しており、**取得と計算が融合**している。そのため renderer から呼べず、専用 IPC が 2 本生えている。

| 行      | 区分                                                            |
| ------- | --------------------------------------------------------------- |
| 39–192  | 取得（`buildGradeCalcContext` 前半。Prisma 直叩き 4 箇所）      |
| 168–185 | 計算（`resolveEffectiveScores`。純粋だが取得内に混在）          |
| 194–200 | 取得（間接。`computeLiveMaxScore` を D 回 await）               |
| 203–222 | 計算（`dataSourceInfos` 組み立て）                              |
| 224–258 | 計算だが await あり（`getRawScore` が subtotal 型で DB を引く） |
| 297–358 | 計算（`computeSourceFits`。DB 依存は 303 の context 構築のみ）  |
| 382–736 | 計算（`calculateGrades`。DB 依存は 394 の context 構築のみ）    |

**継ぎ目は 2 本ある。**

### 3.2 `prisma.` 直接呼び出し

- `gradeCalculator.ts:41` `prisma.grade.findUnique`
- 同 `:93` `prisma.gradeStudent.findMany`
- 同 `:132` `prisma.examStudent.findMany`（E 回ループ内）
- 同 `:160` `prisma.examPage.findMany`（同上）

### 3.3 間接 DB アクセス（本命の落とし穴）

1. **`:199` → `computeLiveMaxScore`**（`gradeDataSource.ts:491-560`）— D 回
2. **`:230` → `getRawScore` → `calculateSubtotalScoreBySubtotalId` → `getCropSubtotalsBySubtotalId`**（`cropSubtotal.ts:179`）
   生徒ループ（`:227`）× データソースループ（`:229`）の内側にあり、**N×D 回の DB クエリが飛んでいる**。分割の副産物としてここが消えるのは、それ自体で実利がある。
3. **`questionScore.ts:93` `calculateActualScore` は純粋関数だが置き場所が `prisma/` 配下**
   `examScoreCalculator.ts:10` と `subtotalCalculator.ts:9` が import しており、そのファイルは `questionScore.ts:8` で prisma を import している。
   → **`shared/calculations/` の中に「renderer から import できない」モジュールが既に 3 つある**（`examScoreCalculator` / `subtotalCalculator` / `rawScoreCalculator`）。`itemAnalysis` / `spAnalysis` が renderer から呼べているのは、この鎖に触れていないから。

### 3.4 暗黙の順序依存（分割で静かに壊れる箇所）

計算部は context 以外に依存しない（グローバル・環境変数・時刻の参照なし）。ただし **入力の順序が結果を変える**箇所が 3 つある。

- `:96` の `orderBy: [{customOrder}, {createdAt}]` が `rawScoreMatrix.rows` の順序を決め、`absentEstimation` の equipercentile / zscore / regression が行順に依存する
- `:55` の `estimationSources: { orderBy: { order: "asc" } }` が `estimationSourceIds`（`:204-206`）の順序を決める
- ~~`gradeItems[].boundaries` の並びが上方修正／下方修正の矢印を決めていた~~ → **前提工事として解消済み（下記）**

取得側の `orderBy` を 1 つも落とさないこと。

#### ✅ 境界ラベルの順序依存は解消済み（§3 の前提工事）

3 点目だけは性質が違った。他の 2 つは「順序が結果を変える」が、これは **順序に意味を持たせてしまっていた**。

`gradeCalculator.ts` のソートは並べ替えているだけで、**ラベル判定のアルゴリズム自体は降順に依存していなかった**。しかも `minPercentage` を出力に含めているので、**順序の根拠は renderer まで届いていた**。それを `ResultsTable` の `boundaries.map((boundary) => boundary.label)` が捨て、`EditableGradeLabel` が配列添字で復元していた。

**「配列の先頭ほど上位の評価」という取り決めはどこにも書かれていなかった。** 型にも、DB 制約にも、テストにもない。成立していたのは `calculateGrades` がたまたま降順に並べているからだけで、ソートを持ち回っても脆さがそのまま移動するだけだった。

対応（実施済み）: `boundaryLabels: string[]` ではなく boundary の実体を渡し、**`minPercentage` の大小で方向を判定する**。

```ts
// 上方修正 = 上書き先のほうが要求得点率が高い
const originalBoundary = boundaries.find(
  (boundary) => boundary.label === originalLabel
)
const overrideBoundary = boundaries.find(
  (boundary) => boundary.label === overrideLabel
)
```

これで配列順は純粋な表示順に戻り、**ソートをどこに置くか・落とすかが結果に影響しなくなった**。§3 の Step 5-6 でファイルを動かす際のリスクが 1 つ消えている。

規約 §178「id ではなく実体を持つ原則」の適用例でもある（`.map((e) => e.label)` で潰した情報を添字で復元していた）。

**副次的に潜在バグも消えた**: `indexOf` はラベル**文字列**で引いていたため、同一ラベルの境界が 2 つあると常に先頭がヒットして方向判定が狂う。`GradeItemBoundary.label` に unique 制約は無い（`label` は人が付ける名前で、端末をまたいで独立に同じ値が入りうる。unique にすると衝突が「別の境界が同じ鍵になった」を意味し、同期のマージが畳むと別物が 1 つに潰れる — 規約は「uuid 以外を unique にしない」）ので、DB 上は重複しうる。

実施内容:

- `EditableGradeLabel.tsx` に純粋関数 `resolveOverrideDirection(originalLabel, overrideLabel, boundaries)` を切り出し、`minPercentage` の大小で判定
- 得点率が同じ別ラベル同士は `fixed`（水準が動いていないため）。旧実装は配列位置しだいで `up`/`down` を返していた
- `ResultsTable` の `boundaryLabelsMap` と警告コメントを撤去し、`gradeItem.boundaries` をそのまま渡す
- `__tests__/renderer/grades/overrideDirection.test.ts` を新設。**並びを降順・シャッフル・昇順に変えても判定が変わらないことを固定**した

### 3.5 context の大きさ

N=対象者, I=評価項目, D=データソース, E=参照試験, Q=設問/試験, K=資料の評価項目, B=境界

| 部分                                               | 行数オーダー          |
| -------------------------------------------------- | --------------------- |
| `examDataCache` の questionScores                  | **O(E·N·Q)** ← 支配項 |
| `examDataCache` の scoreDecisions                  | **O(E·N·Q)**          |
| `examDataCache` の cropRegions                     | O(E·Q)                |
| `grade` の coursework scores                       | O(D·K·N)              |
| `gradeStudents`（overrides + frozen + exclusions） | O(N·I)                |
| `boundarySets`                                     | O(I·B)                |
| **`rawScoreMatrix`（縮約後）**                     | **O(N·D)**            |

実数感（N=120, E=5, Q=40, D=20, I=5）: 取得側 ≈ 24,000 + 24,000 行、縮約後 ≈ 2,400 セル。**縮約率 20 倍以上。**

`rawScoreMatrix` は Map を内部に持つ**クラスインスタンス**（`rawScoreMatrix.ts:54`）。structured clone は Map を運べるがメソッドは失う。境界を跨ぐなら `RawScoreRow[]` を運んで受信側で再構築する。

### 3.6 Decimal 境界

この経路を通る Decimal 列。

| モデル.フィールド                   | schema 行 |
| ----------------------------------- | --------- |
| `GradeDataSource.weight`            | 948       |
| `GradeDataSource.absentRatio`       | 951       |
| `GradeDataSource.absentOffset`      | 952       |
| `GradeBoundary.minPercentage`       | 1103      |
| `GradeFrozenScore.weightedScore`    | 1075      |
| `GradeFrozenScore.weightedMaxScore` | 1077      |
| `GradeFrozenScore.percentage`       | 1079      |
| `CourseworkItem.maxScore`           | 1203      |
| `CourseworkScore.score`             | 1221      |
| `CourseworkScore.adjustment`        | 1223      |
| `CourseworkLetterScale.score`       | 1242      |
| `QuestionScore.partialScore`        | 288       |
| `ScoreDecision.score`               | 311       |

**経路外**（混同注意）: `ReturnSnapshot.totalScore`(373) / `CompoundAnswerScore.partialScore`(750) / `GradeConstraint.tolerance`(797) / `GradeConstraintLabelValue.value`(849)。制約評価は既に renderer 側（`src/lib/gradeConstraints.ts`）で別 IPC。

**現行コードは全 Decimal 参照点で `Number()` を挟んでいる**ので、`Decimal` / `number` / `"12.5"` のいずれが来ても動く。取得の出口で `serializePrisma` を 1 回通せば足りる（`grade.ts:86` の `hydrateGrade(serializePrisma(grade))` と同じ作法）。

**未確認のリスク**: `subtotalCalculator.ts:16-19` の `QuestionScoreForSubtotal` は `partialScore?: number | null` と型で主張しているが実体は Decimal。`calculateActualScore` が `Number()` するので現状は無害だが、MEMORY の「Decimal 列追加時の serialize 漏れ」と同型の罠が潜在している。

### 3.7 呼び出し元 3 系統

| 呼び出し元                                 | 現状                                             | 分割後                                                                              |
| ------------------------------------------ | ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `gradeHandlers.ts:425-431`                 | `calculateGrades` / `computeSourceFits` の 2 IPC | **削除**。`grade:getCalcInput`（取得のみ）1 本へ。計算は renderer の `useMemo`      |
| `export/gradeExcel/gradeDataFetcher.ts:20` | `await calculateGrades(gradeId)`                 | main 内なので IPC 不要。`fetchGradeCalcInput` → `computeGrades` の 2 行に変わるだけ |
| `prisma/gradeFrozenScore.ts:53`            | `calculateGrades(gradeId, {applyFrozen:false})`  | 同上。`applyFrozen` は純粋関数の引数のまま残る                                      |

**後 2 者は main 内で完結するので IPC ペイロードのコストを一切払わない。** これが分割の勝ち筋で、renderer だけが payload を負う。

renderer 側の消費者: `useGradeResults.ts:32` / `useDataSources.ts:25` / `ConstraintRulesEditor.tsx:96`

**副次的な利得**: 現在 `useGradeResults` は上書き 1 セル編集のたびに `calculateGrades` を IPC 往復している。renderer 側計算にすれば境界編集・上書き編集が**再フェッチなしで即時再計算**になる。

### 3.8 分割案

`shared/calculations/gradeDataSourceMaxScore.ts`（#1117 で新設）が**まさにこの形の前例**。純粋ルール関数＋ main 側の DB ラッパという型を、成績算出全体へ広げる。

```
electron-src/lib/shared/calculations/          ← 純粋のみ。prisma を一切 import しない
├── actualScore.ts            [新規 ~40行]  questionScore.ts:93-123 を移設
├── gradeCalcInput.ts         [新規 ~130行] GradeCalcInput 型（計算が必要とする全入力の形）
├── rawScoreMatrixBuilder.ts  [新規 ~110行] gradeCalculator.ts:194-268 の純粋版
├── gradeCalculator.ts        [改修 761→~470行] computeGrades(input, opts) / computeSourceFits(input)
├── subtotalCalculator.ts     [改修 300→~360行] 純粋版を追加（既存 async 版は出力系のため残す）
├── rawScoreCalculator.ts     [改修 async→sync]
└── examScoreCalculator.ts    [改修 import 先のみ]

electron-src/lib/prisma/
├── gradeCalcFetcher.ts       [新規 ~190行] gradeCalculator.ts:39-200 + prefetch
├── gradeCalculation.ts       [新規 ~45行]  calculateGrades(gradeId) = fetch + compute
└── questionScore.ts          [改修 -31行]  calculateActualScore を移設

src/hooks/grades/
└── useGradeCalculation.ts    [新規 ~75行]  getCalcInput 1回 + useMemo(computeGrades)
```

### 3.9 IPC 境界の 2 案

| 案    | 内容                                                                                | ペイロード | 評価                                                   |
| ----- | ----------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------ |
| **A** | `grade:getCalcInput` が生の取得結果を返し、renderer が `computeGrades` を丸ごと実行 | O(E·N·Q)   | main に計算が一切残らない。`itemAnalysis` と同じ姿     |
| B     | main が `rawScoreMatrix` まで縮約し、renderer は推定・重み付け・境界だけ実行        | O(N·D)     | 素点組み立て（＝計算）が main に残るので違反が半分残る |

**A で進め、Step 6a で実測して閾値を超えたら B へ落とす。** A/B の差は「fetch が縮約関数を 1 個呼ぶか否か」だけなので、純粋化さえ済んでいれば後から切り替えられる（Step 1–5 は A/B 共通の投資）。

### 3.10 段階的な移行手順

各ステップ後に `npm run check-all` と `npx vitest run` が緑になる単位。

**Step 1 — `calculateActualScore` を純粋モジュールへ**（小）
`questionScore.ts:93-123` → `shared/calculations/actualScore.ts`。re-export は作らない（規約）。
更新: `questionScore.ts` / `pdfExport.ts:15` / `scoreDecisionSummary.ts:19` / `subtotalCalculator.ts:9` / `examScoreCalculator.ts:10` / テスト 2 本。
→ `examScoreCalculator.ts` が renderer 安全になる。

**Step 2 — `subtotalCalculator` に純粋版を追加**（中）
`:220` / `:34` から DB 呼び出し（`:47`, `:90`, `:233`）を引数へ外出しした純粋版を**追加**（既存 async 版は薄いラッパにして `pdfExport.ts:320` / `individual-report/dataFetcher.ts:285` / `excel/dataFetcher.ts:342` をそのまま生かす）。
→ 追加のみなので既存テストは無傷。**R1 のクロス試験ケースをここで新規テスト追加。**

**Step 3 — `getRawScore` を同期化**（中）
`rawScoreCalculator.ts:47-102` に `cropSubtotalsBySubtotalId: Map` を引数追加し `async` を外す。
→ **N×D 回の DB クエリが消える。**

**Step 4 — 満点を prefetch + 純粋算出へ**（小）
`:197-200` の `computeLiveMaxScore` ループを、`gradeDataSourceInclude` 同梱 payload からの `computeMaxScoreFromPayload`（`gradeDataSourceMaxScore.ts:40`）へ置換。
→ `:18` の import が消える。

**Step 5 — 取得と計算をファイル分割**（大・本丸）

1. `:39-200` を `prisma/gradeCalcFetcher.ts` の `fetchGradeCalcInput(gradeId)` へ移設。出口で `serializePrisma`。**`orderBy` は 1 つも落とさない**（§3.4）
2. `:203-268` を `rawScoreMatrixBuilder.ts` の `buildRawScoreMatrix(input)` へ（純粋・同期）
3. `gradeCalculator.ts` を `computeGrades(input, options?)` / `computeSourceFits(input)` に。prisma import 消滅
4. `prisma/gradeCalculation.ts` に合成版を置き、`gradeDataFetcher.ts:7,20` / `gradeFrozenScore.ts:15,53` / 統合テスト 3 本の import 先を差し替え。**IPC はまだ変えない**
5. `gradeCalculator.test.ts` のモック 3 本（`:13`, `:19`, `:47`）を撤去し、`buildGrade` ヘルパーの出力を `GradeCalcInput` として直接渡す形へ。**このステップの作業量の大半はここ**

→ 4 の時点で規約違反は「専用 IPC が残っていること」だけになり、統合テストは import パス変更のみで緑。

**Step 6 — IPC の付け替え**（中）

- **6a（先に計測）**: 一時的に `grade:getCalcInput` を生やし、行の入ったDBで `JSON.stringify(input).length` と renderer 実行時間を測る。A/B の判断はここ
- 6b: `useGradeCalculation.ts` を追加し、renderer 消費者 3 箇所を移行
- 6c: `gradeHandlers.ts` / preload の `gradeApi.ts` から該当チャンネルを削除。`npx knip` で残骸確認

### 3.11 リスク

| #   | リスク                                                                                                                              | 検証方法                                                                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | `getRawScore` 同期化で subtotal のクロス試験フィルタ（`subtotalCalculator.ts:242-249`。SubtotalGroup が複数試験で共有される）を壊す | `__tests__/calculations/subtotalCalculator.test.ts:73-220`。**「同一 SubtotalGroup を 2 試験で共有」ケースは既存テストに無いので新規追加が必要** |
| R2  | 行順依存（§3.4）。`orderBy` を落とすと推定値が静かに変わる                                                                          | `__tests__/grade/unit/gradeCalculator.test.ts:559-1194`                                                                                          |
| R2b | 境界ラベルの並び（§3.4 の3点目）。上方/下方修正の矢印が添字判定なので、ソートを落とすと表示だけ壊れる                               | **既存テスト無し。** 前提工事（`minPercentage` 比較化）を先に済ませれば本リスク自体が消える。工事時に方向判定のテストを追加する                  |
| R3  | `applyFrozen`。`gradeFrozenScore.ts:53` が `false` で呼ぶ契約を壊すと再確定が確定値を焼き直すだけになる                             | `__tests__/grade/integration/gradeFrozenScore.test.ts`                                                                                           |
| R4  | `isStale` 判定の丸め（`:361` `roundForCompare`、`:654-657`）。Decimal→number の経路が変わると `sameNumber` が誤検知しうる           | 同上。Decimal を string で渡す経路を作らない                                                                                                     |
| R5  | `estimationSources`（`:55`, `:204-206`, `:330-342`）の順序と兄弟除外（`siblingGroupKey` `:276-288`）が IPC 越しで崩れる             | **`computeSourceFits` の直接ユニットテストは存在しない。新規に必要**                                                                             |
| R6  | `treatExpectedAsMissing`（`:238-251`）。`ExamStudent.status` を select から落とすと見込→欠測が効かなくなる                          | `__tests__/grade/integration/gradeExamStudentScope.test.ts`                                                                                      |
| R7  | `RawScoreMatrix` がクラス（`rawScoreMatrix.ts:49`）。IPC を跨ぐとメソッドが消える                                                   | 行配列だけを運び受信側で再構築                                                                                                                   |
| R8  | `Date` → ISO 文字列。`serializePrisma.ts:33` が `Date` を string にする                                                             | `GradeCalcInput` 型で `frozenAt: Date \| string` を明示                                                                                          |
| R9  | IPC ペイロード肥大（案 A の場合）                                                                                                   | Step 6a で実測                                                                                                                                   |
| R10 | 削除漏れ。IPC を消すなら handler / preload / d.ts を同時に                                                                          | `npx knip`                                                                                                                                       |

### 3.12 既存テストで守られている範囲

| ファイル                                                | 行数 | 守っているもの                                                                                                                                       | 分割での扱い                                                                                      |
| ------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `grade/unit/gradeCalculator.test.ts`                    | 1667 | `calculateGrades` 全般。ただし prisma client を丸ごと `vi.mock`（`:47-64`）し、`subtotalCalculator`(`:13`) と `calculateActualScore`(`:20`) もモック | **最大の改修対象**。分割後は `GradeCalcInput` フィクスチャを直接渡せるのでモック 3 本が全部消える |
| `grade/integration/gradeExamStudentScope.test.ts`       | 165  | 実 DB。孤児採点行が算入されないこと                                                                                                                  | import パス変更のみ                                                                               |
| `grade/integration/gradeCourseworkStudentScope.test.ts` | 155  | 実 DB。名簿外生徒の点数が混ざらないこと                                                                                                              | 同上                                                                                              |
| `grade/integration/gradeFrozenScore.test.ts`            | 369  | 確定・解除・再確定・stale                                                                                                                            | 同上                                                                                              |
| `calculations/subtotalCalculator.test.ts`               | —    | `getCropSubtotals*` をモックして小計計算                                                                                                             | 純粋版のテストへ寄せる                                                                            |
| `calculations/scoreResolution.test.ts`                  | —    | リゾルバ・旧 status 耐性                                                                                                                             | 影響なし                                                                                          |

**ノーガード領域**（grep で 0 件確認済み）: `computeSourceFits` の単体テスト、`buildGradeCalcContext` の直接テスト。

### 3.13 規模

| 区分                  | 件数                 | 行数オーダー                            |
| --------------------- | -------------------- | --------------------------------------- |
| 新規ファイル          | 6（うち renderer 1） | +約 590 行                              |
| 改修（electron-src）  | 9                    | 純減 約 −250 行                         |
| 改修（renderer）      | 4                    | ±約 80 行                               |
| テスト改修            | 2                    | 約 200 行                               |
| テスト新規（R1 / R5） | 2                    | +約 150 行                              |
| **合計**              | **約 23 ファイル**   | **churn 約 1,300 行 / 純増 約 +550 行** |

IPC 面積は **−2 本 / +1 本**。

**Step 1–4 は独立して価値がある**（N×D クエリ削減・renderer 安全なモジュールの拡大）ので、Step 5–6 に踏み切らなくても単体でマージできる構成にしてある。

---

## 4. `export.onExportProgress` のデッドコード撤去

### 4.1 現状

preload に受信側だけがある（`electron-src/preload-apis/exportApi.ts:131-143`）。`"export-progress"` を `webContents.send` する箇所は**リポジトリ全体に 0 件**。したがって `useExportPage.ts:318-321` のリスナーは**一度も発火しない**。

`exportHandlers.ts:427-429` に理由が残っている。

> プログレスコールバックは渡さない（React側で管理するため）… Electron側のprogressCallbackはReact側のプログレス更新と競合し、プログレスバーが0%にリセットされて2周する問題を引き起こしていた

意図的に送信側を止めた残骸である。

### 4.2 対応

- `exportApi.ts:131-143` の `onExportProgress` / 対応する removeListener を削除
- （`src/types/electron/` の手書き契約は廃止済み。preload から署名が導出されるので、削除は登録簿と preload の2箇所で完結する）
- `useExportPage.ts:318-321` のリスナー登録を削除
- `npx knip` で残骸確認

規約「使われていないコードは削除する。コメントアウトして残さない」に従う。

### 4.3 規模

小。

---

## 5. 「正当」と判定した 5 件 ── **この判定は撤回する**

> **⚠️ 2026-08-02 訂正**
>
> 当初この節は「renderer に入力データが無く、DB の集計（count / 存在判定）が必要なら正当」と
> 判定していた。**この基準が誤り。** 件数は計算値であり、それを main が作って renderer へ渡すのは
> 規約 §352-361（計算は原則そのコンポーネント内で行う／main に計算専用の経路を生やさない）
> そのものの違反である。「集約だから別物」という例外は規約のどこにも無く、判定者が作った例外だった。
>
> このコードベースには既に正しい方針が明記されている ── `gradeDataSource.ts:84`
> 「`_count` ではなく行を渡し切って renderer で `.length` を取る」。方針は決まっており、
> 適用が徹底されていないだけだった。
>
> **各件の再判定は §8 で行う。** 以下は当初の調査記録として残す（実装の所在と入力の内訳は
> 再調査の手間を省くのに有用なため）。ただし末尾の「正当」という結論は採らないこと。

### `export:getExcelPreviewData`

- 実装: `exportHandlers.ts:338-405` → `export/excel/dataFetcher.ts:73-225`
- 08-export が保持するのは Exam と ExamStudent 一覧だけ（`useExportPage.ts:277-297`）。QuestionScore / ScoreDecision / CropRegion / CropSubtotal を一切持たない
- ScoreDecision は **preload API 自体が存在しない**
- むしろこの IPC は「元データを返して renderer が派生計算する」正しい形の入口として機能しており、`useItemAnalysis.ts:9,24-38` が返却値から項目分析を renderer 側で算出している

### `get-exam-decision-summary`

- 実装: `scoreDecisionSummary.ts:25-344`
- 入力が「**全採点者**の QuestionScore ＋ ScoreDecision ＋ CropRegionAssignment ＋ UserExam ＋ 答案画像の distinct 受験者」
- 07 画面が読む QuestionScore は**ログインユーザー分のみ**（`ScoringData/utils/dataLoader.ts:11-19`）。競合検出には他採点者の行が必須で、構造的に持てない
- main 側に列を絞る性能上の判断コメントあり（`:47-48`「試験全体で数万行になりうるので、リゾルバに要る列だけを引く」、`:185`）

### `getStudentAnswerScoreSummary`

- 実装: `studentAnswer/crud.ts:547-576`、実体は `countStudentAnswerScoreData`（同 479-542）
- **ほぼ count / distinct findMany 4 本**。純粋計算は `hasScoreData` の OR 判定 3 行だけ
- 呼び出し側にも理由が明記（`DeleteConfirmationModal.tsx:58-59`「全マス分を先読みすると採点データ量に比例して重くなる」）

### `grade:classroomRemovalPreview` / `coursework:classroomRemovalPreview`

- 実装: 双方とも `rosterManager.ts:300-319`（実体は `computeExclusiveStudents` 同 268-294）
- `StudentClassroomMembership` を 2 回引いて差集合の件数を返すだけ
- **実削除 `rosterRemoveClassroom`（同 334-336）と同一関数で件数を出しており、予告と実行の一致が保証されている。** renderer 再実装はこの一致を壊す
- main は grade 未登録の学級在籍者も母数に含む（`:273-279`）ので、renderer の grade 生徒集合とは母集団が一致しない

---

## 6. 付随して見つかった別件（本計画の対象外）

規約判定とは独立した論点。着手する場合は別 issue を立てる。

1. **削除プレビューの件数が過大になりうる**
   `rosterManager.ts:268-294` の `computeExclusiveStudents` は学級在籍者を GradeStudent / CourseworkStudent で絞っていない。一方 実削除は `gradeStudent.ts:237-239` で登録者のみ対象。確認モーダルの「△名が削除されます」が実際より多く出る。

2. **`shared/calculations/subtotalCalculator.ts` が非純粋**
   `:220-300` の `calculateSubtotalScoreBySubtotalId` が `shared/calculations/` にありながら DB を叩き、生徒×小計ごとに 1 クエリ発行する（`excel/dataFetcher.ts:340-347`、`individual-report/dataFetcher.ts:283-290` の二重ループ）。§3 の Step 2 で解消される。

3. **`getExcelPreviewData` の二段の縮小射影**
   `exportHandlers.ts:355-403` が `fetchExportData` の結果を IPC 用に手書きで縮小し、`useExcelPreview.ts:116-128` がさらに `ExcelPreviewRow` へ再射影している。coding-style の「表示のために小さくする縮小 Pick」に該当する形。

---

## 7. 実施済み

| 対象                         | 内容                                                                      |
| ---------------------------- | ------------------------------------------------------------------------- |
| §4 `onExportProgress`        | 送信側ゼロのデッドコードを撤去                                            |
| §2 `getIndividualReportData` | 統計算出を renderer へ。母集団を `ReportPopulation` へ引き上げ O(N²) 解消 |
| §3.4 境界ラベルの順序依存    | 添字比較 → `minPercentage` ＋ `order` 比較。前提工事として先行実施        |
| §3 Step 1                    | `calculateActualScore` を `shared/calculations/actualScore.ts` へ移設     |
| §3 Step 2                    | 小計計算の純粋版（`computeSubtotalScore` 他）を追加                       |
| §3 Step 3                    | `getRawScore` を同期化。割り当てを一括取得し N×D クエリを削減             |
| 配点未設定の既定値           | フォールバック経路だけ `points \|\| 10` だったのを `\|\| 0` へ統一        |

### 実施中に判明したこと

- **満点のライブ算出（`computeLiveMaxScore`）も `cropSubtotal` を引いている。** つまり同じ行を
  取るクエリが 2 本ある。射影（`select`）の形が違うだけで、やっていることは同じ。§8 で統合する。
- **`__tests__/grade/unit/gradeCalculator.test.ts` は subtotal 型を一度も通っていなかった。**
  全フィクスチャが `subtotalId: null` だったため。小計経路のテストを新規に追加した。

---

## 8. 実施済み: 縮小射影と `_count` の撤去

§2・§3 の作業中に、より根の深い規約違反が判明した。**用途ごとに `select` で行を細く削っているため、
同じデータを取るクエリが複数生まれ、互いに知らないまま同じ計算を二重に持っていた。**

### 8.1 判定基準

| 種別                              | 扱い     | 理由                                                        |
| --------------------------------- | -------- | ----------------------------------------------------------- |
| 行の列を削る `select`（縮小射影） | **撤去** | 規約「Prisma include の出力を射影せずそのまま持つ」に反する |
| `_count`                          | **撤去** | 件数は計算値。main で計算して渡すのは §352-361 違反         |
| 機密の除去（`User.passcode` 等）  | **残す** | §370 の「機密除去」。ただし `select` ではなく `omit` で書く |

**縮小射影と機密除去は見た目が同じで意図が違う。** 前者は表示に要る列だけを残す縮小で、
後者は渡してはいけない列だけを落とす。`omit` で書けば、コードを読んだだけで区別がつく。

### 8.2 `_count` の撤去（実施済み）

| 実装                        | 対応                                                      |
| --------------------------- | --------------------------------------------------------- |
| `grade.ts:33,71`            | `gradeStudents: true`（`gradeItems` は既に include 済み） |
| `coursework.ts` × 5         | `items` / `students` を行で同梱。`scores` 側は消費者ゼロ  |
| `gradeDataSource.ts:65`     | `scores: true`（`gradeDataSources` は消費者ゼロ）         |
| `examStudent.ts:51`         | `studentAnswerImages: true`                               |
| `studentAnswer/crud.ts:383` | 同上                                                      |

renderer 側は `.length` へ。型宣言（`grade.types` / `coursework.types` / `prismaExtensions`）から
`_count` を落とした。

**`_count.gradeDataSources` は本番・renderer とも参照ゼロだった。** 行を渡す形へ置き換えるまでもなく
撤去できた（`_count` を足すのは安いので、要るか確かめずに足されていた）。

### 8.3 縮小射影 `select` の撤去（実施済み・280 箇所 / 52 ファイル）

`electron-src` 配下の `select:` は **0 件**になった。置換の型は 3 つ。

1. **`select` を消して行ごと取る** — 存在確認（`select: { id: true }`）や監査ログの before 取得。
   `diffFields` は前後とも行そのものを渡す形に揃えた（片方だけ手書きの literal だと型が食い違う）
2. **`include` へ置換** — リレーションを辿る射影。`{ examPage: { select: { examId: true } } }`
   → `{ examPage: true }`
3. **`omit` へ置換** — `User` から `passcode` を落とす経路（描画アノテーション・監査ログ・
   採点担当・確定サマリ・招待検索・アーカイブ出力）

**副次的に消えたもの**

- `drawingAnnotation.ts` の include が経路ごとに 4 種類に分岐していた。1 つでも
  `examStudentId` を落とすと `as` で潰した型が通ってしまい、注釈が実行時に消える。
  SSOT 2 本（作成者のみ / 文脈つき）へ畳んだ
- `AnnotationWithContext` / `DrawingAnnotationWithQuestionScore` が Prisma のカラムを
  手書きで複製していた。`GetPayload<typeof include>` からの導出へ。後者は前者と同型に
  なったので撤去
- `GradeDataSourceMaxScoreRef`（縮小 Pick）と `computeLiveMaxScore` を撤去
- `GradeDataSourceWithRelations` の `exam` / `subtotal` / `cropRegion` / `coursework` が
  `Pick` で 3 列に絞られていた。include 出力からの導出へ
- `SubtotalGroupData`（手書きの縮小射影）を撤去し、Prisma の payload をそのまま持つ形へ

**Decimal の越境に注意。** 行ごと渡すと `QuestionScore.partialScore` のような Decimal が
IPC に乗る。描画アノテーションの返却経路には `serializePrisma` を追加した。

**性能について。** 行数は変わらず列が増えるだけなので、クエリの本数・結合の形は同じ。
ただし次の 2 経路はペイロードが目に見えて増える。実測して問題が出たら
「機密除去でも縮小射影でもない第三の理由」として明示的に絞り直すこと。

| 経路                      | 増える分                                     |
| ------------------------- | -------------------------------------------- |
| `exam.ts` の試験一覧      | 採点行 1 行あたり 5 列（試験数×受験者×設問） |
| `scoreDecisionSummary.ts` | 同上（試験全体で数万行になりうる）           |

### 8.4 `cropSubtotal` 2 本のクエリの統合（実施済み）

満点のライブ算出と設問割り当ての取得が、**同じ行を射影違いで 2 回引いていた**。
`Subtotal` に割り当てを同梱する SSOT include を作り 1 本へ畳んだ。

```ts
// cropSubtotal.ts
export const subtotalWithQuestionAssignmentsInclude = {
  cropSubtotals: {
    where: {
      assignmentType: "QUESTION_ASSIGNMENT",
      cropRegion: { type: "QUESTION_ANSWER" },
    },
    include: { cropRegion: { include: { examPage: true } } },
  },
} satisfies Prisma.SubtotalInclude
```

同時に消えたもの:

- `getQuestionAssignmentsBySubtotalIds`（丸ごと）
- `computeLiveMaxScore`（丸ごと。呼び出し元は成績算出 1 箇所だけだった）
- `Map<subtotalId, string[]>` と `Map<groupId, string[]>`（実体を持てば id 索引が要らない）
- `computeSubtotalScore` 内の `cropRegions.find()`（行から直接 `points` を読める）
- §3 Step 4（満点の prefetch）は不要になった

**`Map` を持ち出すこと自体が「実体ではなく id を持っている」徴候だった。** 規約 §178 は Map を
「どうしても id state なら」の逃げ道として許すだけで、本筋は最初から実体を持つこと。

純粋関数の入口も変えた。`computeSubtotalScore(examStudentId, examId, scores, questionAssignments)`
— 割り当ては id の配列ではなく行の配列で受け取る。試験横断の絞り込みは
`cropRegion.examPage.examId` で行う（従来は「その試験の設問領域 id 集合」との突き合わせだった）。

## 9. 残計画: §3 Step 4-6（成績算出の分割）

§8.4 を先にやると Step 4 は不要になる。Step 5・6 は §3.10 の記述がそのまま使える。

| Step | 内容                     | 状態                       |
| ---- | ------------------------ | -------------------------- |
| 4    | 満点の prefetch          | ✅ §8.4 で消滅（実施不要） |
| 5    | 取得と計算のファイル分割 | 未着手                     |
| 6    | IPC 付け替え             | 未着手（Step 5 の後）      |

§8 で `gradeCalculator.ts` の prisma 依存は次の 3 クエリだけになった
（`grade.findUnique` / `gradeStudent.findMany` / 試験ごとの `examStudent`・`examPage`）。
Step 5 はこの 3 本を `prisma/gradeCalcFetcher.ts` へ移すだけになる。

---

## 10. 未修正のまま残っている性能上の問題

コードレビュー（2026-08-02）で確認済み。いずれも本計画の対象外だが記録として残す。

| 箇所                                   | 内容                                                        | 由来         |
| -------------------------------------- | ----------------------------------------------------------- | ------------ |
| `subtotalCalculator.ts:95`             | 生徒×小計ごとに試験全体の採点配列を再フィルタ（二乗）       | 本計画で新設 |
| `individual-report/dataFetcher.ts:116` | 小計を 3 重に算出（`fetchExportData` の結果を捨てて再計算） | 既存         |
| `pdfExport.ts:317`                     | 採点済み答案 PDF だけ N×領域のクエリのまま                  | 既存         |

`subtotalCalculator.ts:95` は **§8.4 では解けなかった**。同梱で消えたのは配点の `find()` であって、
生徒で採点行を絞る `filter` は残っている（見込みが外れた）。生徒 id をキーにした索引を
呼び出し側で 1 回作って渡す形にしないと消えない。

---

## 11. 検証で分かった穴

**個人成績表の経路には自動テストが 1 本も無い。**

| 経路                             | テスト |
| -------------------------------- | ------ |
| `getIndividualReportData` の取得 | 0 件   |
| プレビュー描画                   | 0 件   |
| `generatePrintHtml`（PDF）       | 0 件   |

§2 は 22 ファイルを触ったが、配線は typecheck しか通っていない。**実画面での確認（プレビュー・
PDF 出力・生徒切り替え・受験状態フィルタ）が済むまで、テストが緑でも動作は保証されない。**

§8 で IPC の返却形状が広範に変わったため、**この穴は §8 の分だけ広がっている。**
特に次は自動テストが 1 本も通っていない:

| 経路                                          | 変更内容                                   |
| --------------------------------------------- | ------------------------------------------ |
| 07 採点画面の注釈（個別・グリッド・ブラウザ） | include を SSOT 2 本へ畳み、payload が変化 |
| 05 受験生徒の答案枚数列                       | `_count` → `.length`                       |
| 成績・資料の一覧／詳細の件数表示              | `_count` → `.length`                       |
| 04 設問グループの割り当ての対応表             | `cropSubtotals` 同梱で payload が変化      |

成績結果表も同様で、`resolveOverrideDirection` の純粋関数テストはあるが `ResultsTable` /
`EditableGradeLabel` の描画テストは無い。
