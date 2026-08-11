/**
 * gradeCalculator のユニットテスト（モックベース）
 *
 * Prismaとsubtotal関数をモックし、calculateGradesのロジックを検証
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

// === モック定義 ===
//
// subtotalCalculator はDBに触れない純粋関数になったのでモックしない。
// 小計の算出は本物を通し、割り当ての取得（prisma.cropSubtotal）だけをモックする。

// actualScore
const mockCalculateActualScore = vi.fn()
vi.mock("@/electron-src/lib/shared/calculations/actualScore", () => ({
  calculateActualScore: (...args: unknown[]) =>
    mockCalculateActualScore(...args),
}))

// Prisma client
const mockFindUnique = vi.fn()
const mockFindMany = vi.fn()
const mockExamPageFindMany = vi.fn()
const mockExamStudentFindMany = vi.fn()
// 小計の設問割り当ても満点の元データも Grade の取得に同梱されるので、
// このモックは「別クエリが立っていないこと」を見張るためだけに置く。
const mockCropSubtotalFindMany = vi.fn().mockResolvedValue([])
vi.mock("@/electron-src/lib/prisma/client", () => ({
  default: {
    grade: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    gradeStudent: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
    questionScore: { findMany: vi.fn().mockResolvedValue([]) },
    examPage: {
      findMany: (...args: unknown[]) => mockExamPageFindMany(...args),
    },
    examStudent: {
      findMany: (...args: unknown[]) => mockExamStudentFindMany(...args),
    },
    cropSubtotal: {
      findMany: (...args: unknown[]) => mockCropSubtotalFindMany(...args),
    },
  },
}))

import {
  applyAdjustmentAndClamp,
  estimateAbsentScore,
} from "@/electron-src/lib/shared/calculations/absentEstimation"
import { calculateGrades } from "@/electron-src/lib/shared/calculations/gradeCalculator"
import type { DataSourceInfo } from "@/electron-src/lib/shared/calculations/gradeCalculatorTypes"
import type { RawScoreRowEntity } from "@/electron-src/lib/shared/calculations/rawScoreMatrix"
import { RawScoreMatrix } from "@/electron-src/lib/shared/calculations/rawScoreMatrix"

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
        estimationSourceIds?: string[]
        inputMode?: string
        letterScales?: { label: string; score: number; order: number }[]
      }[]
      boundaries?: {
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
  // 旧 manual 形式（manualScores/inputMode/letterScales をトップレベルに持つ）を、
  // 新スキーマの coursework 形式（courseworkItem に内包）へ変換する。
  // これによりテストケース本体は旧シグネチャのまま、calculator の新ロジックを検証できる。
  const gradeItems = (overrides.gradeItems ?? []).map((gradeItem) => ({
    ...gradeItem,
    boundaries: gradeItem.boundaries ?? [],
    dataSources: gradeItem.dataSources.map((rawDataSource) => {
      // 推定に使う他データソースは中間テーブル（gradeDataSourceInclude 同梱）。
      // テストケースは id 配列で書けるようにし、ここで行の形へ寄せる。
      const dataSource = {
        ...rawDataSource,
        estimationSources: (rawDataSource.estimationSourceIds ?? []).map(
          (sourceDataSourceId, index) => ({
            id: `${rawDataSource.id}:${sourceDataSourceId}`,
            dataSourceId: rawDataSource.id,
            sourceDataSourceId,
            order: index,
          })
        ),
      }
      const isCoursework =
        dataSource.type === "manual" ||
        dataSource.type === "coursework" ||
        dataSource.manualScores !== undefined ||
        dataSource.inputMode !== undefined ||
        dataSource.letterScales !== undefined
      if (!isCoursework) {
        return { ...dataSource, courseworkItem: null }
      }
      const courseworkItemId = `${dataSource.id}-item`
      return {
        ...dataSource,
        type: "coursework",
        courseworkItemId,
        courseworkItem: {
          maxScore: dataSource.maxScore,
          inputMode: dataSource.inputMode ?? "numeric",
          // 点数は資料の対象者（CourseworkStudent）にぶら下がる。テストケースは
          // 生徒idで書けるようにし、ここで対象者を1段かませた形へ寄せる。
          scores: (dataSource.manualScores ?? []).map((manualScore) => ({
            ...manualScore,
            courseworkStudent: { studentId: manualScore.studentId },
          })),
          letterScales: dataSource.letterScales ?? [],
        },
      }
    }),
  }))

  return {
    id: overrides.id ?? "gp1",
    name: overrides.name ?? "テストPJ",
    gradeItems,
    gradeClassrooms: overrides.gradeClassrooms ?? [],
  }
}

/**
 * 成績の対象者1行。上書き・確定値・除外設定は対象者の子として同じ行に載る
 * （calculator は Grade 単位で別途引かず、この include から読む）。
 */
function buildStudent(
  overrides: {
    id?: string
    studentNumber?: string
    lastName?: string
    firstName?: string
    /** 除外する評価項目 */
    excludedGradeItemIds?: string[]
    /** 手動上書き（gradeItemId → ラベル） */
    overrideLabels?: Record<string, string>
    /** 確定済みセル */
    frozenScores?: {
      gradeItemId: string
      weightedScore: unknown
      weightedMaxScore: unknown
      percentage: unknown
      gradeLabel: string | null
      frozenAt: Date
    }[]
  } = {}
) {
  const studentId = overrides.id ?? "s1"
  // テストでは対象者 id を「gs:生徒id」とし、人の id と取り違えたら露見するようにする
  const gradeStudentId = `gs:${studentId}`
  return {
    id: gradeStudentId,
    gradeId: "gp1",
    studentId,
    student: {
      id: studentId,
      studentNumber: overrides.studentNumber ?? "S001",
      lastName: overrides.lastName ?? "テスト",
      firstName: overrides.firstName ?? "太郎",
      memberships: [],
    },
    customOrder: 0,
    itemExclusions: (overrides.excludedGradeItemIds ?? []).map(
      (gradeItemId) => ({ gradeStudentId, gradeItemId })
    ),
    overrides: Object.entries(overrides.overrideLabels ?? {}).map(
      ([gradeItemId, overrideLabel]) => ({
        gradeStudentId,
        gradeItemId,
        overrideLabel,
      })
    ),
    frozenScores: (overrides.frozenScores ?? []).map((frozenScore) => ({
      gradeStudentId,
      ...frozenScore,
    })),
  }
}

describe("calculateGrades", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 試験データを使わないケースの既定値（小計テストだけが上書きする）
    mockExamPageFindMany.mockResolvedValue([])
    mockExamStudentFindMany.mockResolvedValue([])
    mockCropSubtotalFindMany.mockResolvedValue([])
  })

  it("試験が見つからない場合はエラー", async () => {
    mockFindUnique.mockResolvedValue(null)

    await expect(calculateGrades("non-existent")).rejects.toThrow(
      "Grade exam not found"
    )
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
    expect(result.students).toHaveLength(0)
    expect(result.gradeItems).toHaveLength(1)
    expect(result.gradeItems[0].name).toBe("知識")
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
    const student = result.students[0]

    // manualスコア: 85/100 → 85%
    expect(student.gradeItemResults).toHaveLength(1)
    const gradeItemResult = student.gradeItemResults[0]
    expect(gradeItemResult.gradeItemId).toBe("gi1")
    expect(gradeItemResult.sourceScores[0].rawScore).toBe(85)
    expect(gradeItemResult.sourceScores[0].weightedScore).toBe(85)
    expect(gradeItemResult.percentage).toBeCloseTo(85, 1)
    expect(gradeItemResult.gradeLabel).toBe("A")
    expect(gradeItemResult.isAllMissing).toBe(false)
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
    const student = result.students[0]

    // gi1: 80/100 * 50 = 40 (50max → 80%)
    expect(student.gradeItemResults[0].weightedScore).toBeCloseTo(40)
    expect(student.gradeItemResults[0].percentage).toBeCloseTo(80)

    // gi2: 40/50 * 50 = 40 (50max → 80%)
    expect(student.gradeItemResults[1].weightedScore).toBeCloseTo(40)
    expect(student.gradeItemResults[1].percentage).toBeCloseTo(80)
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
    const student = result.students[0]

    expect(student.gradeItemResults[0].sourceScores[0].rawScore).toBeNull()
    expect(student.gradeItemResults[0].weightedScore).toBe(0)
    expect(student.gradeItemResults[0].weightedMaxScore).toBe(100)
    expect(student.gradeItemResults[0].percentage).toBe(0)
    expect(student.gradeItemResults[0].isAllMissing).toBe(true)
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
    const student = result.students[0]

    // 65% → B (60以上80未満)
    expect(student.gradeItemResults[0].gradeLabel).toBe("B")
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
    const student = result.students[0]

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
    const sourceScore = result.students[0].gradeItemResults[0].sourceScores[0]
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
    const sourceScore = result.students[0].gradeItemResults[0].sourceScores[0]
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
    // s1をgi2から除外
    mockFindMany.mockResolvedValue([
      buildStudent({ id: "s1", excludedGradeItemIds: ["gi2"] }),
    ])

    const result = await calculateGrades("gp1")
    const student = result.students[0]

    // gi1は通常計算
    expect(student.gradeItemResults[0].isExcluded).toBe(false)
    expect(student.gradeItemResults[0].weightedScore).toBeCloseTo(85)

    // gi2は除外
    expect(student.gradeItemResults[1].isExcluded).toBe(true)
    expect(student.gradeItemResults[1].weightedScore).toBeNull()
    expect(student.gradeItemResults[1].percentage).toBeNull()
    expect(student.gradeItemResults[1].sourceScores).toHaveLength(0)

    // 除外されていない gi1 は通常どおり算出される（100点満点で85%）
    expect(student.gradeItemResults[0].weightedMaxScore).toBe(100)
    expect(student.gradeItemResults[0].weightedScore).toBeCloseTo(85)
    expect(student.gradeItemResults[0].percentage).toBeCloseTo(85)
  })

  it("全GradeItem除外時は各項目のスコアがnullになる", async () => {
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
    // 全項目除外
    mockFindMany.mockResolvedValue([
      buildStudent({ id: "s1", excludedGradeItemIds: ["gi1"] }),
    ])

    const result = await calculateGrades("gp1")
    const student = result.students[0]

    expect(student.gradeItemResults[0].isExcluded).toBe(true)
    expect(student.gradeItemResults[0].weightedMaxScore).toBe(0)
    expect(student.gradeItemResults[0].weightedScore).toBeNull()
    expect(student.gradeItemResults[0].percentage).toBeNull()
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

    const result = await calculateGrades("gp1")
    const student = result.students[0]

    expect(student.gradeItemResults[0].isExcluded).toBe(false)
    expect(student.gradeItemResults[0].weightedScore).toBeCloseTo(80)
    expect(student.gradeItemResults[0].percentage).toBeCloseTo(80)
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
    const sourceScore = result.students[0].gradeItemResults[0].sourceScores[0]

    // B → 80点
    expect(sourceScore.rawScore).toBe(80)
    expect(sourceScore.letterValue).toBe("B")
    expect(result.students[0].gradeItemResults[0].percentage).toBeCloseTo(80)
    // 80% → 評価B
    expect(result.students[0].gradeItemResults[0].gradeLabel).toBe("B")
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
    const sourceScore = result.students[0].gradeItemResults[0].sourceScores[0]
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
    const sourceScore = result.students[0].gradeItemResults[0].sourceScores[0]

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
    const sourceScore = result.students[0].gradeItemResults[0].sourceScores[0]

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
    const sourceScore = result.students[0].gradeItemResults[0].sourceScores[0]

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
    const sourceScore = result.students[0].gradeItemResults[0].sourceScores[0]
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
    const sourceScore = result.students[0].gradeItemResults[0].sourceScores[0]
    expect(sourceScore.rawScore).toBe(75)
    expect(sourceScore.isEstimated).toBe(false)
  })

  it("coursework_total: 資料の全評価項目のスコア・満点を合算する", async () => {
    // 資料 cw1 は2項目（満点 50 + 30 = 80）。生徒 s1 は 40 + 30 = 70 点。
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
                    scores: [
                      {
                        courseworkStudent: { studentId: "s1" },
                        score: 40,
                      },
                    ],
                    letterScales: [],
                  },
                  {
                    maxScore: 30,
                    inputMode: "numeric",
                    scores: [
                      {
                        courseworkStudent: { studentId: "s1" },
                        score: 30,
                      },
                    ],
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
              // このケースは buildGrade を通さないので中間テーブルの形で持つ
              estimationSources: [],
            },
          ],
          boundaries: [],
        },
      ],
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
      result.students[0].gradeItemResults[0].sourceScores[0]
    expect(student1SourceScore.rawScore).toBe(70)
    expect(student1SourceScore.maxScore).toBe(80)
    expect(student1SourceScore.weightedScore).toBe(87.5)

    // s2: 全項目未入力 → rawScore は null（absentMethod="null" のため推定なし）
    const student2Item = result.students[1].gradeItemResults[0]
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

  /**
   * `studentId → dataSourceId → 素点` の表から素点行列を組むテスト用ヘルパー。
   * 推定は行を識別して素点を引くだけなので、行の実体は id のみで足りる。
   */
  const buildMatrix = (
    rawScores: Map<string, Map<string, number | null>>,
    allDataSources: DataSourceInfo[]
  ) =>
    new RawScoreMatrix<RawScoreRowEntity>(
      Array.from(rawScores, ([studentId, scoresBySource]) => ({
        gradeStudent: { id: studentId },
        cells: allDataSources.map((dataSource) => ({
          dataSource,
          rawScore: scoresBySource.get(dataSource.id) ?? null,
        })),
      }))
    )

  /** 素点行列から対象者の行を取り出す（テスト用の同定は studentId で足りる） */
  const rowOf = (
    matrix: RawScoreMatrix<RawScoreRowEntity>,
    studentId: string
  ) => {
    const row = matrix.rows.find(
      (candidate) => candidate.gradeStudent.id === studentId
    )
    if (!row) throw new Error(`row ${studentId} not found`)
    return row
  }

  it("method='zero' → 0を返す", () => {
    const rawScoreMap = new Map<string, Map<string, number | null>>()
    rawScoreMap.set("s1", new Map([["ds1", null]]))
    const allDataSources: DataSourceInfo[] = [
      {
        id: "ds1",
        name: "ds1",
        maxScore: 100,
        absentMethod: "zero",
        absentRatio: 1,
        absentOffset: 0,
        ...dataSourceDefaults,
      },
    ]
    const matrix = buildMatrix(rawScoreMap, allDataSources)
    const result = estimateAbsentScore(
      "zero",
      rowOf(matrix, "s1"),
      allDataSources[0],
      matrix,
      allDataSources
    )
    expect(result?.value).toBe(0)
    expect(result?.effectiveMethod).toBe("zero")
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
    const allDataSources: DataSourceInfo[] = [
      {
        id: "ds1",
        name: "ds1",
        maxScore: 200,
        absentMethod: "average" as const,
        absentRatio: 1,
        absentOffset: 0,
        ...dataSourceDefaults,
      },
      {
        id: "ds2",
        name: "ds2",
        maxScore: 100,
        absentMethod: "null" as const,
        absentRatio: 1,
        absentOffset: 0,
        ...dataSourceDefaults,
      },
      {
        id: "ds3",
        name: "ds3",
        maxScore: 50,
        absentMethod: "null" as const,
        absentRatio: 1,
        absentOffset: 0,
        ...dataSourceDefaults,
      },
    ]
    const matrix = buildMatrix(rawScoreMap, allDataSources)
    const result = estimateAbsentScore(
      "average",
      rowOf(matrix, "s1"),
      allDataSources[0],
      matrix,
      allDataSources
    )
    expect(result?.value).toBeCloseTo(140)
    expect(result?.effectiveMethod).toBe("average")
    expect(result?.averageRatio).toBeCloseTo(0.7)
    expect(result?.averageSources).toHaveLength(2)
  })

  it("method='average' → 他DataSourceがない場合はnull", () => {
    const rawScoreMap = new Map<string, Map<string, number | null>>()
    rawScoreMap.set("s1", new Map([["ds1", null]]))
    const allDataSources: DataSourceInfo[] = [
      {
        id: "ds1",
        name: "ds1",
        maxScore: 100,
        absentMethod: "average" as const,
        absentRatio: 1,
        absentOffset: 0,
        ...dataSourceDefaults,
      },
    ]
    const matrix = buildMatrix(rawScoreMap, allDataSources)
    const result = estimateAbsentScore(
      "average",
      rowOf(matrix, "s1"),
      allDataSources[0],
      matrix,
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

    const allDataSources: DataSourceInfo[] = [
      {
        id: "ds1",
        name: "ds1",
        maxScore: 100,
        absentMethod: "regression" as const,
        absentRatio: 1,
        absentOffset: 0,
        ...dataSourceDefaults,
      },
      {
        id: "ds2",
        name: "ds2",
        maxScore: 100,
        absentMethod: "null" as const,
        absentRatio: 1,
        absentOffset: 0,
        ...dataSourceDefaults,
      },
    ]
    const matrix = buildMatrix(rawScoreMap, allDataSources)
    const result = estimateAbsentScore(
      "regression",
      rowOf(matrix, "s1"),
      allDataSources[0],
      matrix,
      allDataSources
    )
    // 結果はOLS回帰の予測値で、0-100の範囲内であること
    expect(result).not.toBeNull()
    expect(result!.value).toBeGreaterThanOrEqual(0)
    expect(result!.value).toBeLessThanOrEqual(100)
    expect(result!.effectiveMethod).toBe("regression")
    expect(result!.intercept).not.toBeUndefined()
    // 説明変数は ds2 の1つ
    expect(result!.regressionTerms).toHaveLength(1)
    expect(result!.regressionTerms![0].name).toBe("ds2")
    expect(result!.regressionTerms![0].value).toBe(60)
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

    const allDataSources: DataSourceInfo[] = [
      {
        id: "ds1",
        name: "ds1",
        maxScore: 100,
        absentMethod: "regression" as const,
        absentRatio: 1,
        absentOffset: 0,
        ...dataSourceDefaults,
      },
      {
        id: "ds2",
        name: "ds2",
        maxScore: 100,
        absentMethod: "null" as const,
        absentRatio: 1,
        absentOffset: 0,
        ...dataSourceDefaults,
      },
    ]
    const matrix = buildMatrix(rawScoreMap, allDataSources)
    const result = estimateAbsentScore(
      "regression",
      rowOf(matrix, "s1"),
      allDataSources[0],
      matrix,
      allDataSources
    )
    // averageフォールバック: s1のds2比率=60/100=0.6 → 0.6*100=60
    expect(result?.value).toBeCloseTo(60)
    expect(result?.effectiveMethod).toBe("average")
    expect(result?.fallbackReason).toBe("insufficient_samples")
  })

  it("method='regression' → 説明変数なしはnull", () => {
    const rawScoreMap = new Map<string, Map<string, number | null>>()
    rawScoreMap.set("s1", new Map([["ds1", null]]))
    rawScoreMap.set("s2", new Map([["ds1", 80]]))

    const allDataSources: DataSourceInfo[] = [
      {
        id: "ds1",
        name: "ds1",
        maxScore: 100,
        absentMethod: "regression" as const,
        absentRatio: 1,
        absentOffset: 0,
        ...dataSourceDefaults,
      },
    ]
    const matrix = buildMatrix(rawScoreMap, allDataSources)
    const result = estimateAbsentScore(
      "regression",
      rowOf(matrix, "s1"),
      allDataSources[0],
      matrix,
      allDataSources
    )
    expect(result).toBeNull()
  })

  it("method='regression' → 多重共線性の従属列はランク落ち除外して回帰継続", () => {
    // ds4 = ds2 + ds3（合計＝小計の和）で完全従属 → ds4 を除外し ds2,ds3 で回帰する。
    // 目的変数 ds1 は s1 が欠測、s2-s6 が訓練データ。
    // predictor は ds2,ds3,ds4 の3つ → minSamples=5、訓練 s2-s6 の5人でちょうど満たす。
    const rawScoreMap = new Map<string, Map<string, number | null>>()
    const rows: Record<string, [number | null, number, number]> = {
      // studentId: [ds1(目的), ds2, ds3]（ds4 = ds2 + ds3）
      s1: [null, 60, 20],
      s2: [70, 40, 30],
      s3: [90, 80, 10],
      s4: [60, 30, 40],
      s5: [85, 50, 50],
      s6: [75, 20, 60],
    }
    for (const [studentId, [ds1, ds2, ds3]] of Object.entries(rows)) {
      rawScoreMap.set(
        studentId,
        new Map<string, number | null>([
          ["ds1", ds1],
          ["ds2", ds2],
          ["ds3", ds3],
          ["ds4", ds2 + ds3],
        ])
      )
    }

    const predictorNames = ["ds2", "ds3", "ds4"]
    const allDataSources: DataSourceInfo[] = [
      {
        id: "ds1",
        name: "ds1",
        maxScore: 100,
        absentMethod: "regression" as const,
        absentRatio: 1,
        absentOffset: 0,
        ...dataSourceDefaults,
      },
      ...predictorNames.map((predictorName) => ({
        id: predictorName,
        name: predictorName,
        maxScore: 100,
        absentMethod: "null" as const,
        absentRatio: 1,
        absentOffset: 0,
        ...dataSourceDefaults,
      })),
    ]

    const matrix = buildMatrix(rawScoreMap, allDataSources)
    const result = estimateAbsentScore(
      "regression",
      rowOf(matrix, "s1"),
      allDataSources[0],
      matrix,
      allDataSources
    )

    // フォールバックせず回帰のまま
    expect(result).not.toBeNull()
    expect(result!.effectiveMethod).toBe("regression")
    expect(result!.fallbackReason).toBeUndefined()
    // 従属列 ds4 が除外され、独立列 ds2,ds3 だけで項が構成される
    expect(result!.droppedPredictors).toHaveLength(1)
    expect(result!.droppedPredictors![0].name).toBe("ds4")
    expect(result!.regressionTerms!.map((term) => term.name)).toEqual([
      "ds2",
      "ds3",
    ])
    expect(result!.value).toBeGreaterThanOrEqual(0)
    expect(result!.value).toBeLessThanOrEqual(100)
  })

  it("method='regression' → サンプル妥当性は生の説明変数数でなく独立列数で判定する", () => {
    // ds4 = ds2 + ds3 の従属を含む3説明変数だが、独立は ds2,ds3 の2つ。
    // 独立パラメータ数(切片+2=3) 基準では minSamples=4 で訓練4人（s2-s5）で成立する。
    // 生の説明変数数(3)基準の旧判定 minSamples=5 なら average に落ちていた境界ケース。
    const rawScoreMap = new Map<string, Map<string, number | null>>()
    const rows: Record<string, [number | null, number, number]> = {
      s1: [null, 50, 30],
      s2: [65, 40, 20],
      s3: [88, 70, 30],
      s4: [70, 30, 50],
      s5: [72, 60, 10],
    }
    for (const [studentId, [ds1, ds2, ds3]] of Object.entries(rows)) {
      rawScoreMap.set(
        studentId,
        new Map<string, number | null>([
          ["ds1", ds1],
          ["ds2", ds2],
          ["ds3", ds3],
          ["ds4", ds2 + ds3],
        ])
      )
    }

    const predictorNames = ["ds2", "ds3", "ds4"]
    const allDataSources: DataSourceInfo[] = [
      {
        id: "ds1",
        name: "ds1",
        maxScore: 100,
        absentMethod: "regression" as const,
        absentRatio: 1,
        absentOffset: 0,
        ...dataSourceDefaults,
      },
      ...predictorNames.map((predictorName) => ({
        id: predictorName,
        name: predictorName,
        maxScore: 100,
        absentMethod: "null" as const,
        absentRatio: 1,
        absentOffset: 0,
        ...dataSourceDefaults,
      })),
    ]

    const matrix = buildMatrix(rawScoreMap, allDataSources)
    const result = estimateAbsentScore(
      "regression",
      rowOf(matrix, "s1"),
      allDataSources[0],
      matrix,
      allDataSources
    )

    // 4サンプルでも average に落ちず回帰が成立すること
    expect(result!.effectiveMethod).toBe("regression")
    expect(result!.fallbackReason).toBeUndefined()
    expect(result!.droppedPredictors!.map((dropped) => dropped.name)).toEqual([
      "ds4",
    ])
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

// ================== subtotal 型データソース ==================

/**
 * 小計型データソースの経路。
 *
 * 設問割り当て（CropSubtotal）は素点収集の前に1回だけ引き、生徒×ソースのループでは
 * 引かない。ここが壊れると全生徒の小計列が無言で null になるので、prefetch した
 * マップのキーと参照が噛み合っていることを固定する。
 */
describe("calculateGrades - subtotal 型データソース", () => {
  const EXAM_ID = "exam1"
  const SUBTOTAL_ID = "sub1"

  /** 試験1つ・設問2問（各10点）・受験者1人。q1 正答 / q2 誤答 */
  function mockExamData() {
    mockExamPageFindMany.mockResolvedValue([
      {
        id: "page1",
        examId: EXAM_ID,
        cropRegions: [
          { id: "q1", type: "QUESTION_ANSWER", points: 10 },
          { id: "q2", type: "QUESTION_ANSWER", points: 10 },
        ],
      },
    ])
    mockExamStudentFindMany.mockResolvedValue([
      {
        id: "es1",
        studentId: "s1",
        status: "participating",
        questionScores: [
          {
            id: "qs1",
            examStudentId: "es1",
            cropRegionId: "q1",
            status: "correct",
            partialScore: null,
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          },
          {
            id: "qs2",
            examStudentId: "es1",
            cropRegionId: "q2",
            status: "incorrect",
            partialScore: null,
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        ],
        scoreDecisions: [],
      },
    ])
    mockCalculateActualScore.mockImplementation(
      (questionScore: { status: string }, maxScore: number) =>
        questionScore.status === "correct" ? maxScore : 0
    )
  }

  /**
   * 小計の設問割り当て1件。取得側の include で cropRegion（＋所属試験）まで
   * 同梱されるので、満点も素点もこの行から読める。
   */
  function questionAssignment(cropRegionId: string, examId: string) {
    return {
      cropRegion: {
        id: cropRegionId,
        type: "QUESTION_ANSWER",
        points: 10,
        examPage: { examId },
      },
    }
  }

  function buildSubtotalGrade(
    cropSubtotals: ReturnType<typeof questionAssignment>[]
  ) {
    return buildGrade({
      gradeItems: [
        {
          id: "gi1",
          name: "定期考査",
          order: 0,
          dataSources: [
            {
              id: "ds1",
              type: "subtotal",
              name: "小計A",
              maxScore: 20,
              weight: 100,
              examId: EXAM_ID,
              subtotalId: SUBTOTAL_ID,
              cropRegionId: null,
              exam: { id: EXAM_ID },
              subtotal: { id: SUBTOTAL_ID, cropSubtotals },
              cropRegion: null,
              order: 0,
            },
          ],
          boundaries: [],
        },
      ],
    })
  }

  beforeEach(() => {
    // この describe は外側の calculateGrades ブロックとは別なので、呼び出し回数の
    // 検証が前のケースを引きずらないよう自前でクリアする
    vi.clearAllMocks()
    mockExamData()
  })

  it("同梱された割り当てから小計点と満点を算出する", async () => {
    // 小計 sub1 に q1・q2 が割り当てられている
    mockFindUnique.mockResolvedValue(
      buildSubtotalGrade([
        questionAssignment("q1", EXAM_ID),
        questionAssignment("q2", EXAM_ID),
      ])
    )
    mockFindMany.mockResolvedValue([buildStudent({ id: "s1" })])

    const result = await calculateGrades("gp1")
    const sourceScore = result.students[0].gradeItemResults[0].sourceScores[0]
    // q1 正答10点 + q2 誤答0点 = 10点
    expect(sourceScore.rawScore).toBe(10)
    // 満点も同じ割り当て行から出る（q1・q2 の配点合計 = 20）
    expect(sourceScore.maxScore).toBe(20)
  })

  it("割り当てのために別クエリを立てない（生徒数に比例させない）", async () => {
    mockFindUnique.mockResolvedValue(
      buildSubtotalGrade([questionAssignment("q1", EXAM_ID)])
    )
    mockFindMany.mockResolvedValue([
      buildStudent({ id: "s1" }),
      buildStudent({ id: "s2" }),
      buildStudent({ id: "s3" }),
    ])

    await calculateGrades("gp1")

    expect(mockCropSubtotalFindMany).not.toHaveBeenCalled()
  })

  it("当該試験に割り当てが無ければ素点は null", async () => {
    // 他試験の設問だけが割り当てられている（SubtotalGroup は試験横断で共有される）
    mockFindUnique.mockResolvedValue(
      buildSubtotalGrade([questionAssignment("other-exam-q1", "other-exam")])
    )
    mockFindMany.mockResolvedValue([buildStudent({ id: "s1" })])

    const result = await calculateGrades("gp1")
    expect(
      result.students[0].gradeItemResults[0].sourceScores[0].rawScore
    ).toBeNull()
  })
})
