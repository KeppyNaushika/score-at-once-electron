/**
 * 欠測推定の重回帰法（OLS）と、データソースのモデル適合度 R。
 *
 * どちらも「他ソースの素点から当ソースの素点を当てる」回帰を組む。数値計算そのものは
 * `leastSquares.ts` にある。
 */

import type {
  EstimationDroppedPredictor,
  EstimationRegressionTerm,
} from "../../../../src/types/grade.types"
import {
  type AbsentEstimation,
  clamp,
  type EstimationMatrix,
  type EstimationRow,
  fallbackToAverage,
} from "./absentEstimationAverage"
import type { DataSourceInfo } from "./gradeCalculatorTypes"
import {
  multipleCorrelationR,
  selectIndependentColumns,
  solveNormalEquations,
} from "./leastSquares"

/**
 * OLS重回帰法推定:
 * 他の生徒のデータを訓練データとして、他DataSourceスコアから
 * 当該DataSourceスコアを予測する重回帰モデルを構築。
 * β = (X^T X)^(-1) X^T Y で係数を算出し、対象生徒のスコアを予測。
 */
export function estimateByRegression(
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
