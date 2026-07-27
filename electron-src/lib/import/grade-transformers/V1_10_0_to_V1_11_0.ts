/**
 * 1.10.0 → 1.11.0: 観点間の制約ルールの設定JSON（config）を構造化フィールドへ展開する。
 *
 * 旧 config は評価項目を「名前」で参照していた（issue #1063）。アーカイブ側でも同じ形で
 * 持っていたため、ここでは名前フィールドへ移すところまでを行う。uuidは旧アーカイブに
 * 存在しないので、importer が名前フォールバックで解決する。
 */

import type {
  ArchiveGradeConstraint,
  GradeArchiveData,
  GradeArchiveVersion,
  GradeTransformResult,
  GradeVersionTransformer,
} from "../../../../src/types/gradeArchive.types"

/** 旧 config の形（kind別。壊れたJSONは既定値へ落とす） */
interface LegacyConstraintConfig {
  labelValues?: Record<string, number>
  aggregate?: string
  tolerance?: number
  target?: string
  viewpointItems?: string[]
  labels?: string[]
}

function parseLegacyConfig(raw: string): LegacyConstraintConfig {
  try {
    const parsed: unknown = JSON.parse(raw || "{}")
    if (typeof parsed !== "object" || parsed === null) return {}
    return parsed as LegacyConstraintConfig
  } catch {
    return {}
  }
}

export class V1_10_0_to_V1_11_0_Transformer implements GradeVersionTransformer {
  readonly fromVersion: GradeArchiveVersion = "1.10.0"
  readonly toVersion: GradeArchiveVersion = "1.11.0"

  transform(data: GradeArchiveData): GradeTransformResult {
    const warnings: string[] = []
    const legacyConstraints = (data.gradeData.gradeConstraints ?? []).filter(
      (gradeConstraint) => gradeConstraint.config !== undefined
    )

    if (legacyConstraints.length === 0) {
      return {
        data: {
          ...data,
          manifest: { ...data.manifest, version: this.toVersion },
        },
        warnings,
      }
    }

    const gradeConstraints: ArchiveGradeConstraint[] = (
      data.gradeData.gradeConstraints ?? []
    ).map((gradeConstraint) => {
      if (gradeConstraint.config === undefined) return gradeConstraint
      const legacy = parseLegacyConfig(gradeConstraint.config)
      const { config: _config, ...rest } = gradeConstraint
      return {
        ...rest,
        targetGradeItemName: legacy.target ?? null,
        aggregate: legacy.aggregate ?? "average",
        tolerance: legacy.tolerance ?? 1,
        viewpointGradeItemNames: legacy.viewpointItems ?? [],
        labelValues: legacy.labelValues ?? {},
        exclusionLabels: legacy.labels ?? [],
      }
    })

    warnings.push(
      `1.10.0→1.11.0: 制約ルール${legacyConstraints.length}件の設定を評価項目名で復元しました。` +
        `同名の評価項目が複数ある場合は取り込み後に「観点間の制約ルール」を確認してください。`
    )

    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        gradeData: { ...data.gradeData, gradeConstraints },
      },
      warnings,
    }
  }
}
