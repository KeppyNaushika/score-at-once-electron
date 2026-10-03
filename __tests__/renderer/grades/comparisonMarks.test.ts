/**
 * 比較の記号の組み立て（buildComparisonMarks）のテスト
 *
 * ここで守りたいのは次の3つ。
 * - 比較先の生徒は人（studentId）で突き合わせる（対象者の id は成績算出ごとに別物）
 * - 上下の物差しは自分側の項目の成績境界。境界に無い評定は * （unknown）
 * - どちらかに評定が無ければ ·（missing）で、位置を詰めない
 */
import { describe, expect, it } from "vitest"

import { buildComparisonMarks } from "@/components/grades/05-results/buildComparisonMarks"
import type { GradeComparisonRow } from "@/queries/gradeStructure"
import type {
  GradeCalculationResult,
  GradeItemResult,
  StudentGradeResult,
} from "@/types/grade.types"

const AT = new Date("2026-09-01T00:00:00.000Z")

const BOUNDARIES = [
  { label: "A", minPercentage: 80, order: 0 },
  { label: "B", minPercentage: 60, order: 1 },
  { label: "C", minPercentage: 0, order: 2 },
]

function itemResult(
  gradeItemId: string,
  gradeLabel: string | null,
  isExcluded = false
): GradeItemResult {
  return {
    gradeItemId,
    gradeItemName: gradeItemId,
    isExcluded,
    isAllMissing: false,
    sourceScores: [],
    weightedScore: 70,
    weightedMaxScore: 100,
    percentage: 70,
    gradeLabel,
    originalGradeLabel: gradeLabel,
    overrideGradeLabel: null,
    frozen: null,
  }
}

function student(
  gradeStudentId: string,
  studentId: string,
  gradeItemResults: GradeItemResult[]
): StudentGradeResult {
  return {
    gradeStudentId,
    studentId,
    studentNumber: studentId,
    lastName: "山田",
    firstName: "太郎",
    attendanceNumber: 1,
    className: "3-A",
    gradeItemResults,
  }
}

function calculationResult(
  gradeId: string,
  gradeItemIds: string[],
  students: StudentGradeResult[]
): GradeCalculationResult {
  return {
    gradeId,
    gradeName: gradeId,
    classNames: [],
    gradeItems: gradeItemIds.map((gradeItemId, index) => ({
      id: gradeItemId,
      name: gradeItemId,
      order: index,
      dataSources: [],
      boundaries: BOUNDARIES,
    })),
    students,
  }
}

function comparison(
  id: string,
  gradeItemId: string,
  comparedGradeId: string,
  comparedGradeItemId: string
): GradeComparisonRow {
  return {
    id,
    gradeItemId,
    comparedGradeItemId,
    order: 0,
    createdAt: AT,
    updatedAt: AT,
    comparedGradeItem: {
      id: comparedGradeItemId,
      gradeId: comparedGradeId,
      name: comparedGradeItemId,
      order: 0,
      createdAt: AT,
      updatedAt: AT,
      grade: {
        id: comparedGradeId,
        name: `${comparedGradeId}の成績`,
        description: null,
        referenceDate: null,
        createdAt: AT,
        updatedAt: AT,
      },
      boundaries: [],
    },
  }
}

describe("buildComparisonMarks", () => {
  // 今回（term2）は A、前回（term1）は B。対象者の id は成績算出ごとに違う
  const current = calculationResult(
    "term2",
    ["rating"],
    [student("gs-term2", "student-1", [itemResult("rating", "A")])]
  )
  const previous = calculationResult(
    "term1",
    ["term1-rating"],
    [student("gs-term1", "student-1", [itemResult("term1-rating", "B")])]
  )

  it("比較先の生徒を studentId で突き合わせ、上がったら up", () => {
    const marks = buildComparisonMarks(
      current,
      [comparison("c-1", "rating", "term1", "term1-rating")],
      new Map([
        ["term2", current],
        ["term1", previous],
      ])
    )

    const [mark] = marks.get("gs-term2")!.get("rating")!
    expect(mark.direction).toBe("up")
    expect(mark.comparedGradeName).toBe("term1の成績")
    expect(mark.comparedGradeLabel).toBe("B")
    expect(mark.comparedPercentage).toBe(70)
  })

  it("境界に無い評定は unknown（*）", () => {
    const withUnknownLabel = calculationResult(
      "term1",
      ["term1-rating"],
      [student("gs-term1", "student-1", [itemResult("term1-rating", "5")])]
    )

    const marks = buildComparisonMarks(
      current,
      [comparison("c-1", "rating", "term1", "term1-rating")],
      new Map([
        ["term2", current],
        ["term1", withUnknownLabel],
      ])
    )

    expect(marks.get("gs-term2")!.get("rating")![0].direction).toBe("unknown")
  })

  it("比較先が未読込・生徒が居ない・除外なら missing で、位置は詰めない", () => {
    const excluded = calculationResult(
      "term0",
      ["term0-rating"],
      [
        student("gs-term0", "student-1", [
          itemResult("term0-rating", "C", true),
        ]),
      ]
    )

    const marks = buildComparisonMarks(
      current,
      [
        comparison("c-loading", "rating", "term1", "term1-rating"),
        comparison("c-excluded", "rating", "term0", "term0-rating"),
      ],
      // term1 はまだ読み込めていない
      new Map([
        ["term2", current],
        ["term0", excluded],
      ])
    )

    expect(
      marks
        .get("gs-term2")!
        .get("rating")!
        .map((mark) => mark.direction)
    ).toEqual(["missing", "missing"])
  })

  it("同じ成績算出の別項目とも比べられ、成績算出名は出さない", () => {
    const twoItems = calculationResult(
      "term2",
      ["knowledge", "rating"],
      [
        student("gs-term2", "student-1", [
          itemResult("knowledge", "C"),
          itemResult("rating", "C"),
        ]),
      ]
    )

    const marks = buildComparisonMarks(
      twoItems,
      [comparison("c-1", "knowledge", "term2", "rating")],
      new Map([["term2", twoItems]])
    )

    const [mark] = marks.get("gs-term2")!.get("knowledge")!
    expect(mark.direction).toBe("same")
    expect(mark.comparedGradeName).toBeNull()
    // 比較の無い項目にはマスごと記号を置かない
    expect(marks.get("gs-term2")!.has("rating")).toBe(false)
  })
})
