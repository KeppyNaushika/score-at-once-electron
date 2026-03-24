/**
 * v1.10.0 → v1.11.0 変換器
 *
 * 主な変更点:
 * - CropRegionOmrChoiceOption にバブル位置カラム追加 (shape, normalizedCx/Cy/Width/Height)
 * - CropRegionOmrDigitBox テーブル追加
 * - CropRegionOmrConfig.cellGeometryJson 削除
 * - CompoundAnswer / CompoundAnswerMember / CompoundAnswerScore テーブル追加
 *
 * v1.10.0形式のアーカイブにはバブル位置・digitBox・compoundAnswerデータが存在しないため、
 * デフォルト値で補完する
 */

import type {
  ArchiveData,
  ArchiveVersion,
  TransformResult,
  VersionTransformer,
} from "./types"

export class V1_10_0_to_V1_11_0_Transformer implements VersionTransformer {
  readonly fromVersion: ArchiveVersion = "1.10.0"
  readonly toVersion: ArchiveVersion = "1.11.0"

  transform(data: ArchiveData): TransformResult {
    const warnings: string[] = []
    warnings.push(
      `アーカイブはv0.9.x形式(archive v${this.fromVersion})で作成されています。` +
        `OMRバブル位置・数字欄位置・複合回答データはデフォルト値で補完されます。`
    )

    // choiceOptions にバブル位置フィールドを追加（null = 未設定）
    const examData = { ...data.examData }
    if (examData.omrChoiceOptions) {
      examData.omrChoiceOptions = examData.omrChoiceOptions.map((opt) => ({
        ...opt,
        shape: null,
        normalizedCx: null,
        normalizedCy: null,
        normalizedWidth: null,
        normalizedHeight: null,
      }))
    }

    // omrConfigs から cellGeometryJson を除去
    if (examData.omrConfigs) {
      examData.omrConfigs = examData.omrConfigs.map((cfg) => {
        const { cellGeometryJson: _, ...rest } = cfg as typeof cfg & {
          cellGeometryJson?: string | null
        }
        return rest
      })
    }

    // 新規フィールドをデフォルト空配列で追加
    examData.omrDigitBoxes = []
    examData.compoundAnswers = []
    examData.compoundAnswerMembers = []
    examData.compoundAnswerScores = []

    // Tag に order/color フィールドを追加（デフォルト値）
    const tagsData = data.tagsData
      ? {
          ...data.tagsData,
          tags: data.tagsData.tags.map((tag) => ({
            ...tag,
            order: 0,
            color: null,
          })),
        }
      : undefined

    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        examData,
        ...(tagsData ? { tagsData } : {}),
      },
      warnings,
    }
  }
}
