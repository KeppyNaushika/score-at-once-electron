/**
 * v1.17.0 → v1.18.0 変換器
 *
 * 主な変更点:
 * - CropRegionMarkingOverride（設問別の採点マーク上書き）を廃止。
 *   設定UIも出力描画への反映も一度も実装されないまま入出力だけが維持されていた
 *   ため、モデルごと削除した（issue #852）。
 *
 * 旧アーカイブに含まれる cropRegionMarkingOverrides は取り込み先が無くなったので
 * 読み捨てる。キーが無い現行形式に対しては無変更で冪等。
 */

import type {
  ArchiveExamData,
  ExamArchiveData,
  ExamArchiveVersion,
  ExamTransformResult,
  ExamVersionTransformer,
} from "../../../../src/types/examArchive.types"

export class V1_17_0_to_V1_18_0_Transformer implements ExamVersionTransformer {
  readonly fromVersion: ExamArchiveVersion = "1.17.0"
  readonly toVersion: ExamArchiveVersion = "1.18.0"

  transform(data: ExamArchiveData): ExamTransformResult {
    const examDataRecord = {
      ...(data.examData as unknown as Record<string, unknown>),
    }
    const droppedOverrides = examDataRecord.cropRegionMarkingOverrides
    const droppedCount = Array.isArray(droppedOverrides)
      ? droppedOverrides.length
      : 0
    delete examDataRecord.cropRegionMarkingOverrides

    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        examData: examDataRecord as unknown as ArchiveExamData,
      },
      warnings:
        droppedCount > 0
          ? [
              `1.17.0→1.18.0: 設問別の採点マーク上書き設定は廃止されたため、${droppedCount}件を読み飛ばしました。`,
            ]
          : [],
    }
  }
}
