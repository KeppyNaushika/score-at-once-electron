/**
 * v1.13.0 → v1.14.0 変換器
 *
 * 主な変更点:
 * - ReturnSnapshot 追加（答案返却版スナップショット。返却後の採点修正差分検出用）
 *
 * 旧アーカイブに returnSnapshots は存在しないため空配列で補完する。
 */

import type {
  ExamArchiveData,
  ExamArchiveVersion,
  ExamTransformResult,
  ExamVersionTransformer,
} from "../../../../src/types/examArchive.types"

export class V1_13_0_to_V1_14_0_Transformer implements ExamVersionTransformer {
  readonly fromVersion: ExamArchiveVersion = "1.13.0"
  readonly toVersion: ExamArchiveVersion = "1.14.0"

  transform(data: ExamArchiveData): ExamTransformResult {
    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        scoresData: {
          ...data.scoresData,
          returnSnapshots: data.scoresData.returnSnapshots ?? [],
        },
      },
      warnings: [
        "1.13.0→1.14.0: ReturnSnapshot（答案返却版スナップショット）を空で初期化しました。",
      ],
    }
  }
}
