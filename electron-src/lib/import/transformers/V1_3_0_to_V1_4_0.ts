/**
 * v1.3.0 → v1.4.0 変換器
 *
 * 主な変更点:
 * - ExamMarkingFormat, ExamExportSettings, CropRegionMarkingOverride を試験データに追加
 * - Subject, SubjectSubtotalGroup をタグデータとして追加
 *
 * v1.3.0形式のアーカイブにはこれらのフィールドが存在しないため、
 * デフォルト値（空配列/null）を設定する
 */

import type {
  ExamArchiveData,
  ExamArchiveVersion,
  ExamTransformResult,
  ExamVersionTransformer,
} from "../../../../src/types/examArchive.types"

export class V1_3_0_to_V1_4_0_Transformer implements ExamVersionTransformer {
  readonly fromVersion: ExamArchiveVersion = "1.3.0"
  readonly toVersion: ExamArchiveVersion = "1.4.0"

  transform(data: ExamArchiveData): ExamTransformResult {
    const warnings: string[] = []

    warnings.push(
      `アーカイブはv0.5.x形式(archive v${this.fromVersion})で作成されています。` +
        `採点マーク設定・エクスポート設定・設問別マークオーバーライド・タグデータが追加されます。`
    )

    return {
      data: {
        ...data,
        manifest: {
          ...data.manifest,
          version: this.toVersion,
        },
        examData: {
          ...data.examData,
          examMarkingFormats: data.examData.examMarkingFormats ?? [],
          examExportSettings: data.examData.examExportSettings ?? null,
          cropRegionMarkingOverrides:
            data.examData.cropRegionMarkingOverrides ?? [],
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
