/**
 * ID統合インポート: 解答の構造（OMR設定・複合解答）の処理
 *
 * - CropRegionOmrConfig（＋ChoiceOption）（OMR設定）
 * - CompoundAnswer（＋Member）（複合解答の構造）
 *
 * いずれも親（CropRegion・ExamPage）が新規作成/マッチした場合にのみ扱う。
 *
 * **値の扱いは importValuePolicy に一本化されている**（上書きする／統合する／別で追加する）。
 * 既にある行を置き換えるかどうかも、新しく作る行の時刻も、この規則だけで決まる。
 * かつては「既にあれば触らない」で一律にスキップしていたため、書き出した側で直した
 * OMRの閾値が、取り込んでも黙って古いままだった。
 */

import type { ExtractedArchiveData } from "../exam-archive/archiveExtractor"
import type { ImportValuePolicy } from "./importValuePolicy"
import { replacementUpdatedAt } from "./importValuePolicy"
import type { IdMappings, PrismaTransaction } from "./types"

/**
 * OMR設定（CropRegionOmrConfig＋ChoiceOption）を処理
 *
 * リージョンとは1:1。既にあれば規則に従って列を書き換える。
 * 選択肢（ChoiceOption）は「その設定の持ち物の集合」なので、行ごとではなく
 * **設定ごと入れ替える**（行ごとの LWW だと、増減したときに古い選択肢が残る）。
 *
 * 選択式以外（廃止した手書き数字）の設定は取り込まない。
 */
export async function processOmrConfigs(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<void> {
  const createChoiceOptions = async (
    omrConfigId: string,
    archiveConfigId: string
  ) => {
    for (const choiceOption of data.examData.omrChoiceOptions ?? []) {
      if (choiceOption.omrConfigId !== archiveConfigId) continue
      await tx.cropRegionOmrChoiceOption.create({
        data: {
          id: choiceOption.id,
          omrConfigId,
          choiceIndex: choiceOption.choiceIndex,
          label: choiceOption.label,
          isCorrect: choiceOption.isCorrect,
          shape: choiceOption.shape ?? null,
          normalizedCx: choiceOption.normalizedCx ?? null,
          normalizedCy: choiceOption.normalizedCy ?? null,
          normalizedWidth: choiceOption.normalizedWidth ?? null,
          normalizedHeight: choiceOption.normalizedHeight ?? null,
          ...policy.createdTimestamps(choiceOption),
        },
      })
      idMappings.cropRegionOmrChoiceOption[choiceOption.id] = choiceOption.id
    }
  }

  for (const omrConfig of data.examData.omrConfigs ?? []) {
    if (omrConfig.type !== "choice") continue

    const newCropRegionId = idMappings.cropRegion[omrConfig.cropRegionId]
    if (!newCropRegionId) continue

    const values = {
      type: omrConfig.type,
      numChoices: omrConfig.numChoices,
      choiceLayout: omrConfig.choiceLayout,
      colorThreshold: omrConfig.colorThreshold,
      areaThreshold: omrConfig.areaThreshold,
    }

    const existing =
      (await tx.cropRegionOmrConfig.findFirst({
        where: { cropRegionId: newCropRegionId },
      })) ??
      (await tx.cropRegionOmrConfig.findUnique({ where: { id: omrConfig.id } }))

    if (existing) {
      idMappings.cropRegionOmrConfig[omrConfig.id] = existing.id
      const updatedAt = replacementUpdatedAt(
        policy,
        omrConfig.updatedAt,
        existing.updatedAt
      )
      if (!updatedAt) continue

      await tx.cropRegionOmrConfig.update({
        where: { id: existing.id },
        data: { ...values, updatedAt },
      })
      // 選択肢は集合なので、設定ごと入れ替える
      await tx.cropRegionOmrChoiceOption.deleteMany({
        where: { omrConfigId: existing.id },
      })
      await createChoiceOptions(existing.id, omrConfig.id)
      continue
    }

    await tx.cropRegionOmrConfig.create({
      data: {
        id: omrConfig.id,
        cropRegionId: newCropRegionId,
        ...values,
        ...policy.createdTimestamps(omrConfig),
      },
    })
    idMappings.cropRegionOmrConfig[omrConfig.id] = omrConfig.id
    await createChoiceOptions(omrConfig.id, omrConfig.id)
  }
}

/**
 * 複合解答（CompoundAnswer＋Member）を処理
 *
 * メンバーは「その複合解答の持ち物の集合」なので、OMRの選択肢と同じく
 * 複合解答ごと入れ替える。
 */
export async function processCompoundAnswers(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<void> {
  const createMembers = async (
    compoundAnswerId: string,
    archiveCompoundAnswerId: string
  ) => {
    for (const compoundAnswerMember of data.examData.compoundAnswerMembers ??
      []) {
      if (compoundAnswerMember.compoundAnswerId !== archiveCompoundAnswerId) {
        continue
      }
      const newCropRegionId =
        idMappings.cropRegion[compoundAnswerMember.cropRegionId]
      if (!newCropRegionId) continue
      await tx.compoundAnswerMember.create({
        data: {
          id: compoundAnswerMember.id,
          compoundAnswerId,
          cropRegionId: newCropRegionId,
          order: compoundAnswerMember.order,
          roleLabel: compoundAnswerMember.roleLabel,
          separator: compoundAnswerMember.separator,
          ...policy.createdTimestamps(compoundAnswerMember),
        },
      })
      idMappings.compoundAnswerMember[compoundAnswerMember.id] =
        compoundAnswerMember.id
    }
  }

  for (const compoundAnswer of data.examData.compoundAnswers ?? []) {
    const newExamPageId = idMappings.examPage[compoundAnswer.examPageId]
    if (!newExamPageId) continue

    const values = {
      examPageId: newExamPageId,
      label: compoundAnswer.label,
      answerFormat: compoundAnswer.answerFormat,
      correctAnswer: compoundAnswer.correctAnswer,
      points: compoundAnswer.points,
      orderIndex: compoundAnswer.orderIndex,
      alternativeAnswers: compoundAnswer.alternativeAnswers,
      requireReduced: compoundAnswer.requireReduced,
    }

    const existing = await tx.compoundAnswer.findUnique({
      where: { id: compoundAnswer.id },
    })
    if (existing) {
      idMappings.compoundAnswer[compoundAnswer.id] = existing.id
      const updatedAt = replacementUpdatedAt(
        policy,
        compoundAnswer.updatedAt,
        existing.updatedAt
      )
      if (!updatedAt) continue

      await tx.compoundAnswer.update({
        where: { id: existing.id },
        data: { ...values, updatedAt },
      })
      await tx.compoundAnswerMember.deleteMany({
        where: { compoundAnswerId: existing.id },
      })
      await createMembers(existing.id, compoundAnswer.id)
      continue
    }

    await tx.compoundAnswer.create({
      data: {
        id: compoundAnswer.id,
        ...values,
        ...policy.createdTimestamps(compoundAnswer),
      },
    })
    idMappings.compoundAnswer[compoundAnswer.id] = compoundAnswer.id
    await createMembers(compoundAnswer.id, compoundAnswer.id)
  }
}
