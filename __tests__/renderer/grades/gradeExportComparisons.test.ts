/**
 * 成績算出の出力に載せる比較（renderer 側）のテスト
 *
 * - Excel へ渡す比較の列（buildExcelComparisonColumns）: 比較先の表示名、比較先の評定と
 *   記号、比較先の結果が取れない生徒の「・」、渡した（＝選んだ）比較だけが列になること
 * - 個人成績通知書（generateGradeReportBatchHtml）: 「評価」の評定に続く記号（例「1↑」）の
 *   オン・オフと、複数の比較を登録順に連ねること
 */
import { describe, expect, it } from "vitest"

import { buildExcelComparisonColumns } from "@/components/grades/06-export/buildExcelComparisonColumns"
import { generateGradeReportBatchHtml } from "@/components/grades/06-export/generateGradeReportHtml"
import { buildComparisonMarks } from "@/components/grades/comparison-marks/buildComparisonMarks"
import type { GradeComparisonRow } from "@/queries/gradeStructure"
import type {
  GradeCalculationResult,
  GradeItemResult,
  StudentGradeResult,
} from "@/types/grade.types"
import { DEFAULT_GRADE_REPORT_SETTINGS } from "@/types/gradeReport.types"

const AT = new Date("2026-09-01T00:00:00.000Z")

/** 5段階の評定。数字が大きいほど上 */
const BOUNDARIES = [
  { label: "5", minPercentage: 90, order: 0 },
  { label: "4", minPercentage: 75, order: 1 },
  { label: "3", minPercentage: 50, order: 2 },
  { label: "2", minPercentage: 30, order: 3 },
  { label: "1", minPercentage: 0, order: 4 },
]

function itemResult(
  gradeItemId: string,
  gradeLabel: string | null
): GradeItemResult {
  return {
    gradeItemId,
    gradeItemName: `${gradeItemId}の名前`,
    isExcluded: false,
    isAllMissing: false,
    sourceScores: [],
    weightedScore: 40,
    weightedMaxScore: 100,
    percentage: 40,
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
    firstName: studentId,
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
    gradeName: `${gradeId}の成績`,
    classNames: [],
    gradeItems: gradeItemIds.map((gradeItemId, index) => ({
      id: gradeItemId,
      name: `${gradeItemId}の名前`,
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
  comparedGradeItemId: string,
  order: number
): GradeComparisonRow {
  return {
    id,
    gradeItemId,
    comparedGradeItemId,
    order,
    createdAt: AT,
    updatedAt: AT,
    comparedGradeItem: {
      id: comparedGradeItemId,
      gradeId: comparedGradeId,
      name: `${comparedGradeItemId}の名前`,
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

// 今回（term2）の「評定」: 生徒1は 1、生徒2は 3。生徒2は前回（term1）に居ない
const current = calculationResult(
  "term2",
  ["rating", "effort"],
  [
    student("gs-term2-1", "student-1", [
      itemResult("rating", "1"),
      itemResult("effort", "1"),
    ]),
    student("gs-term2-2", "student-2", [
      itemResult("rating", "3"),
      itemResult("effort", null),
    ]),
  ]
)
const previous = calculationResult(
  "term1",
  ["term1-rating"],
  [student("gs-term1-1", "student-1", [itemResult("term1-rating", "2")])]
)

// 「評定」に比較2つ: 前回の評定（下がった）と、今回の「努力」（同じ）
const withPrevious = comparison(
  "cmp-previous",
  "rating",
  "term1",
  "term1-rating",
  0
)
const withinGrade = comparison("cmp-within", "rating", "term2", "effort", 1)

const resultsByGradeId = new Map([
  ["term2", current],
  ["term1", previous],
])

describe("buildExcelComparisonColumns", () => {
  it("比較ごとに、比較先の表示名と生徒ごとの評定・記号を作る", () => {
    const comparisons = [withPrevious, withinGrade]
    const columns = buildExcelComparisonColumns(
      current,
      comparisons,
      buildComparisonMarks(current, comparisons, resultsByGradeId)
    )

    expect(columns).toEqual([
      {
        comparisonId: "cmp-previous",
        gradeItemId: "rating",
        // 別の成績算出は「成績算出名 > 項目名」
        comparedTargetName: "term1の成績 > term1-ratingの名前",
        cells: [
          {
            gradeStudentId: "gs-term2-1",
            comparedGradeLabel: "2",
            symbol: "↓",
          },
          // 比較先に居ない生徒は「・」（missing）
          {
            gradeStudentId: "gs-term2-2",
            comparedGradeLabel: null,
            symbol: "・",
          },
        ],
      },
      {
        comparisonId: "cmp-within",
        gradeItemId: "rating",
        // 同じ成績算出は項目名だけ
        comparedTargetName: "effortの名前",
        cells: [
          {
            gradeStudentId: "gs-term2-1",
            comparedGradeLabel: "1",
            symbol: "→",
          },
          {
            gradeStudentId: "gs-term2-2",
            comparedGradeLabel: null,
            symbol: "・",
          },
        ],
      },
    ])
  })

  it("渡した（選んだ）比較だけが列になる", () => {
    const comparisons = [withinGrade]
    const columns = buildExcelComparisonColumns(
      current,
      comparisons,
      buildComparisonMarks(current, comparisons, resultsByGradeId)
    )

    expect(columns.map((column) => column.comparisonId)).toEqual(["cmp-within"])
  })

  it("比較先の結果をまだ読めていなければ、全員「・」", () => {
    const comparisons = [withPrevious]
    const columns = buildExcelComparisonColumns(
      current,
      comparisons,
      buildComparisonMarks(current, comparisons, new Map([["term2", current]]))
    )

    expect(columns[0].cells.map((cell) => cell.symbol)).toEqual(["・", "・"])
  })
})

describe("generateGradeReportBatchHtml: 評価に比較の記号", () => {
  const comparisons = [withPrevious, withinGrade]
  const comparisonMarks = buildComparisonMarks(
    current,
    comparisons,
    resultsByGradeId
  )

  /** 生徒1の「評定」の行の「評価」の欄 */
  function ratingLabelOf(html: string): string | undefined {
    return html.match(
      /ratingの名前<\/td>(?:<td>[^<]*<\/td>)*<td><strong>([^<]*)<\/strong><\/td>/
    )?.[1]
  }

  it("既定（オフ）では今までどおり評定だけ", () => {
    expect(DEFAULT_GRADE_REPORT_SETTINGS.itemGradeComparisonMarks).toBe(false)
    const html = generateGradeReportBatchHtml(
      current,
      ["student-1"],
      DEFAULT_GRADE_REPORT_SETTINGS,
      comparisonMarks
    )

    expect(ratingLabelOf(html)).toBe("1")
  })

  it("オンにすると評定に続けて記号を登録順に連ねる（例「1↓→」）", () => {
    const html = generateGradeReportBatchHtml(
      current,
      ["student-1"],
      { ...DEFAULT_GRADE_REPORT_SETTINGS, itemGradeComparisonMarks: true },
      comparisonMarks
    )

    expect(ratingLabelOf(html)).toBe("1↓→")
  })

  it("比較が1つなら「1↓」", () => {
    const html = generateGradeReportBatchHtml(
      current,
      ["student-1"],
      { ...DEFAULT_GRADE_REPORT_SETTINGS, itemGradeComparisonMarks: true },
      buildComparisonMarks(current, [withPrevious], resultsByGradeId)
    )

    expect(ratingLabelOf(html)).toBe("1↓")
  })

  it("比較の付いていない項目と、評定の無い項目には記号を付けない", () => {
    const html = generateGradeReportBatchHtml(
      current,
      ["student-1", "student-2"],
      { ...DEFAULT_GRADE_REPORT_SETTINGS, itemGradeComparisonMarks: true },
      comparisonMarks
    )

    // 生徒1の「努力」（比較なし）は評定だけ
    expect(html).toContain(
      "effortの名前</td><td>40.0 / 100.0</td><td>40.0%</td><td><strong>1</strong>"
    )
    // 生徒2の「努力」（評定なし）は「-」だけ
    expect(html).toContain(
      "effortの名前</td><td>40.0 / 100.0</td><td>40.0%</td><td><strong>-</strong>"
    )
  })
})
