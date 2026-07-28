/**
 * computeReportData のnull score対応テスト
 *
 * テスト対象:
 * - computeFilteredStats: totalScore が null の場合の統計再計算
 * - groupSubtotalData: subtotalScore.score が null の場合のグループ集計
 */
import { describe, expect, it } from "vitest"

import {
  computeFilteredStats,
  groupSubtotalData,
} from "@/components/exams/08-export/components/individual-report/computeReportData"
import type {
  IndividualReportData,
  StatisticsData,
} from "@/electron-src/lib/export/individual-report/types"
import type { SubtotalScore } from "@/electron-src/lib/shared/types"

// ================== ヘルパー ==================

function createMinimalStats(): StatisticsData {
  return {
    overall: {
      average: 70,
      stdDev: 10,
      boxPlot: { min: 50, q1: 60, median: 70, q3: 80, max: 90 },
      total: 3,
    },
    classrooms: [
      {
        classroomId: "cA",
        className: "A",
        grade: "1",
        memberStudentIds: ["s1", "s2", "s3"],
        average: 70,
        stdDev: 10,
        boxPlot: { min: 50, q1: 60, median: 70, q3: 80, max: 90 },
        total: 3,
        rank: 1,
      },
    ],
    personal: {
      deviation: 50,
      overallRank: 1,
    },
    questionCorrectRates: {},
    questionScoreRates: {},
    subtotalStatistics: [],
    subtotalRawScores: [],
    rawTotalScores: [],
  }
}

function createMinimalReport(
  overrides: {
    totalScore?: number | null
    rawTotalScores?: StatisticsData["rawTotalScores"]
  } = {}
): IndividualReportData {
  return {
    studentInfo: {
      id: "s1",
      fullName: "テスト太郎",
      studentNumber: "001",
      grade: "1",
      className: "A",
      attendanceNumber: 1,
    },
    examInfo: {
      examName: "テスト試験",
      examDate: null,
      tags: [],
    },
    scoringData: {
      examStudentId: "es1",
      studentId: "s1",
      studentName: "テスト太郎",
      studentNumber: "001",
      grade: "1",
      className: "A",
      scores: [],
      totalScore: "totalScore" in overrides ? overrides.totalScore! : 80,
      totalMaxScore: 100,
      subtotalScores: [],
    },
    statistics: {
      ...createMinimalStats(),
      rawTotalScores: overrides.rawTotalScores ?? [
        {
          studentId: "s1",
          totalScore: 80,
          status: "participating",
          className: "A",
          grade: "1",
        },
        {
          studentId: "s2",
          totalScore: 60,
          status: "participating",
          className: "A",
          grade: "1",
        },
        {
          studentId: "s3",
          totalScore: 90,
          status: "participating",
          className: "A",
          grade: "1",
        },
      ],
    },
    learningAdvice: { reviewQuestions: [] },
  }
}

// ================== computeFilteredStats ==================

describe("computeFilteredStats", () => {
  const allStatuses = {
    participating: true,
    expected: true,
    absent: true,
  }

  it("totalScore が null の生徒が rawTotalScores に含まれていても統計から除外される", () => {
    const report = createMinimalReport({
      totalScore: 80,
      rawTotalScores: [
        {
          studentId: "s1",
          totalScore: 80,
          status: "participating",
          className: "A",
          grade: "1",
        },
        {
          studentId: "s2",
          totalScore: null,
          status: "participating",
          className: "A",
          grade: "1",
        },
        {
          studentId: "s3",
          totalScore: 60,
          status: "participating",
          className: "A",
          grade: "1",
        },
      ],
    })

    // absent=false でフィルタリングをトリガー
    const statuses = { participating: true, expected: true, absent: false }
    const result = computeFilteredStats(report, statuses)

    // s2(null)除外、s1(80)+s3(60) → 平均70
    expect(result.overall.average).toBe(70)
  })

  it("自分の totalScore が null の場合、偏差値0・順位0", () => {
    const report = createMinimalReport({
      totalScore: null,
      rawTotalScores: [
        {
          studentId: "s1",
          totalScore: null,
          status: "participating",
          className: "A",
          grade: "1",
        },
        {
          studentId: "s2",
          totalScore: 80,
          status: "participating",
          className: "A",
          grade: "1",
        },
      ],
    })

    const statuses = { participating: true, expected: true, absent: false }
    const result = computeFilteredStats(report, statuses)

    expect(result.personal.deviation).toBe(0)
    expect(result.personal.overallRank).toBe(0)
    expect(result.classrooms[0].rank).toBe(0)
  })

  it("全ステータス有効時はフィルタリングせず元の統計を返す", () => {
    const report = createMinimalReport()
    const result = computeFilteredStats(report, allStatuses)

    // 元のstatisticsがそのまま返される
    expect(result).toBe(report.statistics)
  })
})

// ================== groupSubtotalData ==================

describe("groupSubtotalData", () => {
  it("score が null の小計はグループ合計に0として加算される", () => {
    const scores: SubtotalScore[] = [
      {
        subtotalId: "sub1",
        subtotalGroupId: "g1",
        subtotalGroupName: "国語",
        subtotalLabel: "漢字",
        score: 30,
        maxScore: 50,
        hasQuestionAssignments: true,
      },
      {
        subtotalId: "sub2",
        subtotalGroupId: "g1",
        subtotalGroupName: "国語",
        subtotalLabel: "読解",
        score: null,
        maxScore: 50,
        hasQuestionAssignments: true,
      },
    ]

    const result = groupSubtotalData(scores)
    expect(result).toHaveLength(1)
    expect(result[0].groupName).toBe("国語")
    // null → 0 として加算: 30 + 0 = 30
    expect(result[0].totalScore).toBe(30)
    expect(result[0].totalMaxScore).toBe(100)
    expect(result[0].items).toHaveLength(2)
  })

  it("全 score が null でもグループは作成される（合計0）", () => {
    const scores: SubtotalScore[] = [
      {
        subtotalId: "sub1",
        subtotalGroupId: "g1",
        subtotalGroupName: "数学",
        subtotalLabel: "計算",
        score: null,
        maxScore: 50,
        hasQuestionAssignments: true,
      },
    ]

    const result = groupSubtotalData(scores)
    expect(result).toHaveLength(1)
    expect(result[0].totalScore).toBe(0)
  })

  it("複数グループを正しく分離する", () => {
    const scores: SubtotalScore[] = [
      {
        subtotalId: "sub1",
        subtotalGroupId: "g1",
        subtotalGroupName: "国語",
        subtotalLabel: "漢字",
        score: 30,
        maxScore: 50,
        hasQuestionAssignments: true,
      },
      {
        subtotalId: "sub2",
        subtotalGroupId: "g2",
        subtotalGroupName: "数学",
        subtotalLabel: "計算",
        score: null,
        maxScore: 50,
        hasQuestionAssignments: true,
      },
    ]

    const result = groupSubtotalData(scores)
    expect(result).toHaveLength(2)

    const kokugo = result.find((group) => group.groupName === "国語")
    const sugaku = result.find((group) => group.groupName === "数学")
    expect(kokugo?.totalScore).toBe(30)
    expect(sugaku?.totalScore).toBe(0)
  })
})
