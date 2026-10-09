import type { GradeComparisonRow } from "@/queries/gradeStructure"
import type { GradeCalculationResult } from "@/types/grade.types"
import type { GradeExcelComparisonColumn } from "@/types/gradeExport.types"

import { comparedTargetNameOf } from "../comparison-marks/comparedTargetName"
import { COMPARISON_SYMBOLS } from "../comparison-marks/comparisonSymbols"
import type { ComparisonMarksByCell } from "../comparison-marks/types"

/**
 * Excel「成績一覧」に足す比較の列を組み立てる（main へ渡す値。main は書くだけ）。
 *
 * 列は比較の並び（評価項目ごとの `order` の順）。値は結果画面と同じ記号の組み立て
 * （`buildComparisonMarks`）から取り、比較先の結果が取れない生徒は「・」（missing）。
 *
 * @param comparisons 出力で使う比較（選択で外したものは渡さない）
 * @param comparisonMarks 同じ比較から組み立てた記号。比較が無ければ null
 */
export function buildExcelComparisonColumns(
  result: GradeCalculationResult,
  comparisons: readonly GradeComparisonRow[],
  comparisonMarks: ComparisonMarksByCell | null
): GradeExcelComparisonColumn[] {
  return comparisons.map((comparison) => ({
    comparisonId: comparison.id,
    gradeItemId: comparison.gradeItemId,
    comparedTargetName: comparedTargetNameOf(comparison, result.gradeId),
    cells: result.students.map((student) => {
      const comparisonMark = comparisonMarks
        ?.get(student.gradeStudentId)
        ?.get(comparison.gradeItemId)
        ?.find((mark) => mark.comparisonId === comparison.id)
      return {
        gradeStudentId: student.gradeStudentId,
        comparedGradeLabel: comparisonMark?.comparedGradeLabel ?? null,
        symbol:
          COMPARISON_SYMBOLS[comparisonMark?.direction ?? "missing"].symbol,
      }
    }),
  }))
}
