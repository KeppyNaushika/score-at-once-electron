/**
 * 欠測推定の標準偏差法（zscore）と順位法（equipercentile）。
 *
 * どちらも対象生徒の他ソースでの立ち位置を、当ソースを実測した生徒の分布へ載せ替える。
 * 縮小（平均回帰）を起こさないのが重回帰法との違い。
 */

import {
  type AbsentEstimation,
  clamp,
  collectPredictorContributions,
  type EstimationMatrix,
  type EstimationRow,
  fallbackToAverage,
} from "./absentEstimationAverage"
import type { DataSourceInfo } from "./gradeCalculatorTypes"

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
 * 標準偏差法（線形イコーティング / z法）推定:
 * 対象生徒の他ソースでの平均標準得点 z̄（±何SD の立ち位置）を、
 * 当ソースを実測した生徒の実平均 μ・標準偏差 σ へ載せ替える: 予測 = μ + z̄・σ。
 * 縮小（平均回帰）を打ち消し、当ソースのバラつきを保つ。
 * どのソースにも分散が無い / 対象生徒に使える他ソースが無い場合は average にフォールバック。
 */
export function estimateByZScore(
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
export function estimateByEquipercentile(
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
