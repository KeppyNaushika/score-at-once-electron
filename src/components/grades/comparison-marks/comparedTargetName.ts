import { formatComparedTargetName } from "@/lib/shared/gradeComparisonNames"
import type { GradeComparisonRow } from "@/queries/gradeStructure"

/**
 * 比較の行から比較先の表示名を作る（同じ成績算出なら項目名、別なら「成績算出名 > 項目名」）。
 *
 * @param gradeId 比較を持つ（自分側の）成績算出
 */
export function comparedTargetNameOf(
  comparison: GradeComparisonRow,
  gradeId: string
): string {
  const comparedGradeItem = comparison.comparedGradeItem
  return formatComparedTargetName(
    comparedGradeItem.gradeId === gradeId ? null : comparedGradeItem.grade.name,
    comparedGradeItem.name
  )
}
