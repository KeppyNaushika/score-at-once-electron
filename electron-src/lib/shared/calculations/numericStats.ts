/**
 * 数値統計のプリミティブ（平均・標準偏差・中央値・箱ひげ図・順位）
 *
 * 個人成績表（statisticsCalculator / computeReportData）と Excel 学級平均行
 * （averageRows）で同一実装を共有し、複数箇所での再実装ドリフトを防ぐ。
 * いずれも全数調査（試験の成績）向けの母集団統計。
 */

/** 箱ひげ図データ（Tukey法） */
export interface BoxPlotData {
  min: number
  q1: number
  median: number
  q3: number
  max: number
}

/** 母集団の平均（空配列は0） */
export function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/** 母標準偏差（空配列は0） */
export function stdDev(values: number[]): number {
  if (values.length === 0) return 0
  const avg = average(values)
  const squaredDiffs = values.map((value) => (value - avg) ** 2)
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length)
}

/** ソート済み配列の中央値（空配列は0） */
function median(sortedValues: number[]): number {
  const n = sortedValues.length
  if (n === 0) return 0
  if (n === 1) return sortedValues[0]
  const mid = Math.floor(n / 2)
  if (n % 2 === 0) {
    return (sortedValues[mid - 1] + sortedValues[mid]) / 2
  }
  return sortedValues[mid]
}

/**
 * 箱ひげ図データを計算（Tukey法）
 * データを下位半分と上位半分に分けてそれぞれの中央値を Q1/Q3 とする。
 * n が奇数の場合、中央値は両半分から除外する。
 */
export function boxPlot(values: number[]): BoxPlotData {
  if (values.length === 0) {
    return { min: 0, q1: 0, median: 0, q3: 0, max: 0 }
  }
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  const midIndex = Math.floor(n / 2)
  const lowerHalf = sorted.slice(0, midIndex)
  const upperHalf = sorted.slice(n % 2 === 0 ? midIndex : midIndex + 1)
  return {
    min: sorted[0],
    q1: median(lowerHalf),
    median: median(sorted),
    q3: median(upperHalf),
    max: sorted[n - 1],
  }
}

/** 順位（同点同順位。降順ソートで score 以下になる最初の位置+1） */
export function rank(score: number, allScores: number[]): number {
  const sorted = [...allScores].sort((a, b) => b - a)
  return sorted.findIndex((value) => value <= score) + 1
}
