/**
 * 欠測時の代替スコア推定
 * 素点行列（RawScoreMatrix）には推定前の実スコアのみが格納される（循環推定の防止）。
 * - zero: 0点
 * - average: 同一生徒の他DataSource比率の平均 × 満点
 * - regression: OLS重回帰による予測。多重共線性（合計＝小計の和など）で線形従属になった
 *   説明変数はランク落ちで除外して残りの独立列で継続する。独立列が1つも残らない場合や
 *   サンプル不足の場合のみ average にフォールバックする。
 *
 * 推定対象は行（対象者）と列（データソース）の実体で指定する。以前は studentId と
 * dataSourceId をそれぞれ string で受けており、取り違えても型では捕まらなかった。
 */

import type {
  AbsentMethod,
  EstimationDroppedPredictor,
  EstimationFallbackReason,
  EstimationRegressionTerm,
  EstimationSourceContribution,
} from "../../../../src/types/grade.types"
import type { DataSourceInfo } from "./gradeCalculatorTypes"
import type {
  RawScoreMatrix,
  RawScoreRow,
  RawScoreRowEntity,
} from "./rawScoreMatrix"

/** 推定は行を識別できれば足りるので、行の実体は最小限の形で受ける */
type EstimationRow = RawScoreRow<RawScoreRowEntity>
type EstimationMatrix = RawScoreMatrix<RawScoreRowEntity>

/**
 * 欠測推定の生の結果（乗率・加減点の適用前）。
 * gradeCalculator が乗率・加減点を適用して最終的な EstimationDetail を組み立てる。
 */
interface AbsentEstimation {
  /** 推定素点（内部クランプ済み、乗率・加減点適用前） */
  value: number
  /** 実際に使われた推定方法（regressionがaverageにフォールバックした場合は"average"） */
  effectiveMethod: AbsentMethod
  /** 平均比率法（フォールバック含む）で使用したソース内訳 */
  averageSources?: EstimationSourceContribution[]
  /** 平均比率法の平均比率 */
  averageRatio?: number
  /** 重回帰法の切片（β0） */
  intercept?: number
  /** 重回帰法の各説明変数の項（採用＝従属でない列のみ） */
  regressionTerms?: EstimationRegressionTerm[]
  /** 多重共線性でランク落ち除外した説明変数（従属列） */
  droppedPredictors?: EstimationDroppedPredictor[]
  /** 重回帰法がaverageにフォールバックした理由 */
  fallbackReason?: EstimationFallbackReason
  /**
   * 当てはまりの重相関 R（訓練データの実測 vs 予測、0〜1）。
   * 予測は「実力の R 倍」まで広がる縮小率そのもの。1−R が中心（平均）へ寄る度合い。
   * R=1 は定義上のつながり（合計=小計の和 等）で完全復元されている合図。
   *
   * **なぜ R で割ると散らばりが戻るのか。** OLS の予測には恒等式
   * `SD(ŷ) = R × SD(y)` が成り立つ（訓練データ上で。R は実測と予測の相関）。
   * つまり予測はいつも実測より R 倍だけ縮んでいる。したがって `1/R` を掛ければ、
   * 散らばりが実測と同じ幅まで戻る。中心（平均）は動かないので、上位は上へ、
   * 下位は下へ広がる —— 平均回帰の打ち消しは、これ1つで説明が付く。
   *
   * **素の R を使うこと。自由度補正した R では割りすぎる。** 補正済みの R は
   * 素の R より小さいので `1/R` が大きくなり、実測より広い散らばりを作ってしまう。
   * `multipleCorrelationR` が返すのは補正済みの値なので、増幅に使うなら素の R を
   * 別に取ること。
   *
   * **R が極端に小さい領域では増幅が暴れる。** 予測がほぼ無相関なのに大きく
   * 引き伸ばすことになるため。落とし先は等重み標準偏差法にする（平均比率法へは
   * 落とさない —— あちらは誤差も縮小も大きい）。
   */
  correlation?: number
  /** 標準偏差法（zscore）: 対象生徒の他ソース平均標準得点（±何SD） */
  standardizedStanding?: number
  /** 順位法（equipercentile）: 対象生徒の他ソース平均パーセンタイル（0〜1） */
  percentileRank?: number
  /** 標準偏差法・順位法の載せ替え先となる当ソース実測分布の平均 */
  targetMean?: number
  /** 標準偏差法の載せ替え先となる当ソース実測分布の標準偏差 */
  targetStandardDeviation?: number
}

/**
 * 欠測時の代替スコアを推定
 */
export function estimateAbsentScore(
  method: AbsentMethod,
  targetRow: EstimationRow,
  dataSource: DataSourceInfo,
  matrix: EstimationMatrix,
  allDataSources: DataSourceInfo[]
): AbsentEstimation | null {
  if (method === "zero") {
    return { value: 0, effectiveMethod: "zero" }
  }
  if (method === "average") {
    return estimateByAverage(targetRow, dataSource, matrix, allDataSources)
  }
  if (method === "regression") {
    return estimateByRegression(targetRow, dataSource, matrix, allDataSources)
  }
  if (method === "equipercentile") {
    return estimateByEquipercentile(
      targetRow,
      dataSource,
      matrix,
      allDataSources
    )
  }
  if (method === "zscore") {
    return estimateByZScore(targetRow, dataSource, matrix, allDataSources)
  }
  return null
}

/**
 * 当ソースを実測した他生徒の素点分布（平均・母標準偏差・整列済み素点列）。
 * 対象生徒自身は欠測なので母数から自然に外れる。標準偏差法・順位法の載せ替え先に使う。
 */
function collectTargetDistribution(
  targetRow: EstimationRow,
  dataSource: DataSourceInfo,
  matrix: EstimationMatrix
): { mean: number; sd: number; sorted: number[] } | null {
  const scores = matrix.measuredColumn(dataSource, { except: targetRow })
  if (scores.length < 2) return null
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length
  const variance =
    scores.reduce((sum, score) => sum + (score - mean) ** 2, 0) / scores.length
  const sorted = [...scores].sort((scoreA, scoreB) => scoreA - scoreB)
  return { mean, sd: Math.sqrt(variance), sorted }
}

/**
 * 説明変数1つ分。表示用の内訳（contribution）と、分布の引き直しに使う列の実体を持つ。
 * 内訳だけだと再び id 文字列からソースを引き当てる必要が生じるため実体を添える。
 */
interface PredictorContribution {
  dataSource: DataSourceInfo
  contribution: EstimationSourceContribution
}

/**
 * 対象生徒が実測を持つ他ソースを、標準偏差法・順位法の説明変数として集める。
 * average と同じく「自ソース以外・満点>0・対象生徒が実測を持つ」ソースが対象。
 */
function collectPredictorContributions(
  targetRow: EstimationRow,
  dataSource: DataSourceInfo,
  matrix: EstimationMatrix,
  allDataSources: DataSourceInfo[]
): PredictorContribution[] {
  const predictors: PredictorContribution[] = []
  for (const predictorSource of allDataSources) {
    if (predictorSource.id === dataSource.id) continue
    if (predictorSource.maxScore <= 0) continue
    const score = matrix.scoreOf(targetRow, predictorSource)
    if (score === null) continue
    predictors.push({
      dataSource: predictorSource,
      contribution: {
        id: predictorSource.id,
        name: predictorSource.name,
        score,
        maxScore: predictorSource.maxScore,
        ratio: score / predictorSource.maxScore,
      },
    })
  }
  return predictors
}

/**
 * 標準偏差法（線形イコーティング / z法）推定:
 * 対象生徒の他ソースでの平均標準得点 z̄（±何SD の立ち位置）を、
 * 当ソースを実測した生徒の実平均 μ・標準偏差 σ へ載せ替える: 予測 = μ + z̄・σ。
 * 縮小（平均回帰）を打ち消し、当ソースのバラつきを保つ。
 * どのソースにも分散が無い / 対象生徒に使える他ソースが無い場合は average にフォールバック。
 */
function estimateByZScore(
  targetRow: EstimationRow,
  dataSource: DataSourceInfo,
  matrix: EstimationMatrix,
  allDataSources: DataSourceInfo[]
): AbsentEstimation | null {
  const predictors = collectPredictorContributions(
    targetRow,
    dataSource,
    matrix,
    allDataSources
  )
  if (predictors.length === 0) return null

  // 各他ソースでの標準得点 z = (素点 − そのソースの平均) / そのソースのSD を平均する
  const zValues: number[] = []
  for (const predictor of predictors) {
    const distribution = collectTargetDistribution(
      targetRow,
      predictor.dataSource,
      matrix
    )
    if (!distribution || distribution.sd <= 0) continue
    zValues.push(
      (predictor.contribution.score - distribution.mean) / distribution.sd
    )
  }
  if (zValues.length === 0) {
    return fallbackToAverage(
      targetRow,
      dataSource,
      matrix,
      allDataSources,
      "insufficient_samples"
    )
  }

  const target = collectTargetDistribution(targetRow, dataSource, matrix)
  if (!target || target.sd <= 0) {
    return fallbackToAverage(
      targetRow,
      dataSource,
      matrix,
      allDataSources,
      "insufficient_samples"
    )
  }

  const standardizedStanding =
    zValues.reduce((sum, z) => sum + z, 0) / zValues.length
  const predicted = target.mean + standardizedStanding * target.sd

  return {
    value: clamp(predicted, 0, dataSource.maxScore),
    effectiveMethod: "zscore",
    averageSources: predictors.map((predictor) => predictor.contribution),
    standardizedStanding,
    targetMean: target.mean,
    targetStandardDeviation: target.sd,
  }
}

/**
 * 順位法（等パーセンタイル・イコーティング）推定:
 * 対象生徒の他ソースでの平均パーセンタイル（0〜1、上位ほど1）を求め、
 * 当ソース実分布の同順位の点へ変換する。分布形を保存し、縮小しない。
 * 使える他ソースが無い / 当ソースの実測が2名未満なら average にフォールバック。
 */
function estimateByEquipercentile(
  targetRow: EstimationRow,
  dataSource: DataSourceInfo,
  matrix: EstimationMatrix,
  allDataSources: DataSourceInfo[]
): AbsentEstimation | null {
  const predictors = collectPredictorContributions(
    targetRow,
    dataSource,
    matrix,
    allDataSources
  )
  if (predictors.length === 0) return null

  // 各他ソースでの対象生徒のパーセンタイル（中間順位法）を平均する
  const percentiles: number[] = []
  for (const predictor of predictors) {
    const distribution = collectTargetDistribution(
      targetRow,
      predictor.dataSource,
      matrix
    )
    if (!distribution) continue
    percentiles.push(
      percentileRankOf(predictor.contribution.score, distribution.sorted)
    )
  }
  if (percentiles.length === 0) {
    return fallbackToAverage(
      targetRow,
      dataSource,
      matrix,
      allDataSources,
      "insufficient_samples"
    )
  }

  const target = collectTargetDistribution(targetRow, dataSource, matrix)
  if (!target) {
    return fallbackToAverage(
      targetRow,
      dataSource,
      matrix,
      allDataSources,
      "insufficient_samples"
    )
  }

  const percentileRank =
    percentiles.reduce((sum, percentile) => sum + percentile, 0) /
    percentiles.length
  const predicted = quantileOf(percentileRank, target.sorted)

  return {
    value: clamp(predicted, 0, dataSource.maxScore),
    effectiveMethod: "equipercentile",
    averageSources: predictors.map((predictor) => predictor.contribution),
    percentileRank,
    targetMean: target.mean,
  }
}

/**
 * value が昇順配列 sorted の中で占めるパーセンタイル（0〜1）を中間順位法で返す。
 * = (value 未満の個数 + 同値の個数/2) / 全体数。分布の端でも 0/1 に貼り付かない。
 */
function percentileRankOf(value: number, sorted: number[]): number {
  const n = sorted.length
  if (n === 0) return 0.5
  let below = 0
  let equal = 0
  for (const score of sorted) {
    if (score < value) below++
    else if (score === value) equal++
  }
  return (below + equal / 2) / n
}

/**
 * パーセンタイル p（0〜1）に対応する昇順配列 sorted の点を線形補間で返す（順位法の逆変換）。
 * 位置 = p × (n − 1) の前後を按分する。
 */
function quantileOf(p: number, sorted: number[]): number {
  const n = sorted.length
  if (n === 0) return 0
  if (n === 1) return sorted[0]
  const clampedP = Math.max(0, Math.min(1, p))
  const position = clampedP * (n - 1)
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)
  if (lowerIndex === upperIndex) return sorted[lowerIndex]
  const fraction = position - lowerIndex
  return sorted[lowerIndex] * (1 - fraction) + sorted[upperIndex] * fraction
}

/**
 * 平均比率推定: 同じ生徒の他DataSourceのスコア比率(score/maxScore)を平均
 * → 平均比率 × 当該DataSource.maxScore
 */
function estimateByAverage(
  targetRow: EstimationRow,
  dataSource: DataSourceInfo,
  matrix: EstimationMatrix,
  allDataSources: DataSourceInfo[]
): AbsentEstimation | null {
  const averageSources = collectPredictorContributions(
    targetRow,
    dataSource,
    matrix,
    allDataSources
  ).map((predictor) => predictor.contribution)

  if (averageSources.length === 0) return null
  const averageRatio =
    averageSources.reduce(
      (sum, averageSource) => sum + averageSource.ratio,
      0
    ) / averageSources.length
  return {
    value: clamp(averageRatio * dataSource.maxScore, 0, dataSource.maxScore),
    effectiveMethod: "average",
    averageSources,
    averageRatio,
  }
}

/**
 * OLS重回帰法推定:
 * 他の生徒のデータを訓練データとして、他DataSourceスコアから
 * 当該DataSourceスコアを予測する重回帰モデルを構築。
 * β = (X^T X)^(-1) X^T Y で係数を算出し、対象生徒のスコアを予測。
 */
function estimateByRegression(
  targetRow: EstimationRow,
  dataSource: DataSourceInfo,
  matrix: EstimationMatrix,
  allDataSources: DataSourceInfo[]
): AbsentEstimation | null {
  // 他DataSource（predictor変数）のうち、対象生徒が実測を持つものだけを使う
  const availablePredictors = allDataSources.filter(
    (candidate) =>
      candidate.id !== dataSource.id &&
      candidate.maxScore > 0 &&
      matrix.scoreOf(targetRow, candidate) !== null
  )

  if (availablePredictors.length === 0) return null

  // 訓練データ収集: 他の生徒で、当該DSと全available predictorのスコアが揃っている行
  const X: number[][] = [] // 各行 = [1, x1, x2, ...] (切片含む)
  const Y: number[] = []

  for (const otherRow of matrix.rows) {
    if (otherRow.gradeStudent.id === targetRow.gradeStudent.id) continue
    const y = matrix.scoreOf(otherRow, dataSource)
    if (y === null) continue

    const row: number[] = [1] // 切片項
    let complete = true
    for (const predictor of availablePredictors) {
      const x = matrix.scoreOf(otherRow, predictor)
      if (x === null) {
        complete = false
        break
      }
      row.push(x)
    }
    if (!complete) continue

    X.push(row)
    Y.push(y)
  }

  // 訓練行が1つも集まらなければ回帰は組めない（対象生徒の説明変数を全部揃えた他生徒が
  // 居ない場合に起こる）。以降は X[0] を参照するのでここで先に落とす。
  if (X.length === 0) {
    return fallbackToAverage(
      targetRow,
      dataSource,
      matrix,
      allDataSources,
      "insufficient_samples"
    )
  }

  // OLS: β = (X^T X)^(-1) X^T Y。多重共線性がある列はランク落ちで除外して解く。
  const p = X[0].length // パラメータ数（切片含む）

  // 従属列を先に見極める。サンプル妥当性は「独立パラメータ数（＝ランク落ち後の実効自由度）」で
  // 判定する。生の説明変数数で判定すると、合計＝小計の和のように従属列を含むだけで
  // サンプル要件が跳ね上がり、ランク落ち回帰が成立するはずの境界ケースまで average に落ちてしまう。
  const retainedColumns = selectIndependentColumns(X, p)

  // 最低でも「独立パラメータ数 + 1」のサンプルが必要（残差自由度1以上）。
  // 独立列は X.length を超えられない（rank ≤ n）ので、この判定は劣決定系も自動的に弾く。
  const minSamples = retainedColumns.length + 1
  if (X.length < minSamples) {
    return fallbackToAverage(
      targetRow,
      dataSource,
      matrix,
      allDataSources,
      "insufficient_samples"
    )
  }

  // 独立な説明変数が1つも残らない（切片のみ）＝回帰不能 → 平均比率法にフォールバック
  if (retainedColumns.length <= 1) {
    return fallbackToAverage(
      targetRow,
      dataSource,
      matrix,
      allDataSources,
      "singular_matrix"
    )
  }

  // 独立列だけで正規方程式を解く（この部分行列は正則）
  const reducedBeta = solveNormalEquations(X, Y, retainedColumns)
  if (!reducedBeta) {
    return fallbackToAverage(
      targetRow,
      dataSource,
      matrix,
      allDataSources,
      "singular_matrix"
    )
  }

  // 全長 p の β に戻す（従属列＝係数0）。以降は retainedColumnSet で採用/除外を判定する
  // （列メンバーシップの単一ソース）。
  const beta = Array(p).fill(0)
  retainedColumns.forEach((column, k) => {
    beta[column] = reducedBeta[k]
  })
  const retainedColumnSet = new Set(retainedColumns)

  // 対象生徒のpredictor値で予測（従属列は係数0なので寄与しない）。
  // 構造的恒等式（合計＝小計の和）は対象生徒でも成り立つため、どの従属列を落としても予測値は不変。
  // availablePredictors は「対象生徒が実測を持つ」で絞ってあるので scoreOf は非null。
  const targetScoreOf = (predictor: DataSourceInfo): number =>
    matrix.scoreOf(targetRow, predictor) ?? 0
  const xTarget = [1, ...availablePredictors.map(targetScoreOf)]

  let predicted = 0
  for (let j = 0; j < p; j++) {
    predicted += beta[j] * xTarget[j]
  }

  // 採用列（beta[0]=切片、beta[index+1]=predictor indexの係数）は regressionTerms、
  // ランク落ち除外した従属列は droppedPredictors に回す。
  const regressionTerms: EstimationRegressionTerm[] = []
  const droppedPredictors: EstimationDroppedPredictor[] = []
  availablePredictors.forEach((predictor, index) => {
    const column = index + 1
    if (retainedColumnSet.has(column)) {
      regressionTerms.push({
        id: predictor.id,
        name: predictor.name,
        value: targetScoreOf(predictor),
        coefficient: beta[column],
      })
    } else {
      droppedPredictors.push({
        id: predictor.id,
        name: predictor.name,
        value: targetScoreOf(predictor),
      })
    }
  })

  // 当てはまりの重相関 R（自由度補正済み）＝縮小率。採用列数−1 が独立説明変数の数。
  const correlation = multipleCorrelationR(
    X,
    Y,
    beta,
    retainedColumns.length - 1
  )

  return {
    value: clamp(predicted, 0, dataSource.maxScore),
    effectiveMethod: "regression",
    intercept: beta[0],
    regressionTerms,
    ...(droppedPredictors.length > 0 && { droppedPredictors }),
    ...(correlation !== undefined && { correlation }),
  }
}

/**
 * 重回帰法がサンプル不足/特異行列で平均比率法に落ちた場合の共通処理。
 * averageの推定結果にフォールバック理由を付与して返す。
 */
function fallbackToAverage(
  targetRow: EstimationRow,
  dataSource: DataSourceInfo,
  matrix: EstimationMatrix,
  allDataSources: DataSourceInfo[],
  reason: EstimationFallbackReason
): AbsentEstimation | null {
  const fallback = estimateByAverage(
    targetRow,
    dataSource,
    matrix,
    allDataSources
  )
  if (fallback === null) return null
  return { ...fallback, fallbackReason: reason }
}

/**
 * 設計行列 X の列から線形独立な列を選ぶ（変形グラム・シュミット）。
 * 既に採用した列が張る空間への直交残差ノルムが元のノルムに対して極小な列は、
 * 従属列とみなして落とす。列0（切片）から入力順に処理する。
 * @returns 採用した列インデックスの配列（入力順、切片列0を含む）
 */
function selectIndependentColumns(
  X: number[][],
  p: number,
  relativeTolerance = 1e-8
): number[] {
  const n = X.length
  const retainedColumns: number[] = []
  const orthonormalBasis: number[][] = []

  for (let column = 0; column < p; column++) {
    const vector = X.map((row) => row[column])
    const originalNorm = Math.sqrt(
      vector.reduce((sum, value) => sum + value * value, 0)
    )
    if (originalNorm < 1e-12) continue // ゼロ列は落とす

    // 既存の正規直交基底に対して直交化した残差を求める
    const residual = vector.slice()
    for (const basisVector of orthonormalBasis) {
      let dot = 0
      for (let i = 0; i < n; i++) dot += residual[i] * basisVector[i]
      for (let i = 0; i < n; i++) residual[i] -= dot * basisVector[i]
    }
    const residualNorm = Math.sqrt(
      residual.reduce((sum, value) => sum + value * value, 0)
    )
    if (residualNorm / originalNorm < relativeTolerance) continue // 従属列 → 除外

    for (let i = 0; i < n; i++) residual[i] /= residualNorm
    orthonormalBasis.push(residual)
    retainedColumns.push(column)
  }
  return retainedColumns
}

/**
 * 指定した列サブセットだけで正規方程式 (Xr^T Xr) β = Xr^T Y を組み、ガウス消去で解く。
 * columns で選んだ独立列のみを使うため、この部分系は正則（解ければ非null）。
 */
function solveNormalEquations(
  X: number[][],
  Y: number[],
  columns: number[]
): number[] | null {
  const n = X.length
  const r = columns.length

  const XtX: number[][] = Array.from({ length: r }, () => Array(r).fill(0))
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < r; j++) {
      let sum = 0
      for (let k = 0; k < n; k++) {
        sum += X[k][columns[i]] * X[k][columns[j]]
      }
      XtX[i][j] = sum
    }
  }

  const XtY: number[] = Array(r).fill(0)
  for (let i = 0; i < r; i++) {
    let sum = 0
    for (let k = 0; k < n; k++) {
      sum += X[k][columns[i]] * Y[k]
    }
    XtY[i] = sum
  }

  return gaussianEliminationSolve(XtX, XtY, r)
}

/**
 * 連立一次方程式 A β = b をガウス消去法（部分ピボット選択）で解く。
 * ピボットが極小（特異）なら null を返す。
 */
function gaussianEliminationSolve(
  A: number[][],
  b: number[],
  m: number
): number[] | null {
  const aug: number[][] = A.map((row, i) => [...row, b[i]])

  for (let col = 0; col < m; col++) {
    // ピボット選択
    let maxRow = col
    let maxVal = Math.abs(aug[col][col])
    for (let row = col + 1; row < m; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col])
        maxRow = row
      }
    }
    if (maxVal < 1e-12) return null // 特異

    // 行交換
    if (maxRow !== col) {
      ;[aug[col], aug[maxRow]] = [aug[maxRow], aug[col]]
    }

    // 前進消去
    const pivot = aug[col][col]
    for (let row = col + 1; row < m; row++) {
      const factor = aug[row][col] / pivot
      for (let j = col; j <= m; j++) {
        aug[row][j] -= factor * aug[col][j]
      }
    }
  }

  // 後退代入
  const solution = Array(m).fill(0)
  for (let i = m - 1; i >= 0; i--) {
    if (Math.abs(aug[i][i]) < 1e-12) return null
    let sum = aug[i][m]
    for (let j = i + 1; j < m; j++) {
      sum -= aug[i][j] * solution[j]
    }
    solution[i] = sum / aug[i][i]
  }

  return solution
}

/**
 * 当てはまりの重相関 R（0〜1）を自由度補正済みで返す。訓練データの実測 vs 予測から
 * 調整済み決定係数 adjR² = 1 − (1−R²)(n−1)/(n−k−1) を出し R=√max(0, adjR²) とする。
 * 素の R²（=1−SS_res/SS_tot）は説明変数 k が多く標本 n が小さいほど1へ膨らむため、
 * 残差自由度 n−k−1 で補正して過大評価を抑える。予測は「実力の R 倍」まで広がる縮小率。
 * @param X 設計行列（各行 [1, x1, …]、切片列含む）
 * @param Y 実測値
 * @param beta 係数（全長 p、従属列は0）
 * @param predictorCount 独立な説明変数の数（切片を除く採用列数 = 採用列数−1）
 * @returns 補正済み R、または算出不能（分散ゼロ / 残差自由度なし）時 undefined
 */
function multipleCorrelationR(
  X: number[][],
  Y: number[],
  beta: number[],
  predictorCount: number
): number | undefined {
  const n = X.length
  const p = beta.length
  const meanY = Y.reduce((sum, y) => sum + y, 0) / n
  let ssRes = 0
  let ssTot = 0
  for (let k = 0; k < n; k++) {
    let fitted = 0
    for (let j = 0; j < p; j++) fitted += beta[j] * X[k][j]
    ssRes += (Y[k] - fitted) ** 2
    ssTot += (Y[k] - meanY) ** 2
  }
  if (ssTot <= 0) return undefined
  const dfResidual = n - predictorCount - 1
  if (dfResidual <= 0) return undefined // 残差自由度なし＝R²は必ず1（無意味）
  const r2 = 1 - ssRes / ssTot
  const adjustedR2 = 1 - ((1 - r2) * (n - 1)) / dfResidual
  return Math.sqrt(Math.max(0, adjustedR2))
}

/**
 * 当ソース(dataSourceId)を predictorIds からどれだけ説明できるかのモデル適合度 R（重相関、0〜1）。
 * 欠測者の有無に依らず「当ソースを実測した全生徒」で回帰を当て、実測 vs 予測の R を返す。
 * データ側の予測しやすさ＝重回帰の縮小率でもあり、手法選択時の判断材料として表示する。
 *
 * 訓練行は「当ソース＋全 predictor が揃った生徒」のみ（complete-case）。多重共線性の列は
 * ランク落ちで除外。独立列が無い / サンプル不足 / 当ソースに分散が無い場合は null。
 * @returns { correlation, sampleSize } または算出不能時 null
 */
export function computeSourceFit(
  dataSource: DataSourceInfo,
  predictors: DataSourceInfo[],
  matrix: EstimationMatrix
): { correlation: number; sampleSize: number } | null {
  if (predictors.length === 0) return null

  const X: number[][] = []
  const Y: number[] = []
  for (const row of matrix.rows) {
    const y = matrix.scoreOf(row, dataSource)
    if (y === null) continue
    const designRow: number[] = [1]
    let complete = true
    for (const predictor of predictors) {
      const x = matrix.scoreOf(row, predictor)
      if (x === null) {
        complete = false
        break
      }
      designRow.push(x)
    }
    if (!complete) continue
    X.push(designRow)
    Y.push(y)
  }

  if (X.length < 3) return null
  const p = X[0].length
  const retainedColumns = selectIndependentColumns(X, p)
  // 切片のみ（独立な説明変数ゼロ）や残差自由度が無いサンプル数では R を出さない
  if (retainedColumns.length <= 1) return null
  if (X.length < retainedColumns.length + 1) return null

  const reducedBeta = solveNormalEquations(X, Y, retainedColumns)
  if (!reducedBeta) return null
  const beta = Array(p).fill(0)
  retainedColumns.forEach((column, k) => {
    beta[column] = reducedBeta[k]
  })

  const correlation = multipleCorrelationR(
    X,
    Y,
    beta,
    retainedColumns.length - 1
  )
  if (correlation === undefined) return null

  return {
    correlation,
    sampleSize: X.length,
  }
}

/**
 * 乗率・加減点を適用した生の値（クランプ前）: estimated × ratio + offset。
 * applyAdjustmentAndClamp と結果画面の内訳表示が同じ式を共有するための単一実装
 * （表示側で式を再導出しないための SSOT）。
 */
export function adjustEstimate(
  estimated: number,
  ratio: number,
  offset: number
): number {
  return estimated * ratio + offset
}

/**
 * 調整(ratio/offset)を適用し、[0, maxScore]にクランプ
 */
export function applyAdjustmentAndClamp(
  estimated: number,
  ratio: number,
  offset: number,
  maxScore: number
): number {
  return (
    Math.round(
      clamp(adjustEstimate(estimated, ratio, offset), 0, maxScore) * 100
    ) / 100
  )
}

/**
 * 値を[min, max]範囲にクランプ
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
