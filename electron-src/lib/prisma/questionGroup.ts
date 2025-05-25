import type { Prisma, QuestionGroup } from "@prisma/client"
import prisma from "./client"

// QuestionGroup を作成
export const createQuestionGroup = async (
  data: Prisma.QuestionGroupUncheckedCreateInput, // projectId を直接含める
) => {
  return prisma.questionGroup.create({
    data,
    include: {
      items: true, // 作成後にアイテムも返す
    },
  })
}

// QuestionGroup を更新
export const updateQuestionGroup = async (
  id: string,
  data: Prisma.QuestionGroupUpdateInput,
) => {
  return prisma.questionGroup.update({
    where: { id },
    data,
    include: {
      items: true,
    },
  })
}

// QuestionGroup を削除
export const deleteQuestionGroup = async (id: string) => {
  // 関連する QuestionGroupItem, SubtotalDefinition, QuestionSubtotalAssignment も削除されるか確認
  // (onDelete: Cascade が設定されていれば自動)
  return prisma.questionGroup.delete({
    where: { id },
  })
}

// プロジェクトIDで QuestionGroup を取得
export const getQuestionGroupsByProjectId = async (projectId: string) => {
  return prisma.questionGroup.findMany({
    where: { projectId },
    include: {
      items: {
        orderBy: {
          // name や createdAt などでソート
          name: "asc",
        },
      },
      project: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  })
}

// IDで QuestionGroup を取得
export const getQuestionGroupById = async (id: string) => {
  return prisma.questionGroup.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: {
          name: "asc",
        },
      },
      project: true,
    },
  })
}

export type QuestionGroupWithItems = Prisma.QuestionGroupGetPayload<{
  include: {
    items: true
    project: true
  }
}>

export type QuestionGroupPayload = QuestionGroup
