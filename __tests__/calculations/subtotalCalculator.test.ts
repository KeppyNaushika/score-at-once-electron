/**
 * subtotalCalculator のnull score対応テスト
 *
 * テスト対象:
 * - calculateSubtotalScoreBySubtotalId: hasScoredQuestion パターン
 * - calculateSubtotalScoreForStudent: hasScoredQuestion パターン
 *
 * DB関数（getCropSubtotals*）と calculateActualScore をモックして
 * 純粋なロジックのみを検証する
 */
import type { CropRegion } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

// モック設定（import前に定義）
const mockGetCropSubtotalsByCropRegionId = vi.fn()
const mockGetCropSubtotalsBySubtotalId = vi.fn()
const mockCalculateActualScore = vi.fn()

vi.mock("@/electron-src/lib/prisma/cropSubtotal", () => ({
  getCropSubtotalsByCropRegionId: (...args: unknown[]) =>
    mockGetCropSubtotalsByCropRegionId(...args),
  getCropSubtotalsBySubtotalId: (...args: unknown[]) =>
    mockGetCropSubtotalsBySubtotalId(...args),
}))

vi.mock("@/electron-src/lib/prisma/questionScore", () => ({
  calculateActualScore: (...args: unknown[]) =>
    mockCalculateActualScore(...args),
}))

import {
  calculateSubtotalScoreBySubtotalId,
  calculateSubtotalScoreForStudent,
  type QuestionScoreForSubtotal,
} from "@/electron-src/lib/shared/calculations/subtotalCalculator"

// ================== ヘルパー ==================

/** 最小限のCropRegion（テスト用） */
function createCropRegion(
  overrides: Partial<CropRegion> & { id: string }
): CropRegion {
  return {
    label: "問1",
    type: "QUESTION_ANSWER",
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    examPageId: "page1",
    orderIndex: 0,
    points: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
    daimon: null,
    shomon: null,
    shimon: null,
    ...overrides,
  } as CropRegion
}

function createQuestionScore(
  studentId: string,
  cropRegionId: string,
  status: string,
  partialScore: number | null = null
): QuestionScoreForSubtotal {
  return { studentId, cropRegionId, status, partialScore }
}

// ================== calculateSubtotalScoreBySubtotalId ==================

describe("calculateSubtotalScoreBySubtotalId", () => {
  const cropRegions = [
    createCropRegion({ id: "q1", points: 10 }),
    createCropRegion({ id: "q2", points: 20 }),
    createCropRegion({ id: "q3", points: 30 }),
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    // デフォルト: subtotal は q1, q2, q3 の3設問に紐付け
    mockGetCropSubtotalsBySubtotalId.mockResolvedValue([
      {
        cropRegionId: "q1",
        subtotalId: "sub1",
        assignmentType: "QUESTION_ASSIGNMENT",
      },
      {
        cropRegionId: "q2",
        subtotalId: "sub1",
        assignmentType: "QUESTION_ASSIGNMENT",
      },
      {
        cropRegionId: "q3",
        subtotalId: "sub1",
        assignmentType: "QUESTION_ASSIGNMENT",
      },
    ])
  })

  it("全設問採点済み → score に合計点を返す", async () => {
    const scores: QuestionScoreForSubtotal[] = [
      createQuestionScore("s1", "q1", "correct"),
      createQuestionScore("s1", "q2", "incorrect"),
      createQuestionScore("s1", "q3", "partial", 15),
    ]
    // correct→10, incorrect→0, partial→15
    mockCalculateActualScore
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(15)

    const result = await calculateSubtotalScoreBySubtotalId(
      "s1",
      "sub1",
      scores,
      cropRegions
    )

    expect(result.score).toBe(25)
    expect(result.maxScore).toBe(60)
    expect(result.hasQuestionAssignments).toBe(true)
  })

  it("全設問未採点 → score が null", async () => {
    const scores: QuestionScoreForSubtotal[] = [
      createQuestionScore("s1", "q1", "unscored"),
      createQuestionScore("s1", "q2", "unscored"),
      createQuestionScore("s1", "q3", "unscored"),
    ]
    // unscored→null
    mockCalculateActualScore.mockReturnValue(null)

    const result = await calculateSubtotalScoreBySubtotalId(
      "s1",
      "sub1",
      scores,
      cropRegions
    )

    expect(result.score).toBeNull()
    expect(result.maxScore).toBe(60)
    expect(result.hasQuestionAssignments).toBe(true)
  })

  it("一部未採点 → 採点済み分のみの合計を返す", async () => {
    const scores: QuestionScoreForSubtotal[] = [
      createQuestionScore("s1", "q1", "correct"),
      createQuestionScore("s1", "q2", "unscored"),
      createQuestionScore("s1", "q3", "correct"),
    ]
    // correct→10, unscored→null, correct→30
    mockCalculateActualScore
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(30)

    const result = await calculateSubtotalScoreBySubtotalId(
      "s1",
      "sub1",
      scores,
      cropRegions
    )

    expect(result.score).toBe(40) // 10 + 30
    expect(result.hasQuestionAssignments).toBe(true)
  })

  it("全問不正解（0点） → score が 0（null ではない）", async () => {
    const scores: QuestionScoreForSubtotal[] = [
      createQuestionScore("s1", "q1", "incorrect"),
      createQuestionScore("s1", "q2", "incorrect"),
      createQuestionScore("s1", "q3", "incorrect"),
    ]
    mockCalculateActualScore.mockReturnValue(0)

    const result = await calculateSubtotalScoreBySubtotalId(
      "s1",
      "sub1",
      scores,
      cropRegions
    )

    expect(result.score).toBe(0)
    expect(result.hasQuestionAssignments).toBe(true)
  })

  it("QUESTION_ASSIGNMENT が無い → null, hasQuestionAssignments=false", async () => {
    mockGetCropSubtotalsBySubtotalId.mockResolvedValue([])

    const result = await calculateSubtotalScoreBySubtotalId(
      "s1",
      "sub1",
      [],
      cropRegions
    )

    expect(result.score).toBeNull()
    expect(result.hasQuestionAssignments).toBe(false)
  })

  it("採点データが存在しない設問は加算されない", async () => {
    // s1 は q1 のみ採点済み、q2,q3 は採点データ自体が無い
    const scores: QuestionScoreForSubtotal[] = [
      createQuestionScore("s1", "q1", "correct"),
    ]
    mockCalculateActualScore.mockReturnValueOnce(10)

    const result = await calculateSubtotalScoreBySubtotalId(
      "s1",
      "sub1",
      scores,
      cropRegions
    )

    expect(result.score).toBe(10)
    expect(result.maxScore).toBe(60) // q1+q2+q3 の配点合計
  })
})

// ================== calculateSubtotalScoreForStudent ==================

describe("calculateSubtotalScoreForStudent", () => {
  const cropRegions = [
    createCropRegion({ id: "q1", points: 10 }),
    createCropRegion({ id: "q2", points: 20 }),
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    // CropRegion(SUBTOTAL_SCORE) → CropSubtotal → Subtotal のチェーン
    mockGetCropSubtotalsByCropRegionId.mockResolvedValue([
      {
        subtotalId: "item1",
        cropRegionId: "subtotal-region-1",
        assignmentType: "SUBTOTAL_SCORE",
        subtotal: { subtotalGroupId: "group1" },
      },
    ])
    // group1 → item1 → q1, q2
    mockGetCropSubtotalsBySubtotalId.mockResolvedValue([
      {
        cropRegionId: "q1",
        subtotalId: "item1",
        assignmentType: "QUESTION_ASSIGNMENT",
      },
      {
        cropRegionId: "q2",
        subtotalId: "item1",
        assignmentType: "QUESTION_ASSIGNMENT",
      },
    ])
  })

  it("全設問採点済み → score に合計点", async () => {
    const scores: QuestionScoreForSubtotal[] = [
      createQuestionScore("s1", "q1", "correct"),
      createQuestionScore("s1", "q2", "correct"),
    ]
    mockCalculateActualScore.mockReturnValueOnce(10).mockReturnValueOnce(20)

    const result = await calculateSubtotalScoreForStudent(
      "s1",
      "subtotal-region-1",
      scores,
      cropRegions
    )

    expect(result.score).toBe(30)
    expect(result.hasQuestionAssignments).toBe(true)
  })

  it("全設問未採点 → score が null", async () => {
    const scores: QuestionScoreForSubtotal[] = [
      createQuestionScore("s1", "q1", "unscored"),
      createQuestionScore("s1", "q2", "unscored"),
    ]
    mockCalculateActualScore.mockReturnValue(null)

    const result = await calculateSubtotalScoreForStudent(
      "s1",
      "subtotal-region-1",
      scores,
      cropRegions
    )

    expect(result.score).toBeNull()
  })

  it("グループ定義が無い場合のフォールバックでも null 対応", async () => {
    mockGetCropSubtotalsByCropRegionId.mockResolvedValue([])

    const scores: QuestionScoreForSubtotal[] = [
      createQuestionScore("s1", "q1", "unscored"),
      createQuestionScore("s1", "q2", "unscored"),
    ]
    mockCalculateActualScore.mockReturnValue(null)

    const result = await calculateSubtotalScoreForStudent(
      "s1",
      "subtotal-region-1",
      scores,
      cropRegions
    )

    // フォールバック（calculateStudentTotalScoreWithMax）でもnull
    expect(result.score).toBeNull()
  })

  it("エラー時 → score が null", async () => {
    mockGetCropSubtotalsByCropRegionId.mockRejectedValue(new Error("DB error"))

    const result = await calculateSubtotalScoreForStudent(
      "s1",
      "subtotal-region-1",
      [],
      cropRegions
    )

    expect(result.score).toBeNull()
    expect(result.hasQuestionAssignments).toBe(false)
  })
})
