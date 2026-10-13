/**
 * ID統合インポート: 解答の構造（OMR設定・複合解答）の処理
 *
 * - CropRegionOmrConfig（＋ChoiceOption）（OMR設定）
 * - CompoundAnswer（＋Member）（複合解答の構造）
 *
 * いずれも親（CropRegion・ExamPage）が新規作成/マッチした場合にのみ扱う。
 *
 * **id が一致すれば同じ行。** 設定・複合解答はまず id で引き、無ければ一意キー（設定は
 * 設問）で引く。持ち物の集合（選択肢・メンバー）は親ごと入れ替えるが、入れ替えでも
 * アーカイブの子の id が取り込み先の別の親の下に在れば、それは同じ行なので、こちらの親へ
 * 移して値を書く（作り直さない）。
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
  warnings: string[],
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<void> {
  /** 設定の選択肢を、アーカイブの選択肢で入れ替える（設定の古い選択肢は消してから呼ぶ） */
  const writeChoiceOptions = async (
    omrConfigId: string,
    archiveConfigId: string
  ) => {
    for (const choiceOption of data.examData.omrChoiceOptions ?? []) {
      if (choiceOption.omrConfigId !== archiveConfigId) continue
      const values = {
        omrConfigId,
        choiceIndex: choiceOption.choiceIndex,
        label: choiceOption.label,
        isCorrect: choiceOption.isCorrect,
        shape: choiceOption.shape ?? null,
        normalizedCx: choiceOption.normalizedCx ?? null,
        normalizedCy: choiceOption.normalizedCy ?? null,
        normalizedWidth: choiceOption.normalizedWidth ?? null,
        normalizedHeight: choiceOption.normalizedHeight ?? null,
      }
      const existingById = await tx.cropRegionOmrChoiceOption.findUnique({
        where: { id: choiceOption.id },
      })
      const slotTaken =
        (await tx.cropRegionOmrChoiceOption.findUnique({
          where: {
            omrConfigId_choiceIndex: {
              omrConfigId,
              choiceIndex: choiceOption.choiceIndex,
            },
          },
        })) !== null
      if (slotTaken) {
        // アーカイブ自身が同じ番号の選択肢を2つ持っている（制約より前の DB から書き出した）
        warnings.push(
          "OMR の選択肢のうち、同じ設定に同じ番号のものが重なっていたため、1つだけ取り込みました"
        )
        continue
      }
      if (existingById) {
        // 別の設定の下に在る同じ id の選択肢は同じ行。こちらの設定へ移して値を書く
        await tx.cropRegionOmrChoiceOption.update({
          where: { id: existingById.id },
          data: {
            ...values,
            updatedAt: policy.replacedUpdatedAt(
              new Date(choiceOption.updatedAt)
            ),
          },
        })
      } else {
        await tx.cropRegionOmrChoiceOption.create({
          data: {
            id: choiceOption.id,
            ...values,
            ...policy.createdTimestamps(choiceOption),
          },
        })
      }
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

    // id が一致すれば同じ行。無ければ一意キー（設問）で引く
    const existing =
      (await tx.cropRegionOmrConfig.findUnique({
        where: { id: omrConfig.id },
      })) ??
      (await tx.cropRegionOmrConfig.findUnique({
        where: { cropRegionId: newCropRegionId },
      }))

    if (existing) {
      idMappings.cropRegionOmrConfig[omrConfig.id] = existing.id
      const updatedAt = replacementUpdatedAt(
        policy,
        omrConfig.updatedAt,
        existing.updatedAt
      )
      if (!updatedAt) continue

      // 親（設問）を変えると別の設定と重なるなら、親は変えない
      const regionTaken =
        existing.cropRegionId !== newCropRegionId &&
        (await tx.cropRegionOmrConfig.findUnique({
          where: { cropRegionId: newCropRegionId },
        })) !== null
      await tx.cropRegionOmrConfig.update({
        where: { id: existing.id },
        data: {
          ...(regionTaken ? {} : { cropRegionId: newCropRegionId }),
          ...values,
          updatedAt,
        },
      })
      // 選択肢は集合なので、設定ごと入れ替える
      await tx.cropRegionOmrChoiceOption.deleteMany({
        where: { omrConfigId: existing.id },
      })
      await writeChoiceOptions(existing.id, omrConfig.id)
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
    await writeChoiceOptions(omrConfig.id, omrConfig.id)
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
  warnings: string[],
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<void> {
  /** 複合解答のメンバーを、アーカイブのメンバーで入れ替える（古いメンバーは消してから呼ぶ） */
  const writeMembers = async (
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
      const values = {
        compoundAnswerId,
        cropRegionId: newCropRegionId,
        order: compoundAnswerMember.order,
        roleLabel: compoundAnswerMember.roleLabel,
        separator: compoundAnswerMember.separator,
      }
      const existingById = await tx.compoundAnswerMember.findUnique({
        where: { id: compoundAnswerMember.id },
      })
      // 1つの設問は1つの複合解答にしか入れない（cropRegionId が unique）
      const regionMember = await tx.compoundAnswerMember.findUnique({
        where: { cropRegionId: newCropRegionId },
      })
      if (regionMember && regionMember.id !== existingById?.id) {
        warnings.push(
          "複合解答のメンバーのうち、このPCで別の複合解答に入っている設問は取り込みませんでした"
        )
        continue
      }
      if (existingById) {
        // 別の複合解答の下に在る同じ id のメンバーは同じ行。こちらへ移して値を書く
        await tx.compoundAnswerMember.update({
          where: { id: existingById.id },
          data: {
            ...values,
            updatedAt: policy.replacedUpdatedAt(
              new Date(compoundAnswerMember.updatedAt)
            ),
          },
        })
      } else {
        await tx.compoundAnswerMember.create({
          data: {
            id: compoundAnswerMember.id,
            ...values,
            ...policy.createdTimestamps(compoundAnswerMember),
          },
        })
      }
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
      await writeMembers(existing.id, compoundAnswer.id)
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
    await writeMembers(compoundAnswer.id, compoundAnswer.id)
  }
}
