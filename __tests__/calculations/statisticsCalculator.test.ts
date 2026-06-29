/**
 * statisticsCalculator のnull score対応テスト
 *
 * テスト対象:
 * - calculateSubtotalStatistics: subtotalScore.score が null の場合に統計から除外
 * - collectSubtotalRawScores: subtotalScore.score が null の場合に除外
 * - calculateStatisticsForStudent: totalScore が null の場合の統計処理
 */
import { describe, expect, it } from "vitest"

import {
  calculateStatisticsForStudent,
  calculateSubtotalStatistics,
  collectSubtotalRawScores,
} from "@/electron-src/lib/export/individual-report/statisticsCalculator"
import type { ScoringData } from "@/electron-src/lib/shared/types/exportTypes"

// ================== ヘルパー ==================

function createScoringData(
  overrides: Partial<ScoringData> & { studentId: string }
): ScoringData {
  return {
    studentName: "テスト生徒",
    studentNumber: "001",
    scores: [],
    totalScore: 80,
    totalMaxScore: 100,
    subtotalScores: [],
    ...overrides,
  }
}

// ================== calculateSubtotalStatistics ==================

describe("calculateSubtotalStatistics", () => {
  it("score が null の生徒を統計から除外する", () => {
    const data: ScoringData[] = [
      createScoringData({
        studentId: "s1",
        subtotalScores: [
          {
            subtotalId: "sub1",
            subtotalGroupId: "g1",
            subtotalGroupName: "G1",
            subtotalLabel: "小計1",
            score: 30,
            maxScore: 50,
            hasQuestionAssignments: true,
          },
        ],
      }),
      createScoringData({
        studentId: "s2",
        subtotalScores: [
          {
            subtotalId: "sub1",
            subtotalGroupId: "g1",
            subtotalGroupName: "G1",
            subtotalLabel: "小計1",
            score: null, // 全設問未採点
            maxScore: 50,
            hasQuestionAssignments: true,
          },
        ],
      }),
      createScoringData({
        studentId: "s3",
        subtotalScores: [
          {
            subtotalId: "sub1",
            subtotalGroupId: "g1",
            subtotalGroupName: "G1",
            subtotalLabel: "小計1",
            score: 50,
            maxScore: 50,
            hasQuestionAssignments: true,
          },
        ],
      }),
    ]

    const result = calculateSubtotalStatistics(data)
    expect(result).toHaveLength(1)
    // s2(null)は除外され、s1(30) と s3(50) のみで平均 = 40
    expect(result[0].average).toBe(40)
  })

  it("全員 null の場合は空配列で統計計算（平均0）", () => {
    const data: ScoringData[] = [
      createScoringData({
        studentId: "s1",
        subtotalScores: [
          {
            subtotalId: "sub1",
            subtotalGroupId: "g1",
            subtotalGroupName: "G1",
            subtotalLabel: "小計1",
            score: null,
            maxScore: 50,
            hasQuestionAssignments: true,
          },
        ],
      }),
      createScoringData({
        studentId: "s2",
        subtotalScores: [
          {
            subtotalId: "sub1",
            subtotalGroupId: "g1",
            subtotalGroupName: "G1",
            subtotalLabel: "小計1",
            score: null,
            maxScore: 50,
            hasQuestionAssignments: true,
          },
        ],
      }),
    ]

    const result = calculateSubtotalStatistics(data)
    expect(result).toHaveLength(1)
    expect(result[0].average).toBe(0)
    expect(result[0].stdDev).toBe(0)
  })

  it("0点の生徒は統計に含まれる", () => {
    const data: ScoringData[] = [
      createScoringData({
        studentId: "s1",
        subtotalScores: [
          {
            subtotalId: "sub1",
            subtotalGroupId: "g1",
            subtotalGroupName: "G1",
            subtotalLabel: "小計1",
            score: 0, // 全問不正解
            maxScore: 50,
            hasQuestionAssignments: true,
          },
        ],
      }),
      createScoringData({
        studentId: "s2",
        subtotalScores: [
          {
            subtotalId: "sub1",
            subtotalGroupId: "g1",
            subtotalGroupName: "G1",
            subtotalLabel: "小計1",
            score: 100,
            maxScore: 50,
            hasQuestionAssignments: true,
          },
        ],
      }),
    ]

    const result = calculateSubtotalStatistics(data)
    // 0点と100点の平均 = 50
    expect(result[0].average).toBe(50)
  })
})

// ================== collectSubtotalRawScores ==================

describe("collectSubtotalRawScores", () => {
  it("score が null の生徒を除外する", () => {
    const data: ScoringData[] = [
      createScoringData({
        studentId: "s1",
        status: "participating",
        subtotalScores: [
          {
            subtotalId: "sub1",
            subtotalGroupId: "g1",
            subtotalGroupName: "G1",
            subtotalLabel: "小計1",
            score: 30,
            maxScore: 50,
            hasQuestionAssignments: true,
          },
        ],
      }),
      createScoringData({
        studentId: "s2",
        status: "participating",
        subtotalScores: [
          {
            subtotalId: "sub1",
            subtotalGroupId: "g1",
            subtotalGroupName: "G1",
            subtotalLabel: "小計1",
            score: null,
            maxScore: 50,
            hasQuestionAssignments: true,
          },
        ],
      }),
    ]

    const result = collectSubtotalRawScores(data)
    expect(result).toHaveLength(1)
    expect(result[0].scores).toHaveLength(1) // s2 は除外
    expect(result[0].scores[0].studentId).toBe("s1")
    expect(result[0].scores[0].score).toBe(30)
  })

  it("0点は除外されない", () => {
    const data: ScoringData[] = [
      createScoringData({
        studentId: "s1",
        status: "participating",
        subtotalScores: [
          {
            subtotalId: "sub1",
            subtotalGroupId: "g1",
            subtotalGroupName: "G1",
            subtotalLabel: "小計1",
            score: 0,
            maxScore: 50,
            hasQuestionAssignments: true,
          },
        ],
      }),
    ]

    const result = collectSubtotalRawScores(data)
    expect(result[0].scores).toHaveLength(1)
    expect(result[0].scores[0].score).toBe(0)
  })
})

// ================== calculateStatisticsForStudent ==================

describe("calculateStatisticsForStudent", () => {
  const emptyRates: Record<string, number> = {}

  /** allData 全員を母集団とする単一学級を作る（学級統計テスト用） */
  const classOf = (
    allData: ScoringData[]
  ): {
    classId: string
    className: string
    grade: string | null
    memberStudentIds: string[]
  }[] => [
    {
      classId: "c1",
      className: "1組",
      grade: null,
      memberStudentIds: allData.map((d) => d.studentId),
    },
  ]

  it("totalScore が null の生徒は偏差値0・順位0", () => {
    const allData: ScoringData[] = [
      createScoringData({ studentId: "s1", totalScore: 80 }),
      createScoringData({ studentId: "s2", totalScore: null }),
      createScoringData({ studentId: "s3", totalScore: 60 }),
    ]

    const result = calculateStatisticsForStudent(
      "s2",
      null,
      allData,
      classOf(allData),
      emptyRates,
      emptyRates
    )

    expect(result.personal.deviation).toBe(0)
    expect(result.personal.overallRank).toBe(0)
    expect(result.classes[0].rank).toBe(0)
  })

  it("totalScore が null の生徒は全体・学級統計から除外される", () => {
    const allData: ScoringData[] = [
      createScoringData({ studentId: "s1", totalScore: 80 }),
      createScoringData({ studentId: "s2", totalScore: null }),
      createScoringData({ studentId: "s3", totalScore: 60 }),
    ]

    const result = calculateStatisticsForStudent(
      "s1",
      80,
      allData,
      classOf(allData),
      emptyRates,
      emptyRates
    )

    // s2(null)を除外して s1(80) と s3(60) のみで平均 = 70
    expect(result.overall.average).toBe(70)
    // 学級平均も同じ母集団なので 70
    expect(result.classes[0].average).toBe(70)
  })

  it("全員 null の場合は平均0・標準偏差0", () => {
    const allData: ScoringData[] = [
      createScoringData({ studentId: "s1", totalScore: null }),
      createScoringData({ studentId: "s2", totalScore: null }),
    ]

    const result = calculateStatisticsForStudent(
      "s1",
      null,
      allData,
      classOf(allData),
      emptyRates,
      emptyRates
    )

    expect(result.overall.average).toBe(0)
    expect(result.overall.stdDev).toBe(0)
    expect(result.personal.deviation).toBe(0)
    expect(result.personal.overallRank).toBe(0)
  })

  it("0点の生徒は統計に含まれる（nullとは区別される）", () => {
    const allData: ScoringData[] = [
      createScoringData({ studentId: "s1", totalScore: 0 }),
      createScoringData({ studentId: "s2", totalScore: 100 }),
    ]

    const result = calculateStatisticsForStudent(
      "s1",
      0,
      allData,
      classOf(allData),
      emptyRates,
      emptyRates
    )

    // 0点と100点の平均 = 50
    expect(result.overall.average).toBe(50)
    // 0点の生徒は順位2位
    expect(result.personal.overallRank).toBe(2)
  })

  it("studentReport 学級が未選択（空配列）なら学級統計は空", () => {
    const allData: ScoringData[] = [
      createScoringData({ studentId: "s1", totalScore: 80 }),
      createScoringData({ studentId: "s2", totalScore: 60 }),
    ]

    const result = calculateStatisticsForStudent(
      "s1",
      80,
      allData,
      [],
      emptyRates,
      emptyRates
    )

    expect(result.classes).toEqual([])
  })

  it("複数の studentReport 学級に属する生徒は学級ごとの統計を持つ", () => {
    const allData: ScoringData[] = [
      createScoringData({ studentId: "s1", totalScore: 80 }),
      createScoringData({ studentId: "s2", totalScore: 60 }),
      createScoringData({ studentId: "s3", totalScore: 40 }),
    ]

    const result = calculateStatisticsForStudent(
      "s1",
      80,
      allData,
      [
        {
          classId: "cA",
          className: "A組",
          grade: null,
          memberStudentIds: ["s1", "s2"], // 平均=70・s1は1位
        },
        {
          classId: "cB",
          className: "B組",
          grade: null,
          memberStudentIds: ["s1", "s3"], // 平均=60・s1は1位
        },
      ],
      emptyRates,
      emptyRates
    )

    expect(result.classes).toHaveLength(2)
    expect(result.classes[0].average).toBe(70)
    expect(result.classes[0].rank).toBe(1)
    expect(result.classes[0].total).toBe(2)
    expect(result.classes[1].average).toBe(60)
    expect(result.classes[1].rank).toBe(1)
  })
})
