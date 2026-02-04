/**
 * v1.3.0 → v1.4.0 変換器
 *
 * 主な変更点:
 * - ProjectMarkingFormat, ProjectExportSettings, CropRegionMarkingOverride をプロジェクトデータに追加
 * - Subject, SubjectSubtotalGroup を教科データとして追加
 *
 * v1.3.0形式のアーカイブにはこれらのフィールドが存在しないため、
 * デフォルト値（空配列/null）を設定する
 */

import type {
  ArchiveData,
  ArchiveVersion,
  TransformResult,
  VersionTransformer,
} from "./types"

export class V1_3_0_to_V1_4_0_Transformer implements VersionTransformer {
  readonly fromVersion: ArchiveVersion = "1.3.0"
  readonly toVersion: ArchiveVersion = "1.4.0"

  transform(data: ArchiveData): TransformResult {
    const warnings: string[] = []

    warnings.push(
      `アーカイブはv0.5.x形式(archive v${this.fromVersion})で作成されています。` +
        `採点マーク設定・エクスポート設定・設問別マークオーバーライド・教科データが追加されます。`
    )

    return {
      data: {
        ...data,
        manifest: {
          ...data.manifest,
          version: this.toVersion,
        },
        projectData: {
          ...data.projectData,
          projectMarkingFormats: data.projectData.projectMarkingFormats ?? [],
          projectExportSettings: data.projectData.projectExportSettings ?? null,
          cropRegionMarkingOverrides:
            data.projectData.cropRegionMarkingOverrides ?? [],
        },
        subjectsData: data.subjectsData ?? {
          subjects: [],
          subjectSubtotalGroups: [],
        },
      },
      warnings,
    }
  }
}
