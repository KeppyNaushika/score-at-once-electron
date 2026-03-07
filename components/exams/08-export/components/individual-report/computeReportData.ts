/**
 * 個人成績表の共通計算ロジック
 * プレビュー（React）とPDF出力（renderToStaticMarkup）の両方で使用
 */
import type {
  IndividualReportData,
  IndividualReportOptions,
  StatisticsData,
  SubtotalRawScores,
  SubtotalStatistics,
} from "@/electron-src/lib/export/individual-report/types"
import type { SubtotalScore } from "@/electron-src/lib/shared/types/exportTypes"

/** 受験状態フィルタ */
export interface BoxPlotIncludeStatuses {
  participating: boolean
  expected: boolean
  absent: boolean
}

/** 計算済み小計統計データ */
export interface ComputedSubtotalStat {
  subtotalId: string
  subtotalLabel: string
  subtotalGroupId: string
  boxPlot: { min: number; q1: number; median: number; q3: number; max: number }
  average: number
  maxScore: number
}

/** グループ化された小計データ */
export interface GroupedSubtotalData {
  groupId: string
  groupName: string
  items: SubtotalScore[]
  totalScore: number
  totalMaxScore: number
}

// ============================
// 統計フィルタリング
// ============================

/**
 * 受験状態フィルタ付きで統計を再計算
 */
export function computeFilteredStats(
  report: IndividualReportData,
  statuses: BoxPlotIncludeStatuses
): StatisticsData {
  const raw = report.statistics.rawTotalScores
  if (!raw || raw.length === 0) return report.statistics

  const includeAll =
    statuses.participating && statuses.expected && statuses.absent
  if (includeAll) return report.statistics

  const filterByStatus = (entries: typeof raw) =>
    entries.filter((e) => {
      if (e.status === "participating") return statuses.participating
      if (e.status === "expected") return statuses.expected
      if (e.status === "absent") return statuses.absent
      return true
    })

  const filteredAll = filterByStatus(raw)
  const allScores = filteredAll
    .map((e) => e.totalScore)
    .filter((s): s is number => s !== null)

  const filteredClass = filteredAll.filter(
    (e) =>
      e.className === report.studentInfo.className &&
      e.grade === report.studentInfo.grade
  )
  const classScores = filteredClass
    .map((e) => e.totalScore)
    .filter((s): s is number => s !== null)

  const avg = (arr: number[]) =>
    arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length
  const stdDevFn = (arr: number[]) => {
    if (arr.length === 0) return 0
    const a = avg(arr)
    return Math.sqrt(arr.reduce((s, v) => s + (v - a) ** 2, 0) / arr.length)
  }
  const rankFn = (score: number, scores: number[]) => {
    const sorted = [...scores].sort((a, b) => b - a)
    return sorted.findIndex((s) => s <= score) + 1
  }

  const overallAvg = avg(allScores)
  const overallStd = stdDevFn(allScores)
  const studentScore = report.scoringData.totalScore
  const deviation =
    studentScore === null || overallStd === 0
      ? studentScore === null
        ? 0
        : 50
      : Math.round(((studentScore - overallAvg) / overallStd) * 10 + 50)

  return {
    ...report.statistics,
    overall: {
      ...report.statistics.overall,
      average: overallAvg,
      stdDev: overallStd,
      total: filteredAll.length,
    },
    class: {
      ...report.statistics.class,
      average: avg(classScores),
      stdDev: stdDevFn(classScores),
      total: filteredClass.length,
    },
    personal: {
      ...report.statistics.personal,
      deviation,
      overallRank: studentScore !== null ? rankFn(studentScore, allScores) : 0,
      classRank: studentScore !== null ? rankFn(studentScore, classScores) : 0,
    },
  }
}

// ============================
// 箱ひげ図統計計算
// ============================

function calculateMedian(sortedValues: number[]): number {
  const n = sortedValues.length
  if (n === 0) return 0
  if (n === 1) return sortedValues[0]
  const mid = Math.floor(n / 2)
  if (n % 2 === 0) {
    return (sortedValues[mid - 1] + sortedValues[mid]) / 2
  }
  return sortedValues[mid]
}

function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function calculateBoxPlotData(values: number[]) {
  if (values.length === 0) {
    return { min: 0, q1: 0, median: 0, q3: 0, max: 0 }
  }
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  const min = sorted[0]
  const max = sorted[n - 1]
  const median = calculateMedian(sorted)
  const midIndex = Math.floor(n / 2)
  const lowerHalf = sorted.slice(0, midIndex)
  const upperHalf = sorted.slice(n % 2 === 0 ? midIndex : midIndex + 1)
  const q1 = calculateMedian(lowerHalf)
  const q3 = calculateMedian(upperHalf)
  return { min, q1, median, q3, max }
}

/**
 * 小計点箱ひげ図の統計を受験状態フィルタ付きで再計算
 */
export function computeFilteredSubtotalStats(
  rawScores: SubtotalRawScores[],
  subtotalStatistics: SubtotalStatistics[],
  includeStatuses: BoxPlotIncludeStatuses
): ComputedSubtotalStat[] {
  const includeAll =
    includeStatuses.participating &&
    includeStatuses.expected &&
    includeStatuses.absent

  return subtotalStatistics.map((stat) => {
    const rawData = rawScores.find((r) => r.subtotalId === stat.subtotalId)

    if (!rawData || includeAll) {
      return {
        subtotalId: stat.subtotalId,
        subtotalLabel: stat.subtotalLabel,
        subtotalGroupId: stat.subtotalGroupId,
        boxPlot: stat.boxPlot,
        average: stat.average,
        maxScore: stat.maxScore,
      }
    }

    const filteredScores = rawData.scores
      .filter((s) => {
        if (s.status === "participating") return includeStatuses.participating
        if (s.status === "expected") return includeStatuses.expected
        if (s.status === "absent") return includeStatuses.absent
        return true
      })
      .map((s) => s.score)
      .filter((s): s is number => s !== null)

    if (filteredScores.length === 0) {
      return {
        subtotalId: stat.subtotalId,
        subtotalLabel: stat.subtotalLabel,
        subtotalGroupId: stat.subtotalGroupId,
        boxPlot: { min: 0, q1: 0, median: 0, q3: 0, max: 0 },
        average: 0,
        maxScore: stat.maxScore,
      }
    }

    return {
      subtotalId: stat.subtotalId,
      subtotalLabel: stat.subtotalLabel,
      subtotalGroupId: stat.subtotalGroupId,
      boxPlot: calculateBoxPlotData(filteredScores),
      average: calculateAverage(filteredScores),
      maxScore: stat.maxScore,
    }
  })
}

/**
 * 合計点箱ひげ図の統計を受験状態フィルタ付きで計算
 */
export function computeFilteredOverallStat(
  rawTotalScores: {
    studentId: string
    totalScore: number | null
    status: "participating" | "expected" | "absent"
  }[],
  totalMaxScore: number,
  includeStatuses: BoxPlotIncludeStatuses
): ComputedSubtotalStat {
  const filteredScores = rawTotalScores
    .filter((s) => {
      if (s.status === "participating") return includeStatuses.participating
      if (s.status === "expected") return includeStatuses.expected
      if (s.status === "absent") return includeStatuses.absent
      return true
    })
    .map((s) => s.totalScore)
    .filter((s): s is number => s !== null)

  return {
    subtotalId: "__overall__",
    subtotalLabel: "合計点",
    subtotalGroupId: "__overall__",
    boxPlot:
      filteredScores.length > 0
        ? calculateBoxPlotData(filteredScores)
        : { min: 0, q1: 0, median: 0, q3: 0, max: 0 },
    average: calculateAverage(filteredScores),
    maxScore: totalMaxScore,
  }
}

// ============================
// 小計点テーブル計算
// ============================

/**
 * 小計点スコアをフィルタリング
 */
export function filterSubtotalScores(
  subtotalScores: SubtotalScore[],
  groupSelection?: { enabled: boolean; selectedGroupIds: string[] },
  hideUnassigned?: boolean
): SubtotalScore[] {
  let scores = subtotalScores

  if (groupSelection?.enabled && groupSelection.selectedGroupIds.length > 0) {
    scores = scores.filter((score) =>
      groupSelection.selectedGroupIds.includes(score.subtotalGroupId)
    )
  }

  if (hideUnassigned) {
    scores = scores.filter((score) => score.hasQuestionAssignments)
  }

  return scores
}

/**
 * 小計点スコアをグループ別にまとめる
 */
export function groupSubtotalData(
  filteredScores: SubtotalScore[]
): GroupedSubtotalData[] {
  const groupMap = new Map<string, GroupedSubtotalData>()

  for (const score of filteredScores) {
    const groupId = score.subtotalGroupId
    const existing = groupMap.get(groupId)
    if (existing) {
      existing.items.push(score)
      existing.totalScore += score.score ?? 0
      existing.totalMaxScore += score.maxScore
    } else {
      groupMap.set(groupId, {
        groupId,
        groupName: score.subtotalGroupName,
        items: [score],
        totalScore: score.score ?? 0,
        totalMaxScore: score.maxScore,
      })
    }
  }

  return Array.from(groupMap.values())
}

/**
 * ドント方式で列数を各グループに配分
 */
export function allocateColumnsDHondt(
  groups: { groupId: string; items: { length: number } }[],
  totalColumns: number
): Map<string, number> {
  const allocation = new Map<string, number>()
  if (groups.length === 0) return allocation

  for (const group of groups) {
    allocation.set(group.groupId, 1)
  }

  if (groups.length >= totalColumns) {
    return allocation
  }

  let remainingColumns = totalColumns - groups.length
  while (remainingColumns > 0) {
    let maxQuotient = -1
    let maxGroupId = ""
    for (const group of groups) {
      const currentAllocation = allocation.get(group.groupId)!
      const quotient = group.items.length / (currentAllocation + 1)
      if (quotient > maxQuotient) {
        maxQuotient = quotient
        maxGroupId = group.groupId
      }
    }
    allocation.set(maxGroupId, allocation.get(maxGroupId)! + 1)
    remainingColumns--
  }

  return allocation
}

/**
 * アイテムを指定列数に分割（縦方向に埋める）
 */
export function splitItemsIntoColumns<T>(
  items: T[],
  columnCount: number
): T[][] {
  const result: T[][] = Array.from({ length: columnCount }, () => [])
  const itemsPerColumn = Math.ceil(items.length / columnCount)
  for (let i = 0; i < items.length; i++) {
    const colIndex = Math.floor(i / itemsPerColumn)
    if (colIndex < columnCount) {
      result[colIndex].push(items[i])
    }
  }
  return result
}

// ============================
// 表示制御
// ============================

/**
 * 表示されるセクションのインデックスを取得
 */
export function getVisibleSectionIndices(
  options: IndividualReportOptions
): number[] {
  const indices: number[] = [0, 1, 2] // ヘッダー、生徒情報、統計サマリーは常に表示
  if (options.showSubtotalTable) indices.push(3)
  if (options.graphOptions.showBoxPlot) indices.push(4)
  if (options.showQuestionTable) indices.push(5)
  if (options.showLearningAdvice) indices.push(6)
  if (options.showComment) indices.push(7)
  if (options.showSignature) indices.push(8)
  return indices
}

/**
 * 統計サマリーの表示アイテムを構築
 */
export function buildStatsItems(
  report: IndividualReportData,
  filteredStats: StatisticsData,
  options: IndividualReportOptions
): { label: string; value: string }[] {
  const items: { label: string; value: string }[] = []

  if (options.showScore) {
    items.push({
      label: "得点",
      value: `${report.scoringData.totalScore} / ${report.scoringData.totalMaxScore}`,
    })
  }

  if (options.showAverage !== "none") {
    if (options.showAverage === "class" || options.showAverage === "both") {
      items.push({
        label: "学級平均",
        value: filteredStats.class.average.toFixed(1),
      })
    }
    if (options.showAverage === "overall" || options.showAverage === "both") {
      items.push({
        label: "全体平均",
        value: filteredStats.overall.average.toFixed(1),
      })
    }
  }

  if (options.showDeviation) {
    items.push({
      label: "偏差値",
      value: filteredStats.personal.deviation.toFixed(1),
    })
  }

  if (options.showRank) {
    if (options.rankType === "class" || options.rankType === "both") {
      items.push({
        label: "学級順位",
        value: `${filteredStats.personal.classRank} / ${filteredStats.class.total}`,
      })
    }
    if (options.rankType === "overall" || options.rankType === "both") {
      items.push({
        label: "全体順位",
        value: `${filteredStats.personal.overallRank} / ${filteredStats.overall.total}`,
      })
    }
  }

  return items
}

// ============================
// ユーティリティ
// ============================

/**
 * 日付をフォーマット
 */
export function formatDate(date: Date | null): string {
  if (!date) return ""
  const d = new Date(date)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}
