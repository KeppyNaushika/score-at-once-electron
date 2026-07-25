import type {
  GradeArchiveData,
  GradeArchiveVersion,
  GradeTransformResult,
  GradeVersionTransformer,
} from "../../../../src/types/gradeArchive.types"

/**
 * 1.9.0 → 1.10.0: 総合（overall）の撤去。
 *
 * 総合は「除外されていない全評価項目の加重平均」で、評定を評価項目として持つ運用では
 * 評定そのものを観点と一緒に平均へ混ぜる無意味な集計だった。境界を作る導線も UI に無い。
 * v1.10.0 では境界セット・手動上書きの対象が必ず評価項目になり、targetType を持たない。
 *
 * 旧アーカイブの総合エントリ（targetType === "overall"、または対象評価項目名を持たない）は
 * 移し先が無いので破棄する。破棄した件数は warning で利用者に見せる（黙って消さない）。
 */
export class V1_9_0_to_V1_10_0_Transformer implements GradeVersionTransformer {
  readonly fromVersion: GradeArchiveVersion = "1.9.0"
  readonly toVersion: GradeArchiveVersion = "1.10.0"

  transform(data: GradeArchiveData): GradeTransformResult {
    const warnings: string[] = []

    const boundarySets = data.boundariesData.boundarySets.filter(
      (boundarySet) =>
        boundarySet.targetType !== "overall" &&
        boundarySet.gradeItemName !== null
    )
    const droppedBoundarySets =
      data.boundariesData.boundarySets.length - boundarySets.length

    const gradeOverrides = data.gradeData.gradeOverrides?.filter(
      (gradeOverride) =>
        gradeOverride.targetType !== "overall" &&
        gradeOverride.gradeItemName !== null
    )
    const droppedOverrides =
      (data.gradeData.gradeOverrides?.length ?? 0) -
      (gradeOverrides?.length ?? 0)

    if (droppedBoundarySets > 0) {
      warnings.push(
        `1.9.0→1.10.0: 総合の成績境界セット ${droppedBoundarySets} 件を破棄しました（総合は撤去され、評定は評価項目として扱います）`
      )
    }
    if (droppedOverrides > 0) {
      warnings.push(
        `1.9.0→1.10.0: 総合評定の手動上書き ${droppedOverrides} 件を破棄しました（総合は撤去され、評定は評価項目として扱います）`
      )
    }

    // targetType は落として持ち回らない（新形式には存在しないフィールド）
    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        gradeData: {
          ...data.gradeData,
          // targetType だけを落とす。参照キー（uuid・名前）はそのまま持ち越す
          gradeOverrides: gradeOverrides?.map((gradeOverride) => ({
            studentNumber: gradeOverride.studentNumber,
            gradeItemId: gradeOverride.gradeItemId,
            gradeItemName: gradeOverride.gradeItemName,
            overrideLabel: gradeOverride.overrideLabel,
          })),
        },
        boundariesData: {
          boundarySets: boundarySets.map((boundarySet) => ({
            gradeItemId: boundarySet.gradeItemId,
            gradeItemName: boundarySet.gradeItemName,
            boundaries: boundarySet.boundaries,
          })),
        },
      },
      warnings,
    }
  }
}
