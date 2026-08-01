/**
 * 1.13.0 → 1.14.0: 境界セット（GradeBoundarySet）を畳み、境界を評価項目へ直付けする。
 *
 * 1.13.0 までは属性を持たない容器セットを挟み、境界は gradeBoundarySetId で
 * セット越しに評価項目を指していた。容器は「総合（overall）」— 評価項目に属さない境界 —
 * を置くための入れ物で、総合の撤去（1.10.0）で存在理由を失っていた。
 *
 * 変換はセットを引き当てて gradeItemId を引き継ぐだけ。セットは属性を持たないので
 * 失われる情報は無い（境界を1本も持たないセットは、畳めば存在しないのと同じ）。
 */

import type {
  ArchiveGradeItemBoundaryRow,
  GradeArchiveVersion,
} from "../../../../src/types/gradeArchive.types"
import type {
  AnyGradeArchiveData,
  GradeTransformResult,
  GradeVersionTransformer,
} from "./types"
import { isGradeArchiveV1_13_0 } from "./types"

export class V1_13_0_to_V1_14_0_Transformer implements GradeVersionTransformer {
  readonly fromVersion: GradeArchiveVersion = "1.13.0"
  readonly toVersion: GradeArchiveVersion = "1.14.0"

  transform(data: AnyGradeArchiveData): GradeTransformResult {
    if (!isGradeArchiveV1_13_0(data)) {
      return { data, warnings: [] }
    }

    const { gradeBoundarySets, gradeBoundaries, ...withoutBoundarySections } =
      data

    const gradeItemIdBySetId = new Map(
      gradeBoundarySets.map((boundarySet) => [
        boundarySet.id,
        boundarySet.gradeItemId,
      ])
    )

    const warnings: string[] = []
    let orphanedBoundaries = 0
    const gradeItemBoundaries: ArchiveGradeItemBoundaryRow[] =
      gradeBoundaries.flatMap((boundary) => {
        const gradeItemId = gradeItemIdBySetId.get(boundary.gradeBoundarySetId)
        if (!gradeItemId) {
          orphanedBoundaries++
          return []
        }
        return [
          {
            id: boundary.id,
            gradeItemId,
            label: boundary.label,
            minPercentage: boundary.minPercentage,
            order: boundary.order,
            createdAt: boundary.createdAt,
            updatedAt: boundary.updatedAt,
          },
        ]
      })

    if (orphanedBoundaries > 0) {
      warnings.push(
        `1.13.0→1.14.0: 属する境界セットが見つからない境界 ${orphanedBoundaries}件を破棄しました`
      )
    }

    return {
      data: {
        ...withoutBoundarySections,
        manifest: { ...data.manifest, version: this.toVersion },
        gradeItemBoundaries,
      },
      warnings,
    }
  }
}
