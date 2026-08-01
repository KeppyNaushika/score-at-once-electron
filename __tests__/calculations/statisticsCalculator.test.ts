/**
 * statisticsCalculator の母集団収集テスト
 *
 * テスト対象:
 * - collectReportSubtotals: 小計の識別・表示情報の収集
 * - collectRawTotalScores: 全受験者の合計点の収集
 * - collectSubtotalRawScores: subtotalScore.score が null の場合に除外
 *
 * 統計値（平均・偏差値・順位・箱ひげ図）の算出は renderer 側なので
 * `computeReportData.test.ts` が受け持つ。
 */
import { describe, expect, it } from "vitest"

import {
  collectRawTotalScores,
  collectReportSubtotals,
  collectSubtotalRawScores,
} from "@/electron-src/lib/export/individual-report/statisticsCalculator"
import type { ScoringData } from "@/electron-src/lib/shared/types"

// ================== ヘルパー ==================

function createScoringData(
  overrides: Partial<ScoringData> & { studentId: string }
): ScoringData {
  return {
    examStudentId: `exam-${overrides.studentId}`,
    studentName: "テスト生徒",
    studentNumber: "001",
    scores: [],
    totalScore: 80,
    totalMaxScore: 100,
    subtotalScores: [],
    ...overrides,
  }
}

// ================== collectReportSubtotals ==================

describe("collectReportSubtotals", () => {
  it("最初の受験者から小計の識別・表示情報を取り出す", () => {
    const allScoringData: ScoringData[] = [
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
            score: null,
            maxScore: 50,
            hasQuestionAssignments: true,
          },
        ],
      }),
    ]

    expect(collectReportSubtotals(allScoringData)).toEqual([
      {
        subtotalId: "sub1",
        subtotalLabel: "小計1",
        maxScore: 50,
        subtotalGroupId: "g1",
      },
    ])
  })

  it("受験者がいなければ空配列", () => {
    expect(collectReportSubtotals([])).toEqual([])
  })
})

// ================== collectRawTotalScores ==================

describe("collectRawTotalScores", () => {
  it("合計点と受験状態を全受験者ぶん集める（null もそのまま残す）", () => {
    const allScoringData: ScoringData[] = [
      createScoringData({
        studentId: "s1",
        totalScore: 80,
        status: "participating",
      }),
      createScoringData({
        studentId: "s2",
        totalScore: null,
        status: "absent",
      }),
    ]

    expect(collectRawTotalScores(allScoringData)).toEqual([
      { studentId: "s1", totalScore: 80, status: "participating" },
      { studentId: "s2", totalScore: null, status: "absent" },
    ])
  })

  it("受験状態が未設定なら participating とみなす", () => {
    const allScoringData: ScoringData[] = [
      createScoringData({ studentId: "s1", totalScore: 80 }),
    ]

    expect(collectRawTotalScores(allScoringData)[0].status).toBe(
      "participating"
    )
  })
})

// ================== collectSubtotalRawScores ==================

describe("collectSubtotalRawScores", () => {
  it("score が null の生徒を除外する", () => {
    const data: ScoringData[] = [
      createScoringData({
        examStudentId: "s1",
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
        examStudentId: "s2",
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
        examStudentId: "s1",
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
