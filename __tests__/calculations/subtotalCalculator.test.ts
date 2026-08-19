/**
 * subtotalCalculator のnull score対応テスト
 *
 * テスト対象:
 * - computeSubtotalScore: hasScoredQuestion パターン（純粋）
 * - calculateSubtotalScoreForStudent: hasScoredQuestion パターン
 *
 * DB関数（getCropSubtotalsForScoring）と calculateActualScore をモックして
 * 純粋なロジックのみを検証する
 */
import type { CropRegion } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { StoredScoringStatus } from "@/types/scoringStatus.types"

// モック設定（import前に定義）
const mockGetCropSubtotalsForScoring = vi.fn()
const mockCalculateActualScore = vi.fn()

vi.mock("@/electron-src/lib/prisma/cropSubtotal", () => ({
  getCropSubtotalsForScoring: (...args: unknown[]) =>
    mockGetCropSubtotalsForScoring(...args),
}))

vi.mock("@/electron-src/lib/shared/calculations/actualScore", () => ({
  calculateActualScore: (...args: unknown[]) =>
    mockCalculateActualScore(...args),
}))

import {
  calculateSubtotalScoreForStudent,
  computeSubtotalScore,
  type QuestionAssignmentForSubtotal,
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

/**
 * 小計への設問割り当て1件。割り当て先の設問領域を実体で持つので、
 * 配点も所属試験もこの行から読める。
 */
function createQuestionAssignment(
  cropRegionId: string,
  examId: string,
  points: number,
  type: string = "QUESTION_ANSWER"
): QuestionAssignmentForSubtotal {
  return {
    cropRegion: { id: cropRegionId, type, points, examPage: { examId } },
  }
}

function createQuestionScore(
  examStudentId: string,
  cropRegionId: string,
  status: StoredScoringStatus,
  partialScore: number | null = null
): QuestionScoreForSubtotal {
  return { examStudentId, cropRegionId, status, partialScore }
}

// ================== computeSubtotalScore ==================

describe("computeSubtotalScore", () => {
  /** この小計に割り当てられた設問領域（呼び出し側が実体で渡す） */
  const questionAssignments = [
    createQuestionAssignment("q1", "exam1", 10),
    createQuestionAssignment("q2", "exam1", 20),
    createQuestionAssignment("q3", "exam1", 30),
  ]

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
      "exam1",
      scores,
      questionAssignments
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
      "exam1",
      scores,
      questionAssignments
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
      "exam1",
      scores,
      questionAssignments
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
      "exam1",
      scores,
      questionAssignments
    )

    expect(result.score).toBe(0)
    expect(result.hasQuestionAssignments).toBe(true)
  })

  it("割り当てが無い → null, hasQuestionAssignments=false", () => {
    const result = computeSubtotalScore("s1", "exam1", [], [])

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
      "exam1",
      scores,
      questionAssignments
    )

    expect(result.score).toBe(10)
    expect(result.maxScore).toBe(60) // q1+q2+q3 の配点合計
  })

  it("同じ設問が複数の割り当てで重複していても配点は1回だけ数える", () => {
    mockCalculateActualScore.mockReturnValue(10)

    const result = computeSubtotalScore(
      "s1",
      "exam1",
      [createQuestionScore("s1", "q1", "correct")],
      [
        createQuestionAssignment("q1", "exam1", 10),
        createQuestionAssignment("q1", "exam1", 10),
      ]
    )

    expect(result.score).toBe(10)
    expect(result.maxScore).toBe(10)
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

    // CropRegion(SUBTOTAL_SCORE) → CropSubtotal → Subtotal（割り当て同梱）のチェーン
    mockGetCropSubtotalsForScoring.mockResolvedValue([
      {
        subtotalId: "item1",
        cropRegionId: "subtotal-region-1",
        assignmentType: "SUBTOTAL_SCORE",
        subtotal: {
          subtotalGroupId: "group1",
          cropSubtotals: [
            createQuestionAssignment("q1", "exam1", 10),
            createQuestionAssignment("q2", "exam1", 20),
          ],
        },
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
      "exam1",
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
      "exam1",
      "subtotal-region-1",
      scores,
      cropRegions
    )

    expect(result.score).toBeNull()
  })

  it("グループ定義が無い場合のフォールバックでも null 対応", async () => {
    mockGetCropSubtotalsForScoring.mockResolvedValue([])

    const scores: QuestionScoreForSubtotal[] = [
      createQuestionScore("s1", "q1", "unscored"),
      createQuestionScore("s1", "q2", "unscored"),
    ]
    mockCalculateActualScore.mockReturnValue(null)

    const result = await calculateSubtotalScoreForStudent(
      "s1",
      "exam1",
      "subtotal-region-1",
      scores,
      cropRegions
    )

    // フォールバック（全設問合計）でもnull
    expect(result.score).toBeNull()
  })

  it("エラー時 → score が null", async () => {
    mockGetCropSubtotalsForScoring.mockRejectedValue(new Error("DB error"))

    const result = await calculateSubtotalScoreForStudent(
      "s1",
      "exam1",
      "subtotal-region-1",
      [],
      cropRegions
    )

    expect(result.score).toBeNull()
    expect(result.hasQuestionAssignments).toBe(false)
  })

  it("GROUP間ANDで共通する設問だけを算入する", async () => {
    // group1 は q1,q2 / group2 は q2 のみ → 共通は q2
    mockGetCropSubtotalsForScoring.mockResolvedValue([
      {
        subtotal: {
          subtotalGroupId: "group1",
          cropSubtotals: [
            createQuestionAssignment("q1", "exam1", 10),
            createQuestionAssignment("q2", "exam1", 20),
          ],
        },
      },
      {
        subtotal: {
          subtotalGroupId: "group2",
          cropSubtotals: [createQuestionAssignment("q2", "exam1", 20)],
        },
      },
    ])
    mockCalculateActualScore.mockReturnValue(20)

    const result = await calculateSubtotalScoreForStudent(
      "s1",
      "exam1",
      "subtotal-region-1",
      [
        createQuestionScore("s1", "q1", "correct"),
        createQuestionScore("s1", "q2", "correct"),
      ],
      cropRegions
    )

    expect(result.score).toBe(20)
    expect(result.maxScore).toBe(20)
  })
})

// ================== computeSubtotalScore（純粋・試験横断） ==================

/**
 * SubtotalGroup は複数の試験で共有されるため、割り当てには他試験の設問領域も
 * 混ざる。当該試験の設問領域だけを算入することを固定する。
 */
describe("computeSubtotalScore - 複数試験で共有された小計", () => {
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
    const questionAssignments = [
      createQuestionAssignment("examA-q1", "examA", 10),
      createQuestionAssignment("examA-q2", "examA", 20),
      createQuestionAssignment("examB-q1", "examB", 50),
    ]
    const scores: QuestionScoreForSubtotal[] = [
      createQuestionScore("s1", "examA-q1", "correct"),
      createQuestionScore("s1", "examA-q2", "correct"),
      // 試験Bの採点行が同じ配列に紛れていても拾わない
      createQuestionScore("s1", "examB-q1", "correct"),
    ]

    const result = computeSubtotalScore(
      "s1",
      "examA",
      scores,
      questionAssignments
    )

    expect(result.score).toBe(30)
    expect(result.maxScore).toBe(30)
    expect(result.hasQuestionAssignments).toBe(true)
  })

  it("当該試験の設問が1つも割り当てられていなければ hasQuestionAssignments は false", () => {
    const result = computeSubtotalScore(
      "s1",
      "examA",
      [createQuestionScore("s1", "examB-q1", "correct")],
      [
        createQuestionAssignment("examB-q1", "examB", 10),
        createQuestionAssignment("examB-q2", "examB", 20),
      ]
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

    const result = computeSubtotalScore("s1", "examA", scores, [
      createQuestionAssignment("examA-q1", "examA", 10),
      createQuestionAssignment("examA-q2", "examA", 20),
    ])

    // 満点は割り当て設問ぶん計上され、得点は本人の分だけ
    expect(result.score).toBe(10)
    expect(result.maxScore).toBe(30)
  })
})
