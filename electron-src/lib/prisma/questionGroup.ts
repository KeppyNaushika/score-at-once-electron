import type { Prisma, SubtotalGroup } from "@prisma/client"

import prisma from "./client"

// QuestionGroup を作成 (SubtotalGroup として実装)
export const createQuestionGroup = async (
  data: Prisma.SubtotalGroupUncheckedCreateInput
) => {
  return prisma.subtotalGroup.create({
    data,
    include: {
      subtotals: true, // 作成後にsubtotalsも返す
    },
  })
}

// QuestionGroup を更新
export const updateQuestionGroup = async (
  id: string,
  data: Prisma.SubtotalGroupUpdateInput
) => {
  return prisma.subtotalGroup.update({
    where: { id },
    data,
    include: {
      subtotals: true,
    },
  })
}

// QuestionGroup を削除
export const deleteQuestionGroup = async (id: string) => {
  // 関連する Subtotal, CropSubtotal も削除されるか確認
  // (onDelete: Cascade が設定されていれば自動)
  return prisma.subtotalGroup.delete({
    where: { id },
  })
}

// 試験IDで QuestionGroup を取得
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

// IDで QuestionGroup を取得
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

export type SubtotalGroupWithItems = {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
  items: Array<{
    id: string
    name: string
    maxScore: number
    order: number
    subtotalGroupId: string
    createdAt: Date
    updatedAt: Date
  }>
  exam?: {
    id: string
    name: string
    createdAt: Date
    updatedAt: Date
    tag?: string | null
  } | null
  examId?: string
}

export type QuestionGroupPayload = SubtotalGroup
