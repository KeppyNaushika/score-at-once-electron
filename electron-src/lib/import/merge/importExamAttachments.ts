/**
 * ID統合インポート: 試験に付随する各種データの処理
 *
 * - ExamMarkingFormat / ExamExportSettings（採点マーク・出力設定）
 * - CropRegionOmrConfig（＋ChoiceOption/DigitBox）（OMR設定）
 * - CompoundAnswer（＋Member）（複合解答の構造）
 * - Tag / TagSubtotalGroup / ExamTag（タグ）
 * - ExamClassroom（試験×学級の関連）
 *
 * いずれも親（試験・CropRegion・ExamPage）が新規作成/マッチした場合にのみ作成し、
 * 既存があれば重複を避けてスキップする。
 */

import type { ExtractedArchiveData } from "../exam-archive/archiveExtractor"
import type { IdMappings, PrismaTransaction } from "./types"

export async function processExamMarkingFormats(
  data: ExtractedArchiveData,
  newExamId: string,
  tx: PrismaTransaction
): Promise<void> {
  const formats = data.examData.examMarkingFormats ?? []
  for (const format of formats) {
    const existing = await tx.examMarkingFormat.findFirst({
      where: { examId: newExamId, markType: format.markType },
    })
    if (existing) continue

    const existingById = await tx.examMarkingFormat.findUnique({
      where: { id: format.id },
    })
    if (!existingById) {
      await tx.examMarkingFormat.create({
        data: {
          id: format.id,
          examId: newExamId,
          markType: format.markType,
          symbol: format.symbol,
          color: format.color,
          fontSize: format.fontSize,
          strokeWidth: format.strokeWidth,
        },
      })
    }
  }
}

export async function processExamExportSettings(
  data: ExtractedArchiveData,
  newExamId: string,
  tx: PrismaTransaction
): Promise<void> {
  const settings = data.examData.examExportSettings
  if (!settings) return

  const existing = await tx.examExportSettings.findUnique({
    where: { examId: newExamId },
  })
  if (existing) return

  const existingById = await tx.examExportSettings.findUnique({
    where: { id: settings.id },
  })
  if (!existingById) {
    await tx.examExportSettings.create({
      data: {
        id: settings.id,
        examId: newExamId,
        settingsJson: settings.settingsJson,
      },
    })
  }
}

export async function processTags(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  tx: PrismaTransaction
): Promise<void> {
  if (!data.tagsData) return
  const tagIdMapping: Record<string, string> = {}

  for (const tag of data.tagsData.tags) {
    const existingByName = await tx.tag.findUnique({
      where: { name: tag.name },
    })
    if (existingByName) {
      tagIdMapping[tag.id] = existingByName.id
      continue
    }

    const existingById = await tx.tag.findUnique({
      where: { id: tag.id },
    })
    if (existingById) {
      tagIdMapping[tag.id] = tag.id
    } else {
      await tx.tag.create({
        data: { id: tag.id, name: tag.name },
      })
      tagIdMapping[tag.id] = tag.id
    }
  }

  for (const tagSubtotalGroup of data.tagsData.tagSubtotalGroups) {
    const newTagId = tagIdMapping[tagSubtotalGroup.tagId]
    const newGroupId =
      idMappings.subtotalGroup[tagSubtotalGroup.subtotalGroupId]
    if (!newTagId || !newGroupId) continue

    const existing = await tx.tagSubtotalGroup.findFirst({
      where: { tagId: newTagId, subtotalGroupId: newGroupId },
    })
    if (existing) continue

    const existingById = await tx.tagSubtotalGroup.findUnique({
      where: { id: tagSubtotalGroup.id },
    })
    if (!existingById) {
      await tx.tagSubtotalGroup.create({
        data: {
          id: tagSubtotalGroup.id,
          tagId: newTagId,
          subtotalGroupId: newGroupId,
        },
      })
    }
  }

  // ExamTag処理
  const newExamId = idMappings.exam[data.examData.exam.id]
  if (newExamId) {
    for (const examTag of data.tagsData.examTags) {
      const newTagId = tagIdMapping[examTag.tagId]
      if (!newTagId) continue

      const existing = await tx.examTag.findFirst({
        where: { examId: newExamId, tagId: newTagId },
      })
      if (existing) continue

      const existingById = await tx.examTag.findUnique({
        where: { id: examTag.id },
      })
      if (!existingById) {
        await tx.examTag.create({
          data: {
            id: examTag.id,
            examId: newExamId,
            tagId: newTagId,
          },
        })
      }
    }
  }
}

export async function processExamClassrooms(
  data: ExtractedArchiveData,
  newExamId: string,
  idMappings: IdMappings,
  tx: PrismaTransaction
): Promise<void> {
  for (const examClassroom of data.examData.examClassrooms) {
    const newClassroomId = idMappings.classroom[examClassroom.classroomId]
    if (!newClassroomId) continue

    const existing = await tx.examClassroom.findFirst({
      where: { examId: newExamId, classroomId: newClassroomId },
    })
    if (existing) continue

    const existingById = await tx.examClassroom.findUnique({
      where: { id: examClassroom.id },
    })
    if (!existingById) {
      await tx.examClassroom.create({
        data: {
          id: examClassroom.id,
          examId: newExamId,
          classroomId: newClassroomId,
          administered: examClassroom.administered,
          // 旧フラグ(statistics/teacherStat)は変換チェーンが現行フラグへ移行済み
          teacherStatistics: examClassroom.teacherStatistics ?? false,
          studentReport: examClassroom.studentReport ?? false,
          order: examClassroom.order,
        },
      })
    }
  }
}

/**
 * OMR設定（CropRegionOmrConfig＋ChoiceOption＋DigitBox）を処理
 *
 * CropRegionが新規作成された場合のみ作成する。既存リージョンにマッチした場合は
 * 対象側に既にOMR設定が存在するため作成しない（重複防止）。
 * 子（ChoiceOption/DigitBox）は親configを新規作成したときだけ併せて作成する。
 */
export async function processOmrConfigs(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  tx: PrismaTransaction
): Promise<void> {
  for (const omrConfig of data.examData.omrConfigs ?? []) {
    const newCropRegionId = idMappings.cropRegion[omrConfig.cropRegionId]
    if (!newCropRegionId) continue

    // 対象リージョンに既にOMR設定があればスキップ（リージョンは1:1）
    const existingForRegion = await tx.cropRegionOmrConfig.findFirst({
      where: { cropRegionId: newCropRegionId },
    })
    if (existingForRegion) {
      idMappings.cropRegionOmrConfig[omrConfig.id] = existingForRegion.id
      continue
    }

    const existingById = await tx.cropRegionOmrConfig.findUnique({
      where: { id: omrConfig.id },
    })
    if (existingById) {
      idMappings.cropRegionOmrConfig[omrConfig.id] = omrConfig.id
      continue
    }

    await tx.cropRegionOmrConfig.create({
      data: {
        id: omrConfig.id,
        cropRegionId: newCropRegionId,
        type: omrConfig.type,
        numChoices: omrConfig.numChoices,
        choiceLayout: omrConfig.choiceLayout,
        numDigits: omrConfig.numDigits,
        correctAnswer: omrConfig.correctAnswer,
        colorThreshold: omrConfig.colorThreshold,
        areaThreshold: omrConfig.areaThreshold,
      },
    })
    idMappings.cropRegionOmrConfig[omrConfig.id] = omrConfig.id

    // 新規作成したconfig配下のChoiceOptionを作成
    for (const choiceOption of data.examData.omrChoiceOptions ?? []) {
      if (choiceOption.omrConfigId !== omrConfig.id) continue
      await tx.cropRegionOmrChoiceOption.create({
        data: {
          id: choiceOption.id,
          omrConfigId: omrConfig.id,
          choiceIndex: choiceOption.choiceIndex,
          label: choiceOption.label,
          isCorrect: choiceOption.isCorrect,
          shape: choiceOption.shape ?? null,
          normalizedCx: choiceOption.normalizedCx ?? null,
          normalizedCy: choiceOption.normalizedCy ?? null,
          normalizedWidth: choiceOption.normalizedWidth ?? null,
          normalizedHeight: choiceOption.normalizedHeight ?? null,
        },
      })
      idMappings.cropRegionOmrChoiceOption[choiceOption.id] = choiceOption.id
    }

    // 新規作成したconfig配下のDigitBoxを作成
    for (const digitBox of data.examData.omrDigitBoxes ?? []) {
      if (digitBox.omrConfigId !== omrConfig.id) continue
      await tx.cropRegionOmrDigitBox.create({
        data: {
          id: digitBox.id,
          omrConfigId: omrConfig.id,
          digitIndex: digitBox.digitIndex,
          normalizedX: digitBox.normalizedX,
          normalizedY: digitBox.normalizedY,
          normalizedW: digitBox.normalizedW,
          normalizedH: digitBox.normalizedH,
        },
      })
    }
  }
}

/**
 * 複合解答（CompoundAnswer＋Member）を処理
 *
 * ExamPageが新規作成された場合のみ作成する。既存（同一ID）があればスキップ。
 * Memberは親CompoundAnswerを新規作成したときだけ併せて作成する。
 */
export async function processCompoundAnswers(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  tx: PrismaTransaction
): Promise<void> {
  for (const compoundAnswer of data.examData.compoundAnswers ?? []) {
    const newExamPageId = idMappings.examPage[compoundAnswer.examPageId]
    if (!newExamPageId) continue

    const existingById = await tx.compoundAnswer.findUnique({
      where: { id: compoundAnswer.id },
    })
    if (existingById) {
      idMappings.compoundAnswer[compoundAnswer.id] = compoundAnswer.id
      continue
    }

    await tx.compoundAnswer.create({
      data: {
        id: compoundAnswer.id,
        examPageId: newExamPageId,
        label: compoundAnswer.label,
        answerFormat: compoundAnswer.answerFormat,
        correctAnswer: compoundAnswer.correctAnswer,
        points: compoundAnswer.points,
        orderIndex: compoundAnswer.orderIndex,
        alternativeAnswers: compoundAnswer.alternativeAnswers,
        requireReduced: compoundAnswer.requireReduced,
      },
    })
    idMappings.compoundAnswer[compoundAnswer.id] = compoundAnswer.id

    // 新規作成したCompoundAnswer配下のMemberを作成
    for (const compoundAnswerMember of data.examData.compoundAnswerMembers ??
      []) {
      if (compoundAnswerMember.compoundAnswerId !== compoundAnswer.id) continue
      const newCropRegionId =
        idMappings.cropRegion[compoundAnswerMember.cropRegionId]
      if (!newCropRegionId) continue
      await tx.compoundAnswerMember.create({
        data: {
          id: compoundAnswerMember.id,
          compoundAnswerId: compoundAnswer.id,
          cropRegionId: newCropRegionId,
          order: compoundAnswerMember.order,
          roleLabel: compoundAnswerMember.roleLabel,
          separator: compoundAnswerMember.separator,
        },
      })
      idMappings.compoundAnswerMember[compoundAnswerMember.id] =
        compoundAnswerMember.id
    }
  }
}
