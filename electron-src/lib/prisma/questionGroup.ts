import type { Prisma } from "@prisma/client"

import { recordAuditLog } from "./auditLog"
import prisma from "./client"

/** 設問グループ（SubtotalGroup）を作成する（subtotals含む） */
export const createQuestionGroup = async (
  data: Prisma.SubtotalGroupUncheckedCreateInput
) => {
  const group = await prisma.subtotalGroup.create({
    data,
    include: {
      subtotals: true, // 作成後にsubtotalsも返す
    },
  })

  await recordAuditLog({
    action: "exam.question_group.create",
    entityType: "SubtotalGroup",
    entityId: group.id,
    target: group.name,
  })

  return group
}

/** 設問グループ（SubtotalGroup）を更新する（subtotals含む） */
export const updateQuestionGroup = async (
  id: string,
  data: Prisma.SubtotalGroupUpdateInput
) => {
  const group = await prisma.subtotalGroup.update({
    where: { id },
    data,
    include: {
      subtotals: true,
    },
  })

  await recordAuditLog({
    action: "exam.question_group.update",
    entityType: "SubtotalGroup",
    entityId: group.id,
    target: group.name,
  })

  return group
}

/** 設問グループ（SubtotalGroup）を削除する（関連Subtotalはカスケード削除） */
export const deleteQuestionGroup = async (id: string) => {
  const before = await prisma.subtotalGroup.findUnique({
    where: { id },
    select: { name: true },
  })

  // 関連する Subtotal, CropSubtotal も削除されるか確認
  // (onDelete: Cascade が設定されていれば自動)
  const deleted = await prisma.subtotalGroup.delete({
    where: { id },
  })

  await recordAuditLog({
    action: "exam.question_group.delete",
    entityType: "SubtotalGroup",
    entityId: id,
    target: before?.name ?? null,
  })

  return deleted
}

/** 試験IDで設問グループ一覧を取得する（ExamSubtotalGroup経由、subtotals含む） */
export const getQuestionGroupsByExamId = async (examId: string) => {
  // ExamSubtotalGroup経由でSubtotalGroupを取得
  const examSubtotalGroups = await prisma.examSubtotalGroup.findMany({
    where: { examId },
    include: {
      subtotalGroup: {
        include: {
          subtotals: {
            orderBy: {
              order: "asc",
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  })

  // SubtotalGroupのリストを返す（互換性のため）
  return examSubtotalGroups.map((psg) => ({
    ...psg.subtotalGroup,
    items: psg.subtotalGroup.subtotals, // 互換性のためitemsという名前でsubtotalsを公開
    examId, // 互換性のためexamIdを追加
  }))
}

/** IDで設問グループを取得する（subtotals・examSubtotalGroups含む） */
export const getQuestionGroupById = async (id: string) => {
  const subtotalGroup = await prisma.subtotalGroup.findUnique({
    where: { id },
    include: {
      subtotals: {
        orderBy: {
          order: "asc",
        },
      },
      examSubtotalGroups: {
        include: {
          exam: true,
        },
      },
    },
  })

  if (!subtotalGroup) {
    return null
  }

  // 互換性のためitems, examを含む形式で返す
  return {
    ...subtotalGroup,
    items: subtotalGroup.subtotals,
    exam: subtotalGroup.examSubtotalGroups[0]?.exam || null,
  }
}
