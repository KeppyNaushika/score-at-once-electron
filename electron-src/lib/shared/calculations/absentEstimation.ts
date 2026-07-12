/**
 * 欠測時の代替スコア推定
 * rawScoreMap には推定前の実スコアのみが格納される（循環推定の防止）。
 * - zero: 0点
 * - average: 同一生徒の他DataSource比率の平均 × 満点
 * - regression: OLS重回帰による予測（サンプル不足・特異行列時は average にフォールバック）
 */

import type { AbsentMethod } from "../../../../src/types/grade.types"
import type { DataSourceInfo } from "./gradeCalculatorTypes"

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
): number | null {
  if (method === "zero") {
    return 0
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
): number | null {
  const studentScores = rawScoreMap.get(studentId)
  if (!studentScores) return null

  let ratioSum = 0
  let ratioCount = 0

  for (const dataSource of allDataSources) {
    if (dataSource.id === dataSourceId) continue
    if (dataSource.maxScore <= 0) continue
    const score = studentScores.get(dataSource.id)
    if (score === null || score === undefined) continue
    ratioSum += score / dataSource.maxScore
    ratioCount++
  }

  if (ratioCount === 0) return null
  const avgRatio = ratioSum / ratioCount
  return clamp(avgRatio * maxScore, 0, maxScore)
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
): number | null {
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

  // 最低でも説明変数+1のサンプルが必要（＋余裕を持って）
  const minSamples = availablePredictors.length + 2
  if (X.length < minSamples) {
    // サンプル不足の場合、平均比率法にフォールバック
    return estimateByAverage(
      studentId,
      dataSourceId,
      maxScore,
      rawScoreMap,
      allDataSources
    )
  }

  // OLS: β = (X^T X)^(-1) X^T Y
  const p = X[0].length // パラメータ数（切片含む）
  const beta = solveOLS(X, Y, p)
  if (!beta) {
    // 特異行列の場合、平均比率法にフォールバック
    return estimateByAverage(
      studentId,
      dataSourceId,
      maxScore,
      rawScoreMap,
      allDataSources
    )
  }

  // 対象生徒のpredictor値で予測
  const xTarget = [1]
  for (const predId of availablePredictors) {
    xTarget.push(targetStudentScores.get(predId)!)
  }

  let predicted = 0
  for (let j = 0; j < p; j++) {
    predicted += beta[j] * xTarget[j]
  }

  return clamp(predicted, 0, maxScore)
}

/**
 * OLS正規方程式を解く: β = (X^T X)^(-1) X^T Y
 * ガウス消去法で (X^T X) β = X^T Y を解く
 */
function solveOLS(X: number[][], Y: number[], p: number): number[] | null {
  const n = X.length

  // X^T X (p×p)
  const XtX: number[][] = Array.from({ length: p }, () => Array(p).fill(0))
  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) {
      let sum = 0
      for (let k = 0; k < n; k++) {
        sum += X[k][i] * X[k][j]
      }
      XtX[i][j] = sum
    }
  }

  // X^T Y (p)
  const XtY: number[] = Array(p).fill(0)
  for (let i = 0; i < p; i++) {
    let sum = 0
    for (let k = 0; k < n; k++) {
      sum += X[k][i] * Y[k]
    }
    XtY[i] = sum
  }

  // 拡大係数行列 [XtX | XtY] → ガウス消去法
  const aug: number[][] = XtX.map((row, i) => [...row, XtY[i]])

  for (let col = 0; col < p; col++) {
    // ピボット選択
    let maxRow = col
    let maxVal = Math.abs(aug[col][col])
    for (let row = col + 1; row < p; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col])
        maxRow = row
      }
    }
    if (maxVal < 1e-12) return null // 特異行列

    // 行交換
    if (maxRow !== col) {
      ;[aug[col], aug[maxRow]] = [aug[maxRow], aug[col]]
    }

    // 前進消去
    const pivot = aug[col][col]
    for (let row = col + 1; row < p; row++) {
      const factor = aug[row][col] / pivot
      for (let j = col; j <= p; j++) {
        aug[row][j] -= factor * aug[col][j]
      }
    }
  }

  // 後退代入
  const beta = Array(p).fill(0)
  for (let i = p - 1; i >= 0; i--) {
    if (Math.abs(aug[i][i]) < 1e-12) return null
    let sum = aug[i][p]
    for (let j = i + 1; j < p; j++) {
      sum -= aug[i][j] * beta[j]
    }
    beta[i] = sum / aug[i][i]
  }

  return beta
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
  const adjusted = estimated * ratio + offset
  return Math.round(clamp(adjusted, 0, maxScore) * 100) / 100
}

/**
 * 値を[min, max]範囲にクランプ
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
