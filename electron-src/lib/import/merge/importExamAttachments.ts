/**
 * ID統合インポート: 試験に付随する各種データの処理
 *
 * - 出力設定（重ね描きのスタイル・可視性・個人成績表の設定/節/グラフ）
 * - CropRegionOmrConfig（＋ChoiceOption）（OMR設定）
 * - CompoundAnswer（＋Member）（複合解答の構造）
 * - Tag / TagSubtotalGroup / ExamTag（タグ）
 * - ExamClassroom（試験×学級の関連）
 *
 * いずれも親（試験・CropRegion・ExamPage）が新規作成/マッチした場合にのみ作成し、
 * 既存があれば重複を避けてスキップする。
 */

import type { ExtractedArchiveData } from "../exam-archive/archiveExtractor"
import type { IdMappings, PrismaTransaction } from "./types"

/**
 * 出力設定（重ね描きのスタイル・可視性・個人成績表）を復元する。
 * 既に設定がある試験へは入れない（取り込み先の設定を上書きしないため）。
 */
export async function processExamExportSettings(
  data: ExtractedArchiveData,
  newExamId: string,
  tx: PrismaTransaction
): Promise<void> {
  const examData = data.examData

  for (const style of examData.answerOverlayStyles ?? []) {
    const existing = await tx.examAnswerOverlayStyle.findUnique({
      where: {
        examId_overlayKind: {
          examId: newExamId,
          overlayKind: style.overlayKind,
        },
      },
    })
    if (existing) continue
    await tx.examAnswerOverlayStyle.create({
      data: {
        id: `${newExamId}:${style.overlayKind}`,
        examId: newExamId,
        overlayKind: style.overlayKind,
        position: style.position,
        anchor: style.anchor,
        offsetX: style.offsetX,
        offsetY: style.offsetY,
        size: style.size,
        color: style.color,
        opacity: style.opacity,
      },
    })
  }

  for (const visibility of examData.answerOverlayVisibilities ?? []) {
    const existing = await tx.examAnswerOverlayVisibility.findUnique({
      where: {
        examId_status: { examId: newExamId, status: visibility.status },
      },
    })
    if (existing) continue
    await tx.examAnswerOverlayVisibility.create({
      data: {
        id: `${newExamId}:${visibility.status}`,
        examId: newExamId,
        status: visibility.status,
        showMark: visibility.showMark,
        showScore: visibility.showScore,
      },
    })
  }

  const reportSettings = examData.individualReportSettings
  if (reportSettings) {
    const existing = await tx.examIndividualReportSettings.findUnique({
      where: { examId: newExamId },
    })
    if (!existing) {
      const {
        id: _id,
        examId: _examId,
        createdAt,
        updatedAt,
        ...values
      } = reportSettings
      void _id
      void _examId
      void createdAt
      void updatedAt
      await tx.examIndividualReportSettings.create({
        data: { id: newExamId, examId: newExamId, ...values },
      })
    }
  }

  for (const section of examData.individualReportTableSections ?? []) {
    const existing = await tx.examIndividualReportTableSection.findUnique({
      where: {
        examId_tableKind: {
          examId: newExamId,
          tableKind: section.tableKind,
        },
      },
    })
    if (existing) continue
    await tx.examIndividualReportTableSection.create({
      data: {
        id: `${newExamId}:${section.tableKind}`,
        examId: newExamId,
        tableKind: section.tableKind,
        enabled: section.enabled,
        columns: section.columns,
        fontSize: section.fontSize,
      },
    })
  }

  for (const visibility of examData.individualReportStatisticVisibilities ??
    []) {
    const existing =
      await tx.examIndividualReportStatisticVisibility.findUnique({
        where: {
          examId_statisticKind_scope: {
            examId: newExamId,
            statisticKind: visibility.statisticKind,
            scope: visibility.scope,
          },
        },
      })
    if (existing) continue
    await tx.examIndividualReportStatisticVisibility.create({
      data: {
        id: `${newExamId}:${visibility.statisticKind}:${visibility.scope}`,
        examId: newExamId,
        statisticKind: visibility.statisticKind,
        scope: visibility.scope,
        shown: visibility.shown,
      },
    })
  }

  const graphSettings = examData.individualReportGraphSettings
  if (graphSettings) {
    const existing = await tx.examIndividualReportGraphSettings.findUnique({
      where: { examId: newExamId },
    })
    if (!existing) {
      const {
        id: _id,
        examId: _examId,
        createdAt,
        updatedAt,
        ...values
      } = graphSettings
      void _id
      void _examId
      void createdAt
      void updatedAt
      await tx.examIndividualReportGraphSettings.create({
        data: { id: newExamId, examId: newExamId, ...values },
      })
    }
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
 * OMR設定（CropRegionOmrConfig＋ChoiceOption）を処理
 *
 * CropRegionが新規作成された場合のみ作成する。既存リージョンにマッチした場合は
 * 対象側に既にOMR設定が存在するため作成しない（重複防止）。
 * 子（ChoiceOption）は親configを新規作成したときだけ併せて作成する。
 *
 * 選択式以外（廃止した手書き数字）の設定は取り込まない。
 */
export async function processOmrConfigs(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  tx: PrismaTransaction
): Promise<void> {
  for (const omrConfig of data.examData.omrConfigs ?? []) {
    if (omrConfig.type !== "choice") continue

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
