/**
 * 個人成績表の共通計算ロジック
 * プレビュー（React）とPDF出力（renderToStaticMarkup）の両方で使用
 */
import type {
  IndividualReportData,
  IndividualReportOptions,
  RawTotalScoreEntry,
  ReportClassroom,
  ReportPopulation,
  ReportSubtotal,
  SubtotalRawScores,
} from "@/electron-src/lib/export/individual-report/types"
import {
  calculateAverage,
  calculateBoxPlot,
  calculateRank,
  calculateStandardDeviation,
} from "@/electron-src/lib/shared/calculations/numericStats"
import type {
  ScoringData,
  SubtotalScore,
} from "@/electron-src/lib/shared/types"
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

/** 受験状態フィルタに合致するか */
function isIncludedStatus(
  status: ExamStudentStatus,
  includeStatuses: BoxPlotIncludeStatuses
): boolean {
  if (status === "participating") return includeStatuses.participating
  if (status === "expected") return includeStatuses.expected
  if (status === "absent") return includeStatuses.absent
  return true
}

/** 未採点（null）を除いた得点だけを取り出す */
function toScores(rawTotalScores: RawTotalScoreEntry[]): number[] {
  return rawTotalScores
    .map((rawTotalScore) => rawTotalScore.totalScore)
    .filter((score): score is number => score !== null)
}

/** 偏差値。本人が未採点なら 0、母集団にばらつきが無ければ 50 */
function toDeviation(
  studentScore: number | null,
  average: number,
  stdDev: number
): number {
  if (studentScore === null) return 0
  if (stdDev === 0) return 50
  return Math.round(((studentScore - average) / stdDev) * 10 + 50)
}

/** 本人が所属する生徒表示学級だけに絞る（1人が複数学級に属することがある） */
export function selectStudentClassrooms(
  classrooms: ReportClassroom[],
  studentId: string
): ReportClassroom[] {
  return classrooms.filter((classroom) =>
    classroom.memberStudentIds.includes(studentId)
  )
}

/**
 * 受験状態フィルタを適用して統計を算出する。
 *
 * 母集団は試験に1つで、本人の得点と所属学級だけが生徒ごとに変わる。
 */
export function computeFilteredStats(
  population: ReportPopulation,
  scoringData: ScoringData,
  includeStatuses: BoxPlotIncludeStatuses
) {
  const includedTotalScores = population.rawTotalScores.filter(
    (rawTotalScore) => isIncludedStatus(rawTotalScore.status, includeStatuses)
  )
  const overallScores = toScores(includedTotalScores)
  const overallAverage = calculateAverage(overallScores)
  const overallStdDev = calculateStandardDeviation(overallScores)
  const studentScore = scoringData.totalScore

  // 学級ごとに memberStudentIds で母集団を絞る。所属判定は受験者数だけ繰り返すので、
  // 在籍者の集合を学級ごとに1回だけ組む（配列の走査を内側に置くと生徒数×在籍者数になる）
  const classrooms = selectStudentClassrooms(
    population.classrooms,
    scoringData.studentId
  ).map((classroom) => {
    const memberStudentIds = new Set(classroom.memberStudentIds)
    const classroomTotalScores = includedTotalScores.filter((rawTotalScore) =>
      memberStudentIds.has(rawTotalScore.studentId)
    )
    const classroomScores = toScores(classroomTotalScores)
    const classroomAverage = calculateAverage(classroomScores)
    const classroomStdDev = calculateStandardDeviation(classroomScores)
    return {
      classroomId: classroom.classroomId,
      className: classroom.className,
      grade: classroom.grade,
      average: classroomAverage,
      stdDev: classroomStdDev,
      // 偏差値も同じ母集団で算出する（平均・順位と食い違わせない）
      deviation: toDeviation(studentScore, classroomAverage, classroomStdDev),
      total: classroomTotalScores.length,
      rank:
        studentScore !== null
          ? calculateRank(studentScore, classroomScores)
          : 0,
    }
  })

  return {
    overall: {
      average: overallAverage,
      stdDev: overallStdDev,
      total: includedTotalScores.length,
    },
    classrooms,
    personal: {
      deviation: toDeviation(studentScore, overallAverage, overallStdDev),
      overallRank:
        studentScore !== null ? calculateRank(studentScore, overallScores) : 0,
    },
  }
}

// ============================
// 箱ひげ図統計計算（プリミティブは numericStats を共用）
// ============================

/**
 * 小計点箱ひげ図の統計を受験状態フィルタ付きで算出
 */
export function computeFilteredSubtotalStats(
  subtotalRawScores: SubtotalRawScores[],
  subtotals: ReportSubtotal[],
  includeStatuses: BoxPlotIncludeStatuses
): ComputedSubtotalStat[] {
  return subtotals.map((subtotal) => {
    const rawScores = subtotalRawScores.find(
      (subtotalRawScore) => subtotalRawScore.subtotalId === subtotal.subtotalId
    )
    const includedScores = (rawScores?.scores ?? [])
      .filter((studentSubtotalScore) =>
        isIncludedStatus(studentSubtotalScore.status, includeStatuses)
      )
      .map((studentSubtotalScore) => studentSubtotalScore.score)
      .filter((score): score is number => score !== null)

    return {
      subtotalId: subtotal.subtotalId,
      subtotalLabel: subtotal.subtotalLabel,
      subtotalGroupId: subtotal.subtotalGroupId,
      boxPlot:
        includedScores.length > 0
          ? calculateBoxPlot(includedScores)
          : { min: 0, q1: 0, median: 0, q3: 0, max: 0 },
      average: calculateAverage(includedScores),
      maxScore: subtotal.maxScore,
    }
  })
}

/**
 * 合計点箱ひげ図の統計を受験状態フィルタ付きで計算
 */
/** 合計点を母集団全体で見る行のid */
const OVERALL_STAT_ID = "__overall__"

/** 学級ごとの合計点を見る行のid接頭辞 */
const CLASSROOM_STAT_ID_PREFIX = "__classroom__:"

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
  rawTotalScores: RawTotalScoreEntry[],
  classrooms: ReportClassroom[],
  totalMaxScore: number,
  includeStatuses: BoxPlotIncludeStatuses
): ComputedSubtotalStat[] {
  return classrooms.map((classroom) => {
    // 在籍者の集合は学級ごとに1回だけ組む（受験者数ぶん所属判定を繰り返すため）
    const memberStudentIds = new Set(classroom.memberStudentIds)
    const stat = computeFilteredOverallStat(
      rawTotalScores.filter((rawTotalScore) =>
        memberStudentIds.has(rawTotalScore.studentId)
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
  rawTotalScores: RawTotalScoreEntry[],
  totalMaxScore: number,
  includeStatuses: BoxPlotIncludeStatuses
): ComputedSubtotalStat {
  const includedScores = toScores(
    rawTotalScores.filter((rawTotalScore) =>
      isIncludedStatus(rawTotalScore.status, includeStatuses)
    )
  )

  return {
    subtotalId: OVERALL_STAT_ID,
    subtotalLabel: "合計点",
    subtotalGroupId: "__overall__",
    boxPlot:
      includedScores.length > 0
        ? calculateBoxPlot(includedScores)
        : { min: 0, q1: 0, median: 0, q3: 0, max: 0 },
    average: calculateAverage(includedScores),
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
  filteredStats: ReturnType<typeof computeFilteredStats>,
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
