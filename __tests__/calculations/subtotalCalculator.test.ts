/**
 * subtotalCalculator のnull score対応テスト
 *
 * テスト対象:
 * - computeSubtotalScore: hasScoredQuestion パターン（純粋）
 * - calculateSubtotalScoreForStudent: hasScoredQuestion パターン
 *
 * DB関数（getCropSubtotals*）と calculateActualScore をモックして
 * 純粋なロジックのみを検証する
 */
import type { CropRegion } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

// モック設定（import前に定義）
const mockGetCropSubtotalsByCropRegionId = vi.fn()
const mockGetQuestionAssignmentsBySubtotalIds = vi.fn()
const mockCalculateActualScore = vi.fn()

vi.mock("@/electron-src/lib/prisma/cropSubtotal", () => ({
  getCropSubtotalsByCropRegionId: (...args: unknown[]) =>
    mockGetCropSubtotalsByCropRegionId(...args),
  getQuestionAssignmentsBySubtotalIds: (...args: unknown[]) =>
    mockGetQuestionAssignmentsBySubtotalIds(...args),
}))

vi.mock("@/electron-src/lib/shared/calculations/actualScore", () => ({
  calculateActualScore: (...args: unknown[]) =>
    mockCalculateActualScore(...args),
}))

import {
  calculateSubtotalScoreForStudent,
  computeSubtotalScore,
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
  examStudentId: string,
  cropRegionId: string,
  status: string,
  partialScore: number | null = null
): QuestionScoreForSubtotal {
  return { examStudentId, cropRegionId, status, partialScore }
}

// ================== computeSubtotalScore ==================

describe("computeSubtotalScore", () => {
  const cropRegions = [
    createCropRegion({ id: "q1", points: 10 }),
    createCropRegion({ id: "q2", points: 20 }),
    createCropRegion({ id: "q3", points: 30 }),
  ]
  /** この小計に割り当てられた設問領域（呼び出し側が事前取得して渡す） */
  const assignedCropRegionIds = ["q1", "q2", "q3"]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("全設問採点済み → score に合計点を返す", () => {
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

    const result = computeSubtotalScore(
      "s1",
      scores,
      cropRegions,
      assignedCropRegionIds
    )

    expect(result.score).toBe(25)
    expect(result.maxScore).toBe(60)
    expect(result.hasQuestionAssignments).toBe(true)
  })

  it("全設問未採点 → score が null", () => {
    const scores: QuestionScoreForSubtotal[] = [
      createQuestionScore("s1", "q1", "unscored"),
      createQuestionScore("s1", "q2", "unscored"),
      createQuestionScore("s1", "q3", "unscored"),
    ]
    // unscored→null
    mockCalculateActualScore.mockReturnValue(null)

    const result = computeSubtotalScore(
      "s1",
      scores,
      cropRegions,
      assignedCropRegionIds
    )

    expect(result.score).toBeNull()
    expect(result.maxScore).toBe(60)
    expect(result.hasQuestionAssignments).toBe(true)
  })

  it("一部未採点 → 採点済み分のみの合計を返す", () => {
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

    const result = computeSubtotalScore(
      "s1",
      scores,
      cropRegions,
      assignedCropRegionIds
    )

    expect(result.score).toBe(40) // 10 + 30
    expect(result.hasQuestionAssignments).toBe(true)
  })

  it("全問不正解（0点） → score が 0（null ではない）", () => {
    const scores: QuestionScoreForSubtotal[] = [
      createQuestionScore("s1", "q1", "incorrect"),
      createQuestionScore("s1", "q2", "incorrect"),
      createQuestionScore("s1", "q3", "incorrect"),
    ]
    mockCalculateActualScore.mockReturnValue(0)

    const result = computeSubtotalScore(
      "s1",
      scores,
      cropRegions,
      assignedCropRegionIds
    )

    expect(result.score).toBe(0)
    expect(result.hasQuestionAssignments).toBe(true)
  })

  it("割り当てが無い → null, hasQuestionAssignments=false", () => {
    const result = computeSubtotalScore("s1", [], cropRegions, [])

    expect(result.score).toBeNull()
    expect(result.hasQuestionAssignments).toBe(false)
  })

  it("採点データが存在しない設問は加算されない", () => {
    // s1 は q1 のみ採点済み、q2,q3 は採点データ自体が無い
    const scores: QuestionScoreForSubtotal[] = [
      createQuestionScore("s1", "q1", "correct"),
    ]
    mockCalculateActualScore.mockReturnValueOnce(10)

    const result = computeSubtotalScore(
      "s1",
      scores,
      cropRegions,
      assignedCropRegionIds
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
    mockGetQuestionAssignmentsBySubtotalIds.mockResolvedValue(
      new Map([["item1", ["q1", "q2"]]])
    )
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

// ================== computeSubtotalScore（純粋・試験横断） ==================

/**
 * SubtotalGroup は複数の試験で共有されるため、割り当てには他試験の設問領域 id も
 * 混ざる。当該試験の設問領域だけを算入することを固定する。
 */
describe("computeSubtotalScore - 複数試験で共有された小計", () => {
  const examACropRegions = [
    createCropRegion({ id: "examA-q1", points: 10 }),
    createCropRegion({ id: "examA-q2", points: 20 }),
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    // 配点をそのまま得点として返す（正答のみ）
    mockCalculateActualScore.mockImplementation(
      (questionScore: { status: string }, maxScore: number) =>
        questionScore.status === "correct" ? maxScore : null
    )
  })

  it("他試験の設問領域は得点にも満点にも算入しない", () => {
    // 割り当てには試験Bの設問（examB-q1）も含まれる
    const assignedCropRegionIds = ["examA-q1", "examA-q2", "examB-q1"]
    const scores: QuestionScoreForSubtotal[] = [
      createQuestionScore("s1", "examA-q1", "correct"),
      createQuestionScore("s1", "examA-q2", "correct"),
      // 試験Bの採点行が同じ配列に紛れていても拾わない
      createQuestionScore("s1", "examB-q1", "correct"),
    ]

    const result = computeSubtotalScore(
      "s1",
      scores,
      examACropRegions,
      assignedCropRegionIds
    )

    expect(result.score).toBe(30)
    expect(result.maxScore).toBe(30)
    expect(result.hasQuestionAssignments).toBe(true)
  })

  it("当該試験の設問が1つも割り当てられていなければ hasQuestionAssignments は false", () => {
    const result = computeSubtotalScore(
      "s1",
      [createQuestionScore("s1", "examB-q1", "correct")],
      examACropRegions,
      ["examB-q1", "examB-q2"]
    )

    expect(result.hasQuestionAssignments).toBe(false)
    expect(result.score).toBeNull()
    expect(result.maxScore).toBe(0)
  })

  it("他の生徒の採点行は算入しない", () => {
    const scores: QuestionScoreForSubtotal[] = [
      createQuestionScore("s1", "examA-q1", "correct"),
      createQuestionScore("s2", "examA-q2", "correct"),
    ]

    const result = computeSubtotalScore("s1", scores, examACropRegions, [
      "examA-q1",
      "examA-q2",
    ])

    // 満点は割り当て設問ぶん計上され、得点は本人の分だけ
    expect(result.score).toBe(10)
    expect(result.maxScore).toBe(30)
  })
})
