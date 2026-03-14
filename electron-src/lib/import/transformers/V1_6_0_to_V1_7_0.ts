/**
 * V1.6.0 → V1.7.0 変換器
 *
 * 変更点:
 * - CropRegionOmrConfig と CropRegionOmrChoiceOption テーブルを追加
 * - ArchiveExamData に omrConfigs / omrChoiceOptions フィールドを追加（オプション）
 */

import type {
  ArchiveData,
  ArchiveVersion,
  TransformResult,
  VersionTransformer,
} from "./types"

export class V1_6_0_to_V1_7_0_Transformer implements VersionTransformer {
  readonly fromVersion: ArchiveVersion = "1.6.0"
  readonly toVersion: ArchiveVersion = "1.7.0"

  transform(data: ArchiveData): TransformResult {
    const warnings: string[] = []

    // v1.6.0 以前のアーカイブには omrConfigs が存在しない
    // 空配列をデフォルトとして追加するだけで良い
    const examData = {
      ...data.examData,
      omrConfigs: data.examData.omrConfigs ?? [],
      omrChoiceOptions: data.examData.omrChoiceOptions ?? [],
    }

    warnings.push(
      "v1.7.0: CropRegionOmrConfig/CropRegionOmrChoiceOption フィールドを初期化しました"
    )

    return {
      data: {
        ...data,
        manifest: {
          ...data.manifest,
          version: this.toVersion,
        },
        examData,
      },
      warnings,
    }
  }
}
