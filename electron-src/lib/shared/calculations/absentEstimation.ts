/**
 * 欠測時の代替スコア推定
 * rawScoreMap には推定前の実スコアのみが格納される（循環推定の防止）。
 * - zero: 0点
 * - average: 同一生徒の他DataSource比率の平均 × 満点
 * - regression: OLS重回帰による予測。多重共線性（合計＝小計の和など）で線形従属になった
 *   説明変数はランク落ちで除外して残りの独立列で継続する。独立列が1つも残らない場合や
 *   サンプル不足の場合のみ average にフォールバックする。
 */

import type {
  AbsentMethod,
  EstimationDroppedPredictor,
  EstimationFallbackReason,
  EstimationRegressionTerm,
  EstimationSourceContribution,
} from "../../../../src/types/grade.types"
import type { DataSourceInfo } from "./gradeCalculatorTypes"

/**
 * 欠測推定の生の結果（乗率・加減点の適用前）。
 * gradeCalculator が乗率・加減点を適用して最終的な EstimationDetail を組み立てる。
 */
export interface AbsentEstimation {
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
}

/**
 * 欠測時の代替スコアを推定
 */
export function estimateAbsentScore(
  method: AbsentMethod,
  studentId: string,
  dataSourceId: string,
  maxScore: number,
  rawScoreMap: Map<string, Map<string, number | null>>,
  allDataSources: DataSourceInfo[]
): AbsentEstimation | null {
  if (method === "zero") {
    return { value: 0, effectiveMethod: "zero" }
  }
  if (method === "average") {
    return estimateByAverage(
      studentId,
      dataSourceId,
      maxScore,
      rawScoreMap,
      allDataSources
    )
  }
  if (method === "regression") {
    return estimateByRegression(
      studentId,
      dataSourceId,
      maxScore,
      rawScoreMap,
      allDataSources
    )
  }
  return null
}

/**
 * 平均比率推定: 同じ生徒の他DataSourceのスコア比率(score/maxScore)を平均
 * → 平均比率 × 当該DataSource.maxScore
 */
function estimateByAverage(
  studentId: string,
  dataSourceId: string,
  maxScore: number,
  rawScoreMap: Map<string, Map<string, number | null>>,
  allDataSources: DataSourceInfo[]
): AbsentEstimation | null {
  const studentScores = rawScoreMap.get(studentId)
  if (!studentScores) return null

  const averageSources: EstimationSourceContribution[] = []
  let ratioSum = 0

  for (const dataSource of allDataSources) {
    if (dataSource.id === dataSourceId) continue
    if (dataSource.maxScore <= 0) continue
    const score = studentScores.get(dataSource.id)
    if (score === null || score === undefined) continue
    const ratio = score / dataSource.maxScore
    averageSources.push({
      id: dataSource.id,
      name: dataSource.name,
      score,
      maxScore: dataSource.maxScore,
      ratio,
    })
    ratioSum += ratio
  }

  if (averageSources.length === 0) return null
  const averageRatio = ratioSum / averageSources.length
  return {
    value: clamp(averageRatio * maxScore, 0, maxScore),
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
  studentId: string,
  dataSourceId: string,
  maxScore: number,
  rawScoreMap: Map<string, Map<string, number | null>>,
  allDataSources: DataSourceInfo[]
): AbsentEstimation | null {
  // predictor ID → 表示名（説明変数の項名に使う）
  const nameByDataSourceId = new Map(
    allDataSources.map((dataSource) => [dataSource.id, dataSource.name])
  )

  // 他DataSourceのID一覧（predictor変数）
  const predictorDsIds = allDataSources
    .filter(
      (dataSource) => dataSource.id !== dataSourceId && dataSource.maxScore > 0
    )
    .map((dataSource) => dataSource.id)

  if (predictorDsIds.length === 0) return null

  // 対象生徒のpredictor値を取得
  const targetStudentScores = rawScoreMap.get(studentId)
  if (!targetStudentScores) return null

  // 対象生徒が持っているpredictorのみを使用
  const availablePredictors = predictorDsIds.filter((id) => {
    const score = targetStudentScores.get(id)
    return score !== null && score !== undefined
  })

  if (availablePredictors.length === 0) return null

  // 訓練データ収集: 他の生徒で、当該DSと全available predictorのスコアが揃っている行
  const X: number[][] = [] // 各行 = [1, x1, x2, ...] (切片含む)
  const Y: number[] = []

  for (const [otherStudentId, scores] of rawScoreMap) {
    if (otherStudentId === studentId) continue
    const y = scores.get(dataSourceId)
    if (y === null || y === undefined) continue

    const row: number[] = [1] // 切片項
    let complete = true
    for (const predId of availablePredictors) {
      const x = scores.get(predId)
      if (x === null || x === undefined) {
        complete = false
        break
      }
      row.push(x)
    }
    if (!complete) continue

    X.push(row)
    Y.push(y)
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
      studentId,
      dataSourceId,
      maxScore,
      rawScoreMap,
      allDataSources,
      "insufficient_samples"
    )
  }

  // 独立な説明変数が1つも残らない（切片のみ）＝回帰不能 → 平均比率法にフォールバック
  if (retainedColumns.length <= 1) {
    return fallbackToAverage(
      studentId,
      dataSourceId,
      maxScore,
      rawScoreMap,
      allDataSources,
      "singular_matrix"
    )
  }

  // 独立列だけで正規方程式を解く（この部分行列は正則）
  const reducedBeta = solveNormalEquations(X, Y, retainedColumns)
  if (!reducedBeta) {
    return fallbackToAverage(
      studentId,
      dataSourceId,
      maxScore,
      rawScoreMap,
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
  const xTarget = [1]
  for (const predId of availablePredictors) {
    xTarget.push(targetStudentScores.get(predId)!)
  }

  let predicted = 0
  for (let j = 0; j < p; j++) {
    predicted += beta[j] * xTarget[j]
  }

  // 採用列（beta[0]=切片、beta[index+1]=predictor indexの係数）は regressionTerms、
  // ランク落ち除外した従属列は droppedPredictors に回す。
  const regressionTerms: EstimationRegressionTerm[] = []
  const droppedPredictors: EstimationDroppedPredictor[] = []
  availablePredictors.forEach((predId, index) => {
    const column = index + 1
    const name = nameByDataSourceId.get(predId) ?? predId
    if (retainedColumnSet.has(column)) {
      regressionTerms.push({
        id: predId,
        name,
        value: targetStudentScores.get(predId)!,
        coefficient: beta[column],
      })
    } else {
      droppedPredictors.push({
        id: predId,
        name,
        value: targetStudentScores.get(predId)!,
      })
    }
  })

  return {
    value: clamp(predicted, 0, maxScore),
    effectiveMethod: "regression",
    intercept: beta[0],
    regressionTerms,
    ...(droppedPredictors.length > 0 && { droppedPredictors }),
  }
}

/**
 * 重回帰法がサンプル不足/特異行列で平均比率法に落ちた場合の共通処理。
 * averageの推定結果にフォールバック理由を付与して返す。
 */
function fallbackToAverage(
  studentId: string,
  dataSourceId: string,
  maxScore: number,
  rawScoreMap: Map<string, Map<string, number | null>>,
  allDataSources: DataSourceInfo[],
  reason: EstimationFallbackReason
): AbsentEstimation | null {
  const fallback = estimateByAverage(
    studentId,
    dataSourceId,
    maxScore,
    rawScoreMap,
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
