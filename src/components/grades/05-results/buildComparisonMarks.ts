import type { GradeComparisonRow } from "@/queries/grade"
import type {
  GradeCalculationResult,
  GradeItemResult,
} from "@/types/grade.types"

import { resolveGradeLabelDirection } from "../gradeLabelValues"
import type { ComparisonMark, ComparisonMarksByCell } from "./types"

/** 評定として比べられる値か（除外・未算出・空の上書きは比べない） */
function comparableLabel(itemResult: GradeItemResult | undefined) {
  if (!itemResult || itemResult.isExcluded) return null
  return itemResult.gradeLabel || null
}

/**
 * 比較の記号を、結果のマスごとに組み立てる。
 *
 * 比較先の生徒は人（studentId）で突き合わせる。対象者（gradeStudentId）は
 * 成績算出ごとに別の行なので使えない。上下の物差しは**自分側の項目の成績境界**。
 *
 * @param resultsByGradeId 比較先の成績算出の結果。この成績算出自身も含める。
 *   まだ読み込めていない成績算出は入れない（その比較は "missing" になる）
 */
export function buildComparisonMarks(
  result: GradeCalculationResult,
  comparisons: readonly GradeComparisonRow[],
  resultsByGradeId: ReadonlyMap<string, GradeCalculationResult>
): ComparisonMarksByCell {
  const itemResultIndexByGradeId = new Map(
    [...resultsByGradeId.entries()].map(([comparedGradeId, comparedResult]) => [
      comparedGradeId,
      new Map(
        comparedResult.students.flatMap((student) =>
          student.gradeItemResults.map((itemResult) => [
            `${student.studentId}:${itemResult.gradeItemId}`,
            itemResult,
          ])
        )
      ),
    ])
  )

  const marksByCell: ComparisonMarksByCell = new Map()
  result.students.forEach((student) => {
    const marksByGradeItemId = new Map<string, ComparisonMark[]>()
    result.gradeItems.forEach((gradeItem) => {
      const itemComparisons = comparisons.filter(
        (comparison) => comparison.gradeItemId === gradeItem.id
      )
      if (itemComparisons.length === 0) return

      const ownLabel = comparableLabel(
        student.gradeItemResults.find(
          (itemResult) => itemResult.gradeItemId === gradeItem.id
        )
      )
      marksByGradeItemId.set(
        gradeItem.id,
        itemComparisons.map((comparison) => {
          const comparedGradeItem = comparison.comparedGradeItem
          const comparedItemResult = itemResultIndexByGradeId
            .get(comparedGradeItem.gradeId)
            ?.get(`${student.studentId}:${comparedGradeItem.id}`)
          const comparedLabel = comparableLabel(comparedItemResult)
          return {
            comparisonId: comparison.id,
            direction:
              ownLabel === null || comparedLabel === null
                ? "missing"
                : resolveGradeLabelDirection(
                    comparedLabel,
                    ownLabel,
                    gradeItem.boundaries
                  ),
            comparedGradeName:
              comparedGradeItem.gradeId === result.gradeId
                ? null
                : comparedGradeItem.grade.name,
            comparedGradeItemName: comparedGradeItem.name,
            comparedPercentage: comparedItemResult?.isExcluded
              ? null
              : (comparedItemResult?.percentage ?? null),
            comparedGradeLabel: comparedLabel,
          }
        })
      )
    })
    marksByCell.set(student.gradeStudentId, marksByGradeItemId)
  })
  return marksByCell
}
