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
import {
  calculateAverage,
  calculateBoxPlot,
  calculateRank,
  calculateStandardDeviation,
} from "@/electron-src/lib/shared/calculations/numericStats"
import type { SubtotalScore } from "@/electron-src/lib/shared/types"
import type { ExamStudentStatus } from "@/types/examStudentStatus.types"

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
interface GroupedSubtotalData {
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
    entries.filter((entry) => {
      if (entry.status === "participating") return statuses.participating
      if (entry.status === "expected") return statuses.expected
      if (entry.status === "absent") return statuses.absent
      return true
    })

  const filteredAll = filterByStatus(raw)
  const allScores = filteredAll
    .map((entry) => entry.totalScore)
    .filter((score): score is number => score !== null)

  const overallAvg = calculateAverage(allScores)
  const overallStd = calculateStandardDeviation(allScores)
  const studentScore = report.scoringData.totalScore
  const deviation =
    studentScore === null || overallStd === 0
      ? studentScore === null
        ? 0
        : 50
      : Math.round(((studentScore - overallAvg) / overallStd) * 10 + 50)

  // 学級別統計を受験状態フィルタ付きで再計算（学級ごとに memberStudentIds で母集団を絞る）
  const classrooms = report.statistics.classrooms.map((classroom) => {
    const memberSet = new Set(classroom.memberStudentIds)
    const filteredMembers = filteredAll.filter((entry) =>
      memberSet.has(entry.studentId)
    )
    const classroomScores = filteredMembers
      .map((entry) => entry.totalScore)
      .filter((score): score is number => score !== null)
    const classroomAverage = calculateAverage(classroomScores)
    const classroomStdDev = calculateStandardDeviation(classroomScores)
    return {
      ...classroom,
      average: classroomAverage,
      stdDev: classroomStdDev,
      // 偏差値も同じ母集団で算出する（平均・順位と食い違わせない）
      deviation:
        studentScore === null
          ? 0
          : classroomStdDev === 0
            ? 50
            : Math.round(
                ((studentScore - classroomAverage) / classroomStdDev) * 10 + 50
              ),
      total: filteredMembers.length,
      rank:
        studentScore !== null
          ? calculateRank(studentScore, classroomScores)
          : 0,
    }
  })

  return {
    ...report.statistics,
    overall: {
      ...report.statistics.overall,
      average: overallAvg,
      stdDev: overallStd,
      total: filteredAll.length,
    },
    classrooms,
    personal: {
      ...report.statistics.personal,
      deviation,
      overallRank:
        studentScore !== null ? calculateRank(studentScore, allScores) : 0,
    },
  }
}

// ============================
// 箱ひげ図統計計算（プリミティブは numericStats を共用）
// ============================

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
    const rawData = rawScores.find(
      (subtotalRawScore) => subtotalRawScore.subtotalId === stat.subtotalId
    )

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
      .filter((rawScore) => {
        if (rawScore.status === "participating")
          return includeStatuses.participating
        if (rawScore.status === "expected") return includeStatuses.expected
        if (rawScore.status === "absent") return includeStatuses.absent
        return true
      })
      .map((rawScore) => rawScore.score)
      .filter((score): score is number => score !== null)

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
      boxPlot: calculateBoxPlot(filteredScores),
      average: calculateAverage(filteredScores),
      maxScore: stat.maxScore,
    }
  })
}

/**
 * 合計点箱ひげ図の統計を受験状態フィルタ付きで計算
 */
/** 合計点を母集団全体で見る行のid */
export const OVERALL_STAT_ID = "__overall__"

/** 学級ごとの合計点を見る行のid接頭辞 */
export const CLASSROOM_STAT_ID_PREFIX = "__classroom__:"

/**
 * その行が合計点を対象にしているか（全体・学級のいずれも合計点）。
 * 本人の得点は小計ではなく合計点を引く必要がある。
 */
export function isTotalScoreStat(statId: string): boolean {
  return (
    statId === OVERALL_STAT_ID || statId.startsWith(CLASSROOM_STAT_ID_PREFIX)
  )
}

/**
 * 学級ごとの合計点統計（箱ひげ図用）。
 * 母集団は当該学級の受験日所属生徒に限る（memberStudentIds で絞る）。
 */
export function computeFilteredClassroomStats(
  rawTotalScores: {
    studentId: string
    totalScore: number | null
    status: ExamStudentStatus
  }[],
  classrooms: {
    classroomId: string
    className: string
    memberStudentIds: string[]
  }[],
  totalMaxScore: number,
  includeStatuses: BoxPlotIncludeStatuses
): ComputedSubtotalStat[] {
  return classrooms.map((classroom) => {
    const memberIds = new Set(classroom.memberStudentIds)
    const stat = computeFilteredOverallStat(
      rawTotalScores.filter((rawTotalScore) =>
        memberIds.has(rawTotalScore.studentId)
      ),
      totalMaxScore,
      includeStatuses
    )
    return {
      ...stat,
      subtotalId: `${CLASSROOM_STAT_ID_PREFIX}${classroom.classroomId}`,
      subtotalLabel: `${classroom.className}（合計点）`,
      subtotalGroupId: "__classroom__",
    }
  })
}

export function computeFilteredOverallStat(
  rawTotalScores: {
    studentId: string
    totalScore: number | null
    status: ExamStudentStatus
  }[],
  totalMaxScore: number,
  includeStatuses: BoxPlotIncludeStatuses
): ComputedSubtotalStat {
  const filteredScores = rawTotalScores
    .filter((rawTotalScore) => {
      if (rawTotalScore.status === "participating")
        return includeStatuses.participating
      if (rawTotalScore.status === "expected") return includeStatuses.expected
      if (rawTotalScore.status === "absent") return includeStatuses.absent
      return true
    })
    .map((rawTotalScore) => rawTotalScore.totalScore)
    .filter((score): score is number => score !== null)

  return {
    subtotalId: OVERALL_STAT_ID,
    subtotalLabel: "合計点",
    subtotalGroupId: "__overall__",
    boxPlot:
      filteredScores.length > 0
        ? calculateBoxPlot(filteredScores)
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
  if (
    options.statistics.boxPlot.overall ||
    options.statistics.boxPlot.classroom
  )
    indices.push(4)
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

  // 複数学級時はラベルに学級名を付して区別する（単一学級なら従来どおり「学級平均」）
  const multipleClassrooms = filteredStats.classrooms.length > 1
  const classroomLabel = (className: string, suffix: string) =>
    multipleClassrooms ? `${className}${suffix}` : `学級${suffix}`

  if (options.statistics.average.classroom) {
    for (const classroom of filteredStats.classrooms) {
      items.push({
        label: classroomLabel(classroom.className, "平均"),
        value: classroom.average.toFixed(1),
      })
    }
  }
  if (options.statistics.average.overall) {
    items.push({
      label: "全体平均",
      value: filteredStats.overall.average.toFixed(1),
    })
  }

  if (options.statistics.deviation.classroom) {
    for (const classroom of filteredStats.classrooms) {
      items.push({
        label: classroomLabel(classroom.className, "偏差値"),
        value: classroom.deviation.toFixed(1),
      })
    }
  }
  if (options.statistics.deviation.overall) {
    items.push({
      label: "偏差値",
      value: filteredStats.personal.deviation.toFixed(1),
    })
  }

  if (options.statistics.rank.classroom) {
    for (const classroom of filteredStats.classrooms) {
      items.push({
        label: classroomLabel(classroom.className, "順位"),
        value: `${classroom.rank} / ${classroom.total}`,
      })
    }
  }
  if (options.statistics.rank.overall) {
    items.push({
      label: "全体順位",
      value: `${filteredStats.personal.overallRank} / ${filteredStats.overall.total}`,
    })
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
  const parsedDate = new Date(date)
  return `${parsedDate.getFullYear()}年${parsedDate.getMonth() + 1}月${parsedDate.getDate()}日`
}
