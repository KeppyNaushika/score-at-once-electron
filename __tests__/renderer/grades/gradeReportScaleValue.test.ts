/**
 * 個人成績通知書の資料の内訳で、外部資料の文字評価を見せ方（scaleValueDisplay）に従って出すテスト
 * （docs/vlm-grading-design.md §4-8-8）
 *
 * - 「8.0」／「A (8.0)」／「A」の3通り
 * - 換算表に当てはまらない記号（換算点が無い）は記号だけ
 * - 数値の資料は見せ方に関わらず今までどおり
 */
import { describe, expect, it } from "vitest"

import { generateGradeReportBatchHtml } from "@/components/grades/06-export/generateGradeReportHtml"
import type {
  GradeCalculationResult,
  SourceScoreResult,
} from "@/types/grade.types"
import { DEFAULT_GRADE_REPORT_SETTINGS } from "@/types/gradeReport.types"
import type { ScaleValueDisplay } from "@/types/rubric.types"

function sourceScore(
  dataSourceId: string,
  rawScore: number | null,
  letterValue: string | null
): SourceScoreResult {
  return {
    dataSourceId,
    dataSourceName: `${dataSourceId}の名前`,
    type: "manual",
    rawScore,
    maxScore: 10,
    weight: 1,
    weightedScore: rawScore,
    isEstimated: false,
    estimation: null,
    letterValue,
    adjustment: null,
    adjustmentReason: null,
    comment: null,
  }
}

function calculationResult(
  sourceScores: SourceScoreResult[]
): GradeCalculationResult {
  return {
    gradeId: "grade-1",
    gradeName: "成績",
    classNames: [],
    gradeItems: [
      {
        id: "item-1",
        name: "項目",
        order: 0,
        dataSources: [],
        boundaries: [],
      },
    ],
    students: [
      {
        gradeStudentId: "grade-student-1",
        studentId: "student-1",
        studentNumber: "1",
        lastName: "山田",
        firstName: "太郎",
        attendanceNumber: 1,
        className: "3-A",
        gradeItemResults: [
          {
            gradeItemId: "item-1",
            gradeItemName: "項目",
            isExcluded: false,
            isAllMissing: false,
            sourceScores,
            weightedScore: 8,
            weightedMaxScore: 10,
            percentage: 80,
            gradeLabel: null,
            originalGradeLabel: null,
            overrideGradeLabel: null,
            frozen: null,
          },
        ],
      },
    ],
  }
}

function breakdownHtml(
  sourceScores: SourceScoreResult[],
  scaleValueDisplay: ScaleValueDisplay
): string {
  return generateGradeReportBatchHtml(
    calculationResult(sourceScores),
    ["student-1"],
    {
      ...DEFAULT_GRADE_REPORT_SETTINGS,
      showSourceBreakdown: true,
      sourceBreakdownColumnScore: true,
      scaleValueDisplay,
    },
    null
  )
}

describe("資料の内訳の文字評価", () => {
  const letterSource = [sourceScore("letter", 8, "A")]

  it("points は換算点だけ", () => {
    expect(breakdownHtml(letterSource, "points")).toContain(
      "<td>8.0 / 10.0</td>"
    )
  })

  it("label_points は記号と換算点", () => {
    expect(breakdownHtml(letterSource, "label_points")).toContain(
      "<td>A (8.0) / 10.0</td>"
    )
  })

  it("label は記号だけ", () => {
    expect(breakdownHtml(letterSource, "label")).toContain(
      "<td>A / 10.0</td>"
    )
  })

  it("換算点が無い記号は、どの見せ方でも記号だけ", () => {
    expect(
      breakdownHtml([sourceScore("letter", null, "E")], "points")
    ).toContain("<td>E / 10.0</td>")
  })

  it("数値の資料は見せ方に関わらずそのまま", () => {
    expect(breakdownHtml([sourceScore("number", 7, null)], "label")).toContain(
      "<td>7.0 / 10.0</td>"
    )
  })
})
