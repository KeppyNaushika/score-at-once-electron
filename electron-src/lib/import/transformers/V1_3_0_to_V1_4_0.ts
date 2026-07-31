/**
 * v1.3.0 → v1.4.0 変換器
 *
 * 主な変更点:
 * - ExamMarkingFormat, ExamExportSettings を試験データに追加
 * - Subject, SubjectSubtotalGroup をタグデータとして追加
 *
 * ※ 当時同時に追加された CropRegionMarkingOverride は v1.18.0 で廃止したため、
 *   ここでの補完対象から外している（V1_17_0_to_V1_18_0 が読み捨てる）。
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
        `採点マーク設定・エクスポート設定・タグデータが追加されます。`
    )

    return {
      data: {
        ...data,
        manifest: {
          ...data.manifest,
          version: this.toVersion,
        },
        // examMarkingFormats は 1.4.0 で導入され 1.22.0 で廃止された。
        // 現行型には無いので record として補完し、後段の変換器が読み捨てる。
        examData: {
          ...data.examData,
          // examMarkingFormats / examExportSettings は 1.4.0 で導入され 1.22.0 で
          // 廃止・正規化された。現行型には無いので record として補完し、後段が処理する
          ...{
            examMarkingFormats:
              (data.examData as unknown as Record<string, unknown>)
                .examMarkingFormats ?? [],
            examExportSettings:
              (data.examData as unknown as Record<string, unknown>)
                .examExportSettings ?? null,
          },
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
