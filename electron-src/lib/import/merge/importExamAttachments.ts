/**
 * ID統合インポート: 試験に付随する各種データの処理
 *
 * - 出力設定（重ね描きのスタイル・可視性・個人成績表の設定/節/グラフ）
 * - CropRegionOmrConfig（＋ChoiceOption）（OMR設定）
 * - CompoundAnswer（＋Member）（複合解答の構造）
 * - Tag / TagSubtotalGroup / ExamTag（タグ）
 * - ExamClassroom（試験×学級の関連）
 *
 * いずれも親（試験・CropRegion・ExamPage）が新規作成/マッチした場合にのみ扱う。
 *
 * **値の扱いは importValuePolicy に一本化されている**（上書きする／統合する／別で追加する）。
 * 既にある行を置き換えるかどうかも、新しく作る行の時刻も、この規則だけで決まる。
 * かつては「既にあれば触らない」で一律にスキップしていたため、書き出した側で直した
 * 出力設定やOMRの閾値が、取り込んでも黙って古いままだった。
 */

import type { ExtractedArchiveData } from "../exam-archive/archiveExtractor"
import type { ImportValuePolicy } from "./importValuePolicy"
import { replacementUpdatedAt } from "./importValuePolicy"
import type { IdMappings, PrismaTransaction } from "./types"

/**
 * 出力設定（重ね描きのスタイル・可視性・個人成績表）を復元する。
 */
export async function processExamExportSettings(
  data: ExtractedArchiveData,
  newExamId: string,
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<void> {
  const examData = data.examData

  for (const style of examData.answerOverlayStyles ?? []) {
    const values = {
      position: style.position,
      anchor: style.anchor,
      offsetX: style.offsetX,
      offsetY: style.offsetY,
      size: style.size,
      color: style.color,
      opacity: style.opacity,
    }
    const existing = await tx.examAnswerOverlayStyle.findUnique({
      where: {
        examId_overlayKind: {
          examId: newExamId,
          overlayKind: style.overlayKind,
        },
      },
    })
    if (existing) {
      const updatedAt = replacementUpdatedAt(
        policy,
        style.updatedAt,
        existing.updatedAt
      )
      if (updatedAt) {
        await tx.examAnswerOverlayStyle.update({
          where: { id: existing.id },
          data: { ...values, updatedAt },
        })
      }
      continue
    }
    await tx.examAnswerOverlayStyle.create({
      data: {
        examId: newExamId,
        overlayKind: style.overlayKind,
        ...values,
        ...policy.createdTimestamps(style),
      },
    })
  }

  for (const visibility of examData.answerOverlayVisibilities ?? []) {
    const values = {
      showMark: visibility.showMark,
      showScore: visibility.showScore,
    }
    const existing = await tx.examAnswerOverlayVisibility.findUnique({
      where: {
        examId_status: { examId: newExamId, status: visibility.status },
      },
    })
    if (existing) {
      const updatedAt = replacementUpdatedAt(
        policy,
        visibility.updatedAt,
        existing.updatedAt
      )
      if (updatedAt) {
        await tx.examAnswerOverlayVisibility.update({
          where: { id: existing.id },
          data: { ...values, updatedAt },
        })
      }
      continue
    }
    await tx.examAnswerOverlayVisibility.create({
      data: {
        examId: newExamId,
        status: visibility.status,
        ...values,
        ...policy.createdTimestamps(visibility),
      },
    })
  }

  const reportSettings = examData.individualReportSettings
  if (reportSettings) {
    const {
      id: _id,
      examId: _examId,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...values
    } = reportSettings
    void _id
    void _examId
    void _createdAt
    void _updatedAt

    const existing = await tx.examIndividualReportSettings.findUnique({
      where: { examId: newExamId },
    })
    if (existing) {
      const updatedAt = replacementUpdatedAt(
        policy,
        reportSettings.updatedAt,
        existing.updatedAt
      )
      if (updatedAt) {
        await tx.examIndividualReportSettings.update({
          where: { id: existing.id },
          data: { ...values, updatedAt },
        })
      }
    } else {
      await tx.examIndividualReportSettings.create({
        data: {
          examId: newExamId,
          ...values,
          ...policy.createdTimestamps(reportSettings),
        },
      })
    }
  }

  for (const section of examData.individualReportTableSections ?? []) {
    const values = {
      enabled: section.enabled,
      columns: section.columns,
      fontSize: section.fontSize,
    }
    const existing = await tx.examIndividualReportTableSection.findUnique({
      where: {
        examId_tableKind: {
          examId: newExamId,
          tableKind: section.tableKind,
        },
      },
    })
    if (existing) {
      const updatedAt = replacementUpdatedAt(
        policy,
        section.updatedAt,
        existing.updatedAt
      )
      if (updatedAt) {
        await tx.examIndividualReportTableSection.update({
          where: { id: existing.id },
          data: { ...values, updatedAt },
        })
      }
      continue
    }
    await tx.examIndividualReportTableSection.create({
      data: {
        examId: newExamId,
        tableKind: section.tableKind,
        ...values,
        ...policy.createdTimestamps(section),
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
    if (existing) {
      const updatedAt = replacementUpdatedAt(
        policy,
        visibility.updatedAt,
        existing.updatedAt
      )
      if (updatedAt) {
        await tx.examIndividualReportStatisticVisibility.update({
          where: { id: existing.id },
          data: { shown: visibility.shown, updatedAt },
        })
      }
      continue
    }
    await tx.examIndividualReportStatisticVisibility.create({
      data: {
        examId: newExamId,
        statisticKind: visibility.statisticKind,
        scope: visibility.scope,
        shown: visibility.shown,
        ...policy.createdTimestamps(visibility),
      },
    })
  }

  const graphSettings = examData.individualReportGraphSettings
  if (graphSettings) {
    const {
      id: _id,
      examId: _examId,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...values
    } = graphSettings
    void _id
    void _examId
    void _createdAt
    void _updatedAt

    const existing = await tx.examIndividualReportGraphSettings.findUnique({
      where: { examId: newExamId },
    })
    if (existing) {
      const updatedAt = replacementUpdatedAt(
        policy,
        graphSettings.updatedAt,
        existing.updatedAt
      )
      if (updatedAt) {
        await tx.examIndividualReportGraphSettings.update({
          where: { id: existing.id },
          data: { ...values, updatedAt },
        })
      }
    } else {
      await tx.examIndividualReportGraphSettings.create({
        data: {
          examId: newExamId,
          ...values,
          ...policy.createdTimestamps(graphSettings),
        },
      })
    }
  }
}

export async function processTags(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  warnings: string[],
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<void> {
  if (!data.tagsData) return
  const tagIdMapping: Record<string, string> = {}

  for (const tag of data.tagsData.tags) {
    // タグは名前が同一性そのもの（同じ名前のタグを2つ持つ意味が無い）
    const existing =
      (await tx.tag.findUnique({ where: { name: tag.name } })) ??
      (await tx.tag.findUnique({ where: { id: tag.id } }))

    if (existing) {
      tagIdMapping[tag.id] = existing.id
      const updatedAt = replacementUpdatedAt(
        policy,
        tag.updatedAt,
        existing.updatedAt
      )
      if (updatedAt) {
        await tx.tag.update({
          where: { id: existing.id },
          data: {
            name: tag.name,
            // 表示順と色もタグの持ち物。旧アーカイブ（〜v1.10.0）は持たないので既定へ倒す
            order: tag.order ?? 0,
            color: tag.color ?? null,
            updatedAt,
          },
        })
      }
      continue
    }

    await tx.tag.create({
      data: {
        id: tag.id,
        name: tag.name,
        order: tag.order ?? 0,
        color: tag.color ?? null,
        ...policy.createdTimestamps(tag),
      },
    })
    tagIdMapping[tag.id] = tag.id
  }

  for (const tagSubtotalGroup of data.tagsData.tagSubtotalGroups) {
    const newTagId = tagIdMapping[tagSubtotalGroup.tagId]
    const newGroupId =
      idMappings.subtotalGroup[tagSubtotalGroup.subtotalGroupId]
    if (!newTagId || !newGroupId) continue

    // 結び付き自体に列が無いので、あれば何もしない（置き換える値が無い）
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
          ...policy.createdTimestamps(tagSubtotalGroup),
        },
      })
    }
  }

  // ExamTag処理
  const newExamId = idMappings.exam[data.examData.exam.id]
  if (newExamId) {
    // 指す先の Tag がアーカイブに無いタグ付けは作れない。**黙って捨てず数えて伝える** —
    // 書き出し側が tags を集め損ねていた頃、ここが警告なしに全件を落としていた
    let unresolvedTagIdCount = 0
    for (const examTag of data.tagsData.examTags) {
      const newTagId = tagIdMapping[examTag.tagId]
      if (!newTagId) {
        unresolvedTagIdCount++
        continue
      }

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
            ...policy.createdTimestamps(examTag),
          },
        })
      }
    }

    if (unresolvedTagIdCount > 0) {
      warnings.push(
        `${unresolvedTagIdCount}件のタグ付けを取り込めませんでした（アーカイブにタグ本体が含まれていません）。`
      )
    }
  }
}

export async function processExamClassrooms(
  data: ExtractedArchiveData,
  newExamId: string,
  idMappings: IdMappings,
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<{ createdCount: number }> {
  let createdCount = 0

  for (const examClassroom of data.examData.examClassrooms) {
    const newClassroomId = idMappings.classroom[examClassroom.classroomId]
    if (!newClassroomId) continue

    const values = {
      administered: examClassroom.administered,
      // 旧フラグ(statistics/teacherStat)は変換チェーンが現行フラグへ移行済み
      teacherStatistics: examClassroom.teacherStatistics ?? false,
      studentReport: examClassroom.studentReport ?? false,
      // 並び順は取り込みの最後に詰め直す（reorderAfterImport）
      order: examClassroom.order,
    }

    const existing =
      (await tx.examClassroom.findFirst({
        where: { examId: newExamId, classroomId: newClassroomId },
      })) ??
      (await tx.examClassroom.findUnique({ where: { id: examClassroom.id } }))

    if (existing) {
      const updatedAt = replacementUpdatedAt(
        policy,
        examClassroom.updatedAt,
        existing.updatedAt
      )
      if (updatedAt) {
        await tx.examClassroom.update({
          where: { id: existing.id },
          data: { ...values, updatedAt },
        })
      }
      continue
    }

    await tx.examClassroom.create({
      data: {
        id: examClassroom.id,
        examId: newExamId,
        classroomId: newClassroomId,
        ...values,
        ...policy.createdTimestamps(examClassroom),
      },
    })
    createdCount++
  }

  return { createdCount }
}

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
