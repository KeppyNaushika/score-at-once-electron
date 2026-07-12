/**
 * gradeCalculator のユニットテスト（モックベース）
 *
 * Prismaとsubtotal関数をモックし、calculateGradesのロジックを検証
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

// === モック定義 ===

// subtotalCalculator
const mockCalculateSubtotalScoreBySubtotalId = vi.fn()
vi.mock("@/electron-src/lib/shared/calculations/subtotalCalculator", () => ({
  calculateSubtotalScoreBySubtotalId: (...args: unknown[]) =>
    mockCalculateSubtotalScoreBySubtotalId(...args),
}))

// questionScore
const mockCalculateActualScore = vi.fn()
vi.mock("@/electron-src/lib/prisma/questionScore", () => ({
  calculateActualScore: (...args: unknown[]) =>
    mockCalculateActualScore(...args),
}))

// Prisma client
const mockFindUnique = vi.fn()
const mockFindMany = vi.fn()
const mockGradeItemExclusionFindMany = vi.fn().mockResolvedValue([])

// computeLiveMaxScore は coursework 型の満点を courseworkItem.findUnique で引く。
// buildGrade が courseworkItemId → maxScore を登録し、モックはそれを返す。
const courseworkItemMaxScores = new Map<string, unknown>()
const mockCourseworkItemFindUnique = vi.fn(
  ({ where: { id } }: { where: { id: string } }) =>
    Promise.resolve(
      courseworkItemMaxScores.has(id)
        ? { maxScore: courseworkItemMaxScores.get(id) }
        : null
    )
)
// computeLiveMaxScore は coursework_total 型の満点を courseworkId で全項目を
// findMany して合算する。courseworkId → 各項目の {maxScore} を登録し、モックが返す。
const courseworkTotalItems = new Map<string, { maxScore: unknown }[]>()
const mockCourseworkItemFindMany = vi.fn(
  ({ where: { courseworkId } }: { where: { courseworkId: string } }) =>
    Promise.resolve(courseworkTotalItems.get(courseworkId) ?? [])
)
vi.mock("@/electron-src/lib/prisma/client", () => ({
  default: {
    grade: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    gradeStudent: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
    gradeOverride: { findMany: vi.fn().mockResolvedValue([]) },
    gradeItemExclusion: {
      findMany: (...args: unknown[]) => mockGradeItemExclusionFindMany(...args),
    },
    questionScore: { findMany: vi.fn().mockResolvedValue([]) },
    examPage: { findMany: vi.fn().mockResolvedValue([]) },
    examStudent: { findMany: vi.fn().mockResolvedValue([]) },
    courseworkItem: {
      findUnique: (...args: [{ where: { id: string } }]) =>
        mockCourseworkItemFindUnique(...args),
      findMany: (...args: [{ where: { courseworkId: string } }]) =>
        mockCourseworkItemFindMany(...args),
    },
  },
}))

import {
  applyAdjustmentAndClamp,
  estimateAbsentScore,
} from "@/electron-src/lib/shared/calculations/absentEstimation"
import { calculateGrades } from "@/electron-src/lib/shared/calculations/gradeCalculator"

// === ヘルパー ===

function buildGrade(
  overrides: {
    id?: string
    name?: string
    gradeItems?: {
      id: string
      name: string
      order: number
      dataSources: {
        id: string
        type: string
        name: string
        maxScore: unknown
        weight: unknown
        examId?: string | null
        subtotalId?: string | null
        cropRegionId?: string | null
        exam?: unknown
        subtotal?: unknown
        cropRegion?: unknown
        manualScores?: {
          studentId: string
          score?: unknown
          letterValue?: string | null
          adjustment?: unknown
          adjustmentReason?: string | null
          comment?: string | null
        }[]
        order: number
        absentMethod?: string
        absentRatio?: number
        absentOffset?: number
        treatExpectedAsMissing?: boolean
        estimationMode?: string
        estimationSourceIds?: string
        inputMode?: string
        letterScales?: { label: string; score: number; order: number }[]
      }[]
    }[]
    boundarySets?: {
      id: string
      targetType: string
      gradeItemId: string | null
      boundaries: {
        label: string
        minPercentage: unknown
        order: number
      }[]
    }[]
    gradeClassrooms?: {
      classroomId: string
      class: { id: string; name: string }
    }[]
  } = {}
) {
  // 満点は computeLiveMaxScore が courseworkItem.findUnique で引くため、
  // 各テストの満点を courseworkItemId にひもづけてモックへ登録し直す。
  courseworkItemMaxScores.clear()

  // 旧 manual 形式（manualScores/inputMode/letterScales をトップレベルに持つ）を、
  // 新スキーマの coursework 形式（courseworkItem に内包）へ変換する。
  // これによりテストケース本体は旧シグネチャのまま、calculator の新ロジックを検証できる。
  const gradeItems = (overrides.gradeItems ?? []).map((gradeItem) => ({
    ...gradeItem,
    dataSources: gradeItem.dataSources.map((dataSource) => {
      const isCoursework =
        dataSource.type === "manual" ||
        dataSource.type === "coursework" ||
        dataSource.manualScores !== undefined ||
        dataSource.inputMode !== undefined ||
        dataSource.letterScales !== undefined
      if (!isCoursework) {
        return { ...dataSource, courseworkItem: null }
      }
      // computeLiveMaxScore がこのIDで満点を引けるよう登録
      const courseworkItemId = `${dataSource.id}-item`
      courseworkItemMaxScores.set(courseworkItemId, dataSource.maxScore)
      return {
        ...dataSource,
        type: "coursework",
        courseworkItemId,
        courseworkItem: {
          maxScore: dataSource.maxScore,
          inputMode: dataSource.inputMode ?? "numeric",
          scores: dataSource.manualScores ?? [],
          letterScales: dataSource.letterScales ?? [],
        },
      }
    }),
  }))

  return {
    id: overrides.id ?? "gp1",
    name: overrides.name ?? "テストPJ",
    gradeItems,
    boundarySets: overrides.boundarySets ?? [],
    gradeClassrooms: overrides.gradeClassrooms ?? [],
  }
}

function buildStudent(
  overrides: {
    id?: string
    studentNumber?: string
    lastName?: string
    firstName?: string
  } = {}
) {
  return {
    student: {
      id: overrides.id ?? "s1",
      studentNumber: overrides.studentNumber ?? "S001",
      lastName: overrides.lastName ?? "テスト",
      firstName: overrides.firstName ?? "太郎",
      memberships: [],
    },
    customOrder: 0,
  }
}

describe("calculateGrades", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("試験が見つからない場合はエラー", async () => {
    mockFindUnique.mockResolvedValue(null)

    const result = await calculateGrades("non-existent")

    expect(result.success).toBe(false)
    expect(result.error).toBe("Grade exam not found")
  })

  it("生徒0人の場合は空配列を返す", async () => {
    const grade = buildGrade({
      gradeItems: [
        {
          id: "gi1",
          name: "知識",
          order: 0,
          dataSources: [],
        },
      ],
    })
    mockFindUnique.mockResolvedValue(grade)
    mockFindMany.mockResolvedValue([])

    const result = await calculateGrades("gp1")

    expect(result.success).toBe(true)
    expect(result.result!.students).toHaveLength(0)
    expect(result.result!.gradeItems).toHaveLength(1)
    expect(result.result!.gradeItems[0].name).toBe("知識")
  })

  it("manualタイプのDataSourceでスコアを正しく算出する", async () => {
    const grade = buildGrade({
      gradeItems: [
        {
          id: "gi1",
          name: "提出物",
          order: 0,
          dataSources: [
            {
              id: "ds1",
              type: "manual",
              name: "レポート",
              maxScore: 100,
              weight: 100,
              examId: null,
              subtotalId: null,
              cropRegionId: null,
              exam: null,
              subtotal: null,
              cropRegion: null,
              manualScores: [{ studentId: "s1", score: 85 }],
              order: 0,
            },
          ],
        },
      ],
      boundarySets: [
        {
          id: "bs1",
          targetType: "grade_item",
          gradeItemId: "gi1",
          boundaries: [
            { label: "A", minPercentage: 80, order: 0 },
            { label: "B", minPercentage: 60, order: 1 },
            { label: "C", minPercentage: 0, order: 2 },
          ],
        },
        {
          id: "bs2",
          targetType: "overall",
          gradeItemId: null,
          boundaries: [
            { label: "A", minPercentage: 80, order: 0 },
            { label: "B", minPercentage: 60, order: 1 },
            { label: "C", minPercentage: 0, order: 2 },
          ],
        },
      ],
    })
    mockFindUnique.mockResolvedValue(grade)
    mockFindMany.mockResolvedValue([buildStudent({ id: "s1" })])

    const result = await calculateGrades("gp1")

    expect(result.success).toBe(true)
    const student = result.result!.students[0]

    // manualスコア: 85/100 → 85%
    expect(student.gradeItemResults).toHaveLength(1)
    const gradeItemResult = student.gradeItemResults[0]
    expect(gradeItemResult.gradeItemId).toBe("gi1")
    expect(gradeItemResult.sourceScores[0].rawScore).toBe(85)
    expect(gradeItemResult.sourceScores[0].weightedScore).toBe(85)
    expect(gradeItemResult.percentage).toBeCloseTo(85, 1)
    expect(gradeItemResult.gradeLabel).toBe("A")
    expect(gradeItemResult.isAllMissing).toBe(false)

    // 総合
    expect(student.overallPercentage).toBeCloseTo(85, 1)
    expect(student.overallGradeLabel).toBe("A")
  })

  it("複数GradeItemの重み付け合計が正しく計算される", async () => {
    const grade = buildGrade({
      gradeItems: [
        {
          id: "gi1",
          name: "知識",
          order: 0,
          dataSources: [
            {
              id: "ds1",
              type: "manual",
              name: "テスト",
              maxScore: 100,
              weight: 50,
              examId: null,
              subtotalId: null,
              cropRegionId: null,
              exam: null,
              subtotal: null,
              cropRegion: null,
              manualScores: [{ studentId: "s1", score: 80 }],
              order: 0,
            },
          ],
        },
        {
          id: "gi2",
          name: "思考",
          order: 1,
          dataSources: [
            {
              id: "ds2",
              type: "manual",
              name: "レポート",
              maxScore: 50,
              weight: 50,
              examId: null,
              subtotalId: null,
              cropRegionId: null,
              exam: null,
              subtotal: null,
              cropRegion: null,
              manualScores: [{ studentId: "s1", score: 40 }],
              order: 0,
            },
          ],
        },
      ],
    })
    mockFindUnique.mockResolvedValue(grade)
    mockFindMany.mockResolvedValue([buildStudent({ id: "s1" })])

    const result = await calculateGrades("gp1")

    expect(result.success).toBe(true)
    const student = result.result!.students[0]

    // gi1: 80/100 * 50 = 40 (50max → 80%)
    expect(student.gradeItemResults[0].weightedScore).toBeCloseTo(40)
    expect(student.gradeItemResults[0].percentage).toBeCloseTo(80)

    // gi2: 40/50 * 50 = 40 (50max → 80%)
    expect(student.gradeItemResults[1].weightedScore).toBeCloseTo(40)
    expect(student.gradeItemResults[1].percentage).toBeCloseTo(80)

    // overall: (40 + 40) / (50 + 50) * 100 = 80%
    expect(student.overallScore).toBeCloseTo(80)
    expect(student.overallPercentage).toBeCloseTo(80)
  })

  it("manualScoreがnullの場合は換算合計0点として成績算出する", async () => {
    const grade = buildGrade({
      gradeItems: [
        {
          id: "gi1",
          name: "項目",
          order: 0,
          dataSources: [
            {
              id: "ds1",
              type: "manual",
              name: "外部",
              maxScore: 100,
              weight: 100,
              examId: null,
              subtotalId: null,
              cropRegionId: null,
              exam: null,
              subtotal: null,
              cropRegion: null,
              manualScores: [], // スコアなし
              order: 0,
            },
          ],
        },
      ],
    })
    mockFindUnique.mockResolvedValue(grade)
    mockFindMany.mockResolvedValue([buildStudent({ id: "s1" })])

    const result = await calculateGrades("gp1")
    const student = result.result!.students[0]

    expect(student.gradeItemResults[0].sourceScores[0].rawScore).toBeNull()
    expect(student.gradeItemResults[0].weightedScore).toBe(0)
    expect(student.gradeItemResults[0].weightedMaxScore).toBe(100)
    expect(student.gradeItemResults[0].percentage).toBe(0)
    expect(student.gradeItemResults[0].isAllMissing).toBe(true)
    expect(student.overallScore).toBe(0)
    expect(student.overallPercentage).toBe(0)
  })

  it("境界ラベルが降順で正しくマッチする", async () => {
    const grade = buildGrade({
      gradeItems: [
        {
          id: "gi1",
          name: "項目",
          order: 0,
          dataSources: [
            {
              id: "ds1",
              type: "manual",
              name: "テスト",
              maxScore: 100,
              weight: 100,
              examId: null,
              subtotalId: null,
              cropRegionId: null,
              exam: null,
              subtotal: null,
              cropRegion: null,
              manualScores: [{ studentId: "s1", score: 65 }],
              order: 0,
            },
          ],
        },
      ],
      boundarySets: [
        {
          id: "bs1",
          targetType: "overall",
          gradeItemId: null,
          boundaries: [
            { label: "A", minPercentage: 80, order: 0 },
            { label: "B", minPercentage: 60, order: 1 },
            { label: "C", minPercentage: 40, order: 2 },
            { label: "D", minPercentage: 0, order: 3 },
          ],
        },
      ],
    })
    mockFindUnique.mockResolvedValue(grade)
    mockFindMany.mockResolvedValue([buildStudent({ id: "s1" })])

    const result = await calculateGrades("gp1")
    const student = result.result!.students[0]

    // 65% → B (60以上80未満)
    expect(student.overallGradeLabel).toBe("B")
  })

  it("GradeItem内の複数DataSourceが正しく合算される", async () => {
    const grade = buildGrade({
      gradeItems: [
        {
          id: "gi1",
          name: "知識",
          order: 0,
          dataSources: [
            {
              id: "ds1",
              type: "manual",
              name: "テスト1",
              maxScore: 100,
              weight: 60,
              examId: null,
              subtotalId: null,
              cropRegionId: null,
              exam: null,
              subtotal: null,
              cropRegion: null,
              manualScores: [{ studentId: "s1", score: 90 }],
              order: 0,
            },
            {
              id: "ds2",
              type: "manual",
              name: "テスト2",
              maxScore: 50,
              weight: 40,
              examId: null,
              subtotalId: null,
              cropRegionId: null,
              exam: null,
              subtotal: null,
              cropRegion: null,
              manualScores: [{ studentId: "s1", score: 30 }],
              order: 1,
            },
          ],
        },
      ],
    })
    mockFindUnique.mockResolvedValue(grade)
    mockFindMany.mockResolvedValue([buildStudent({ id: "s1" })])

    const result = await calculateGrades("gp1")
    const student = result.result!.students[0]

    // ds1: 90/100 * 60 = 54
    // ds2: 30/50 * 40 = 24
    // 合計: 78, max: 100 → 78%
    const gradeItemResult = student.gradeItemResults[0]
    expect(gradeItemResult.sourceScores[0].weightedScore).toBeCloseTo(54)
    expect(gradeItemResult.sourceScores[1].weightedScore).toBeCloseTo(24)
    expect(gradeItemResult.weightedScore).toBeCloseTo(78)
    expect(gradeItemResult.percentage).toBeCloseTo(78)
  })

  // ===========================================================================
  // 欠席推定テスト（calculateGrades統合）
  // ===========================================================================

  it("absentMethod='null' → rawScoreがnullのまま（既存動作維持）", async () => {
    const grade = buildGrade({
      gradeItems: [
        {
          id: "gi1",
          name: "項目",
          order: 0,
          dataSources: [
            {
              id: "ds1",
              type: "manual",
              name: "テスト",
              maxScore: 100,
              weight: 100,
              examId: null,
              subtotalId: null,
              cropRegionId: null,
              exam: null,
              subtotal: null,
              cropRegion: null,
              manualScores: [],
              order: 0,
              absentMethod: "null",
              absentRatio: 1,
              absentOffset: 0,
            },
          ],
        },
      ],
    })
    mockFindUnique.mockResolvedValue(grade)
    mockFindMany.mockResolvedValue([buildStudent({ id: "s1" })])

    const result = await calculateGrades("gp1")
    const sourceScore =
      result.result!.students[0].gradeItemResults[0].sourceScores[0]
    expect(sourceScore.rawScore).toBeNull()
    expect(sourceScore.isEstimated).toBe(false)
  })

  it("absentMethod='zero' → nullを0に置換、isEstimated=true", async () => {
    const grade = buildGrade({
      gradeItems: [
        {
          id: "gi1",
          name: "項目",
          order: 0,
          dataSources: [
            {
              id: "ds1",
              type: "manual",
              name: "テスト",
              maxScore: 100,
              weight: 100,
              examId: null,
              subtotalId: null,
              cropRegionId: null,
              exam: null,
              subtotal: null,
              cropRegion: null,
              manualScores: [],
              order: 0,
              absentMethod: "zero",
              absentRatio: 1,
              absentOffset: 0,
            },
          ],
        },
      ],
    })
    mockFindUnique.mockResolvedValue(grade)
    mockFindMany.mockResolvedValue([buildStudent({ id: "s1" })])

    const result = await calculateGrades("gp1")
    const sourceScore =
      result.result!.students[0].gradeItemResults[0].sourceScores[0]
    expect(sourceScore.rawScore).toBe(0)
    expect(sourceScore.isEstimated).toBe(true)
  })

  // ===========================================================================
  // GradeItem除外テスト
  // ===========================================================================

  it("除外されたGradeItemはisExcluded=true、全スコアnull", async () => {
    const grade = buildGrade({
      gradeItems: [
        {
          id: "gi1",
          name: "知識",
          order: 0,
          dataSources: [
            {
              id: "ds1",
              type: "manual",
              name: "テスト",
              maxScore: 100,
              weight: 100,
              examId: null,
              subtotalId: null,
              cropRegionId: null,
              exam: null,
              subtotal: null,
              cropRegion: null,
              manualScores: [{ studentId: "s1", score: 85 }],
              order: 0,
            },
          ],
        },
        {
          id: "gi2",
          name: "思考",
          order: 1,
          dataSources: [
            {
              id: "ds2",
              type: "manual",
              name: "レポート",
              maxScore: 100,
              weight: 100,
              examId: null,
              subtotalId: null,
              cropRegionId: null,
              exam: null,
              subtotal: null,
              cropRegion: null,
              manualScores: [{ studentId: "s1", score: 70 }],
              order: 0,
            },
          ],
        },
      ],
    })
    mockFindUnique.mockResolvedValue(grade)
    mockFindMany.mockResolvedValue([buildStudent({ id: "s1" })])
    // s1をgi2から除外
    mockGradeItemExclusionFindMany.mockResolvedValue([
      { studentId: "s1", gradeItemId: "gi2" },
    ])

    const result = await calculateGrades("gp1")

    expect(result.success).toBe(true)
    const student = result.result!.students[0]

    // gi1は通常計算
    expect(student.gradeItemResults[0].isExcluded).toBe(false)
    expect(student.gradeItemResults[0].weightedScore).toBeCloseTo(85)

    // gi2は除外
    expect(student.gradeItemResults[1].isExcluded).toBe(true)
    expect(student.gradeItemResults[1].weightedScore).toBeNull()
    expect(student.gradeItemResults[1].percentage).toBeNull()
    expect(student.gradeItemResults[1].sourceScores).toHaveLength(0)

    // 総合スコアはgi1のみ（100点満点で85%）
    expect(student.overallMaxScore).toBe(100)
    expect(student.overallScore).toBeCloseTo(85)
    expect(student.overallPercentage).toBeCloseTo(85)
  })

  it("全GradeItem除外時は総合スコアnull", async () => {
    const grade = buildGrade({
      gradeItems: [
        {
          id: "gi1",
          name: "知識",
          order: 0,
          dataSources: [
            {
              id: "ds1",
              type: "manual",
              name: "テスト",
              maxScore: 100,
              weight: 100,
              examId: null,
              subtotalId: null,
              cropRegionId: null,
              exam: null,
              subtotal: null,
              cropRegion: null,
              manualScores: [{ studentId: "s1", score: 85 }],
              order: 0,
            },
          ],
        },
      ],
    })
    mockFindUnique.mockResolvedValue(grade)
    mockFindMany.mockResolvedValue([buildStudent({ id: "s1" })])
    // 全項目除外
    mockGradeItemExclusionFindMany.mockResolvedValue([
      { studentId: "s1", gradeItemId: "gi1" },
    ])

    const result = await calculateGrades("gp1")
    const student = result.result!.students[0]

    expect(student.gradeItemResults[0].isExcluded).toBe(true)
    expect(student.overallMaxScore).toBe(0)
    expect(student.overallScore).toBeNull()
    expect(student.overallPercentage).toBeNull()
  })

  it("除外なしの既存動作維持（isExcluded: false）", async () => {
    const grade = buildGrade({
      gradeItems: [
        {
          id: "gi1",
          name: "知識",
          order: 0,
          dataSources: [
            {
              id: "ds1",
              type: "manual",
              name: "テスト",
              maxScore: 100,
              weight: 100,
              examId: null,
              subtotalId: null,
              cropRegionId: null,
              exam: null,
              subtotal: null,
              cropRegion: null,
              manualScores: [{ studentId: "s1", score: 80 }],
              order: 0,
            },
          ],
        },
      ],
    })
    mockFindUnique.mockResolvedValue(grade)
    mockFindMany.mockResolvedValue([buildStudent({ id: "s1" })])
    mockGradeItemExclusionFindMany.mockResolvedValue([])

    const result = await calculateGrades("gp1")
    const student = result.result!.students[0]

    expect(student.gradeItemResults[0].isExcluded).toBe(false)
    expect(student.gradeItemResults[0].weightedScore).toBeCloseTo(80)
    expect(student.overallPercentage).toBeCloseTo(80)
  })

  // ===========================================================================
  // 文字評価（letterモード）+ 加減点テスト
  // ===========================================================================

  it("letterモード: 評価記号を変換表で点数化する", async () => {
    const grade = buildGrade({
      gradeItems: [
        {
          id: "gi1",
          name: "提出物",
          order: 0,
          dataSources: [
            {
              id: "ds1",
              type: "manual",
              name: "授業態度",
              maxScore: 100,
              weight: 100,
              examId: null,
              subtotalId: null,
              cropRegionId: null,
              exam: null,
              subtotal: null,
              cropRegion: null,
              inputMode: "letter",
              letterScales: [
                { label: "A", score: 100, order: 0 },
                { label: "B", score: 80, order: 1 },
                { label: "C", score: 60, order: 2 },
              ],
              manualScores: [{ studentId: "s1", letterValue: "B" }],
              order: 0,
            },
          ],
        },
      ],
      boundarySets: [
        {
          id: "bs1",
          targetType: "grade_item",
          gradeItemId: "gi1",
          boundaries: [
            { label: "A", minPercentage: 90, order: 0 },
            { label: "B", minPercentage: 70, order: 1 },
            { label: "C", minPercentage: 0, order: 2 },
          ],
        },
      ],
    })
    mockFindUnique.mockResolvedValue(grade)
    mockFindMany.mockResolvedValue([buildStudent({ id: "s1" })])

    const result = await calculateGrades("gp1")
    const sourceScore =
      result.result!.students[0].gradeItemResults[0].sourceScores[0]

    // B → 80点
    expect(sourceScore.rawScore).toBe(80)
    expect(sourceScore.letterValue).toBe("B")
    expect(
      result.result!.students[0].gradeItemResults[0].percentage
    ).toBeCloseTo(80)
    // 80% → 評価B
    expect(result.result!.students[0].gradeItemResults[0].gradeLabel).toBe("B")
  })

  it("letterモード: 未定義の評価記号はnull", async () => {
    const grade = buildGrade({
      gradeItems: [
        {
          id: "gi1",
          name: "提出物",
          order: 0,
          dataSources: [
            {
              id: "ds1",
              type: "manual",
              name: "授業態度",
              maxScore: 100,
              weight: 100,
              examId: null,
              subtotalId: null,
              cropRegionId: null,
              exam: null,
              subtotal: null,
              cropRegion: null,
              inputMode: "letter",
              letterScales: [{ label: "A", score: 100, order: 0 }],
              manualScores: [{ studentId: "s1", letterValue: "Z" }],
              order: 0,
            },
          ],
        },
      ],
    })
    mockFindUnique.mockResolvedValue(grade)
    mockFindMany.mockResolvedValue([buildStudent({ id: "s1" })])

    const result = await calculateGrades("gp1")
    const sourceScore =
      result.result!.students[0].gradeItemResults[0].sourceScores[0]
    expect(sourceScore.rawScore).toBeNull()
  })

  it("加減点: 数値スコアに加算しクランプする", async () => {
    const grade = buildGrade({
      gradeItems: [
        {
          id: "gi1",
          name: "提出物",
          order: 0,
          dataSources: [
            {
              id: "ds1",
              type: "manual",
              name: "レポート",
              maxScore: 100,
              weight: 100,
              examId: null,
              subtotalId: null,
              cropRegionId: null,
              exam: null,
              subtotal: null,
              cropRegion: null,
              inputMode: "numeric",
              manualScores: [
                {
                  studentId: "s1",
                  score: 85,
                  adjustment: -10,
                  adjustmentReason: "期限超過",
                },
              ],
              order: 0,
            },
          ],
        },
      ],
    })
    mockFindUnique.mockResolvedValue(grade)
    mockFindMany.mockResolvedValue([buildStudent({ id: "s1" })])

    const result = await calculateGrades("gp1")
    const sourceScore =
      result.result!.students[0].gradeItemResults[0].sourceScores[0]

    // 85 - 10 = 75
    expect(sourceScore.rawScore).toBe(75)
    expect(sourceScore.adjustment).toBe(-10)
    expect(sourceScore.adjustmentReason).toBe("期限超過")
  })

  it("加減点: letterモードの点数にも加算され、配点超えも反映される", async () => {
    const grade = buildGrade({
      gradeItems: [
        {
          id: "gi1",
          name: "提出物",
          order: 0,
          dataSources: [
            {
              id: "ds1",
              type: "manual",
              name: "授業態度",
              maxScore: 100,
              weight: 100,
              examId: null,
              subtotalId: null,
              cropRegionId: null,
              exam: null,
              subtotal: null,
              cropRegion: null,
              inputMode: "letter",
              letterScales: [{ label: "A", score: 100, order: 0 }],
              manualScores: [
                { studentId: "s1", letterValue: "A", adjustment: 20 },
              ],
              order: 0,
            },
          ],
        },
      ],
    })
    mockFindUnique.mockResolvedValue(grade)
    mockFindMany.mockResolvedValue([buildStudent({ id: "s1" })])

    const result = await calculateGrades("gp1")
    const sourceScore =
      result.result!.students[0].gradeItemResults[0].sourceScores[0]

    // A(100) + 20 = 120。上限クランプを行わないため配点(100)超えがそのまま反映される
    expect(sourceScore.rawScore).toBe(120)
    // 換算得点も weight(100) を超える（120/100*100 = 120）
    expect(sourceScore.weightedScore).toBe(120)
  })

  it("加減点: 減点で0未満になっても下限クランプせずそのまま反映される", async () => {
    const grade = buildGrade({
      gradeItems: [
        {
          id: "gi1",
          name: "提出物",
          order: 0,
          dataSources: [
            {
              id: "ds1",
              type: "manual",
              name: "レポート",
              maxScore: 100,
              weight: 100,
              examId: null,
              subtotalId: null,
              cropRegionId: null,
              exam: null,
              subtotal: null,
              cropRegion: null,
              inputMode: "numeric",
              manualScores: [{ studentId: "s1", score: 10, adjustment: -30 }],
              order: 0,
            },
          ],
        },
      ],
    })
    mockFindUnique.mockResolvedValue(grade)
    mockFindMany.mockResolvedValue([buildStudent({ id: "s1" })])

    const result = await calculateGrades("gp1")
    const sourceScore =
      result.result!.students[0].gradeItemResults[0].sourceScores[0]

    // 10 - 30 = -20。下限クランプを行わないため負値もそのまま反映される
    expect(sourceScore.rawScore).toBe(-20)
    expect(sourceScore.weightedScore).toBe(-20)
  })

  it("コメントがsourceScoresに添付される", async () => {
    const grade = buildGrade({
      gradeItems: [
        {
          id: "gi1",
          name: "提出物",
          order: 0,
          dataSources: [
            {
              id: "ds1",
              type: "manual",
              name: "レポート",
              maxScore: 100,
              weight: 100,
              examId: null,
              subtotalId: null,
              cropRegionId: null,
              exam: null,
              subtotal: null,
              cropRegion: null,
              manualScores: [
                {
                  studentId: "s1",
                  score: 90,
                  comment: "とても良い内容でした",
                },
              ],
              order: 0,
            },
          ],
        },
      ],
    })
    mockFindUnique.mockResolvedValue(grade)
    mockFindMany.mockResolvedValue([buildStudent({ id: "s1" })])

    const result = await calculateGrades("gp1")
    const sourceScore =
      result.result!.students[0].gradeItemResults[0].sourceScores[0]
    expect(sourceScore.comment).toBe("とても良い内容でした")
  })

  it("実スコアがある場合 → isEstimated=false", async () => {
    const grade = buildGrade({
      gradeItems: [
        {
          id: "gi1",
          name: "項目",
          order: 0,
          dataSources: [
            {
              id: "ds1",
              type: "manual",
              name: "テスト",
              maxScore: 100,
              weight: 100,
              examId: null,
              subtotalId: null,
              cropRegionId: null,
              exam: null,
              subtotal: null,
              cropRegion: null,
              manualScores: [{ studentId: "s1", score: 75 }],
              order: 0,
              absentMethod: "zero",
              absentRatio: 0.8,
              absentOffset: -5,
            },
          ],
        },
      ],
    })
    mockFindUnique.mockResolvedValue(grade)
    mockFindMany.mockResolvedValue([buildStudent({ id: "s1" })])

    const result = await calculateGrades("gp1")
    const sourceScore =
      result.result!.students[0].gradeItemResults[0].sourceScores[0]
    expect(sourceScore.rawScore).toBe(75)
    expect(sourceScore.isEstimated).toBe(false)
  })

  it("coursework_total: 資料の全評価項目のスコア・満点を合算する", async () => {
    // 資料 cw1 は2項目（満点 50 + 30 = 80）。生徒 s1 は 40 + 30 = 70 点。
    courseworkTotalItems.clear()
    courseworkTotalItems.set("cw1", [{ maxScore: 50 }, { maxScore: 30 }])

    const grade = {
      id: "gp1",
      name: "PJ",
      gradeItems: [
        {
          id: "gi1",
          name: "資料",
          order: 0,
          dataSources: [
            {
              id: "ds1",
              type: "coursework_total",
              name: "資料合計",
              examId: null,
              subtotalId: null,
              cropRegionId: null,
              courseworkItemId: null,
              courseworkId: "cw1",
              exam: null,
              subtotal: null,
              cropRegion: null,
              courseworkItem: null,
              coursework: {
                items: [
                  {
                    maxScore: 50,
                    inputMode: "numeric",
                    scores: [{ studentId: "s1", score: 40 }],
                    letterScales: [],
                  },
                  {
                    maxScore: 30,
                    inputMode: "numeric",
                    scores: [{ studentId: "s1", score: 30 }],
                    letterScales: [],
                  },
                ],
              },
              weight: 100,
              order: 0,
              absentMethod: "null",
              absentRatio: 1,
              absentOffset: 0,
              treatExpectedAsMissing: false,
              estimationMode: "all",
              estimationSourceIds: "[]",
            },
          ],
        },
      ],
      boundarySets: [],
      gradeClassrooms: [],
    }
    mockFindUnique.mockResolvedValue(grade)
    mockFindMany.mockResolvedValue([
      buildStudent({ id: "s1" }),
      buildStudent({ id: "s2", studentNumber: "S002" }),
    ])

    const result = await calculateGrades("gp1")

    // s1: 合算 70点 / 満点 80点 → 換算 70/80*100 = 87.5
    const student1SourceScore =
      result.result!.students[0].gradeItemResults[0].sourceScores[0]
    expect(student1SourceScore.rawScore).toBe(70)
    expect(student1SourceScore.maxScore).toBe(80)
    expect(student1SourceScore.weightedScore).toBe(87.5)

    // s2: 全項目未入力 → rawScore は null（absentMethod="null" のため推定なし）
    const student2Item = result.result!.students[1].gradeItemResults[0]
    expect(student2Item.sourceScores[0].rawScore).toBeNull()
    expect(student2Item.isAllMissing).toBe(true)
  })
})

// =============================================================================
// estimateAbsentScore + applyAdjustmentAndClamp ユニットテスト
// =============================================================================

describe("estimateAbsentScore", () => {
  const dataSourceDefaults = {
    estimationMode: "all" as const,
    estimationSourceIds: [] as string[],
  }

  it("method='zero' → 0を返す", () => {
    const rawScoreMap = new Map<string, Map<string, number | null>>()
    rawScoreMap.set("s1", new Map([["ds1", null]]))
    const result = estimateAbsentScore("zero", "s1", "ds1", 100, rawScoreMap, [
      {
        id: "ds1",
        maxScore: 100,
        absentMethod: "zero",
        absentRatio: 1,
        absentOffset: 0,
        ...dataSourceDefaults,
      },
    ])
    expect(result).toBe(0)
  })

  it("method='average' → 他DataSourceの比率から推定", () => {
    // s1: ds1=null, ds2=80/100=0.8, ds3=30/50=0.6
    // average ratio = (0.8 + 0.6) / 2 = 0.7
    // estimated = 0.7 * 200 = 140 → clamp(140, 0, 200) = 140
    const rawScoreMap = new Map<string, Map<string, number | null>>()
    rawScoreMap.set(
      "s1",
      new Map([
        ["ds1", null],
        ["ds2", 80],
        ["ds3", 30],
      ])
    )
    const allDataSources = [
      {
        id: "ds1",
        maxScore: 200,
        absentMethod: "average" as const,
        absentRatio: 1,
        absentOffset: 0,
        ...dataSourceDefaults,
      },
      {
        id: "ds2",
        maxScore: 100,
        absentMethod: "null" as const,
        absentRatio: 1,
        absentOffset: 0,
        ...dataSourceDefaults,
      },
      {
        id: "ds3",
        maxScore: 50,
        absentMethod: "null" as const,
        absentRatio: 1,
        absentOffset: 0,
        ...dataSourceDefaults,
      },
    ]
    const result = estimateAbsentScore(
      "average",
      "s1",
      "ds1",
      200,
      rawScoreMap,
      allDataSources
    )
    expect(result).toBeCloseTo(140)
  })

  it("method='average' → 他DataSourceがない場合はnull", () => {
    const rawScoreMap = new Map<string, Map<string, number | null>>()
    rawScoreMap.set("s1", new Map([["ds1", null]]))
    const allDataSources = [
      {
        id: "ds1",
        maxScore: 100,
        absentMethod: "average" as const,
        absentRatio: 1,
        absentOffset: 0,
        ...dataSourceDefaults,
      },
    ]
    const result = estimateAbsentScore(
      "average",
      "s1",
      "ds1",
      100,
      rawScoreMap,
      allDataSources
    )
    expect(result).toBeNull()
  })

  it("method='regression' → OLS重回帰法推定", () => {
    // 4人の生徒（s1が欠測、s2-s4が訓練データ）
    // ds1(目的変数): s2=70, s3=90, s4=60
    // ds2(説明変数): s1=60, s2=40, s3=80, s4=30
    // OLS: Y=[70,90,60], X=[[1,40],[1,80],[1,30]]
    const rawScoreMap = new Map<string, Map<string, number | null>>()
    rawScoreMap.set(
      "s1",
      new Map([
        ["ds1", null],
        ["ds2", 60],
      ])
    )
    rawScoreMap.set(
      "s2",
      new Map([
        ["ds1", 70],
        ["ds2", 40],
      ])
    )
    rawScoreMap.set(
      "s3",
      new Map([
        ["ds1", 90],
        ["ds2", 80],
      ])
    )
    rawScoreMap.set(
      "s4",
      new Map([
        ["ds1", 60],
        ["ds2", 30],
      ])
    )

    const allDataSources = [
      {
        id: "ds1",
        maxScore: 100,
        absentMethod: "regression" as const,
        absentRatio: 1,
        absentOffset: 0,
        ...dataSourceDefaults,
      },
      {
        id: "ds2",
        maxScore: 100,
        absentMethod: "null" as const,
        absentRatio: 1,
        absentOffset: 0,
        ...dataSourceDefaults,
      },
    ]
    const result = estimateAbsentScore(
      "regression",
      "s1",
      "ds1",
      100,
      rawScoreMap,
      allDataSources
    )
    // 結果はOLS回帰の予測値で、0-100の範囲内であること
    expect(result).not.toBeNull()
    expect(result!).toBeGreaterThanOrEqual(0)
    expect(result!).toBeLessThanOrEqual(100)
  })

  it("method='regression' → サンプル不足は平均比率法にフォールバック", () => {
    // 他生徒1人のみ → minSamples未満 → averageにフォールバック
    const rawScoreMap = new Map<string, Map<string, number | null>>()
    rawScoreMap.set(
      "s1",
      new Map([
        ["ds1", null],
        ["ds2", 60],
      ])
    )
    rawScoreMap.set(
      "s2",
      new Map([
        ["ds1", 80],
        ["ds2", 40],
      ])
    )

    const allDataSources = [
      {
        id: "ds1",
        maxScore: 100,
        absentMethod: "regression" as const,
        absentRatio: 1,
        absentOffset: 0,
        ...dataSourceDefaults,
      },
      {
        id: "ds2",
        maxScore: 100,
        absentMethod: "null" as const,
        absentRatio: 1,
        absentOffset: 0,
        ...dataSourceDefaults,
      },
    ]
    const result = estimateAbsentScore(
      "regression",
      "s1",
      "ds1",
      100,
      rawScoreMap,
      allDataSources
    )
    // averageフォールバック: s1のds2比率=60/100=0.6 → 0.6*100=60
    expect(result).toBeCloseTo(60)
  })

  it("method='regression' → 説明変数なしはnull", () => {
    const rawScoreMap = new Map<string, Map<string, number | null>>()
    rawScoreMap.set("s1", new Map([["ds1", null]]))
    rawScoreMap.set("s2", new Map([["ds1", 80]]))

    const allDataSources = [
      {
        id: "ds1",
        maxScore: 100,
        absentMethod: "regression" as const,
        absentRatio: 1,
        absentOffset: 0,
        ...dataSourceDefaults,
      },
    ]
    const result = estimateAbsentScore(
      "regression",
      "s1",
      "ds1",
      100,
      rawScoreMap,
      allDataSources
    )
    expect(result).toBeNull()
  })
})

describe("applyAdjustmentAndClamp", () => {
  it("ratio + offsetの適用", () => {
    // 80 * 0.8 + (-5) = 59
    expect(applyAdjustmentAndClamp(80, 0.8, -5, 100)).toBe(59)
  })

  it("下限クランプ: 0を下回らない", () => {
    // 10 * 0.5 + (-20) = -15 → 0
    expect(applyAdjustmentAndClamp(10, 0.5, -20, 100)).toBe(0)
  })

  it("上限クランプ: maxScoreを超えない", () => {
    // 90 * 1.5 + 10 = 145 → 100
    expect(applyAdjustmentAndClamp(90, 1.5, 10, 100)).toBe(100)
  })

  it("小数点以下2桁に丸められる", () => {
    // 33.333 * 1 + 0 = 33.333... → 33.33
    expect(applyAdjustmentAndClamp(33.333, 1, 0, 100)).toBe(33.33)
  })
})
