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
  ExamArchiveData,
  ExamArchiveVersion,
  ExamTransformResult,
  ExamVersionTransformer,
} from "../../../../src/types/examArchive.types"

export class V1_10_0_to_V1_11_0_Transformer implements ExamVersionTransformer {
  readonly fromVersion: ExamArchiveVersion = "1.10.0"
  readonly toVersion: ExamArchiveVersion = "1.11.0"

  transform(data: ExamArchiveData): ExamTransformResult {
    const warnings: string[] = []
    warnings.push(
      `アーカイブはv0.9.x形式(archive v${this.fromVersion})で作成されています。` +
        `OMRバブル位置・数字欄位置・複合回答データはデフォルト値で補完されます。`
    )

    // choiceOptions にバブル位置フィールドを追加（null = 未設定）。
    // 既存値があれば保持する（冪等）
    const examData = { ...data.examData }
    if (examData.omrChoiceOptions) {
      examData.omrChoiceOptions = examData.omrChoiceOptions.map((opt) => ({
        ...opt,
        shape: opt.shape ?? null,
        normalizedCx: opt.normalizedCx ?? null,
        normalizedCy: opt.normalizedCy ?? null,
        normalizedWidth: opt.normalizedWidth ?? null,
        normalizedHeight: opt.normalizedHeight ?? null,
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

    // 新規フィールドをデフォルト空配列で追加（既存値があれば保持・冪等）
    examData.compoundAnswers = examData.compoundAnswers ?? []
    examData.compoundAnswerMembers = examData.compoundAnswerMembers ?? []
    examData.compoundAnswerScores = examData.compoundAnswerScores ?? []

    // Tag に order/color フィールドを追加（既存値があれば保持・冪等）
    const tagsData = data.tagsData
      ? {
          ...data.tagsData,
          // 既定値を埋めるのは**チェーンを通したあと**（版の判定がキーの有無を見るため）
          // なので、tags.json が在っても tags キーだけ欠けたアーカイブが来る
          tags: (data.tagsData.tags ?? []).map((tag) => ({
            ...tag,
            order: tag.order ?? 0,
            color: tag.color ?? null,
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
