import type { Prisma, QuestionSubtotalAssignment } from "@prisma/client"
import prisma from "./client"

// QuestionSubtotalAssignment を作成
export const createQuestionSubtotalAssignment = async (
  data: Prisma.QuestionSubtotalAssignmentUncheckedCreateInput, // questionLayoutRegionId と questionGroupItemId を直接含める
) => {
  return prisma.questionSubtotalAssignment.create({
    data,
    include: {
      questionLayoutRegion: true,
      questionGroupItem: true,
    },
  })
}

// 複数の QuestionSubtotalAssignment を作成
export const createManyQuestionSubtotalAssignments = async (
  assignments: Prisma.QuestionSubtotalAssignmentUncheckedCreateInput[],
) => {
  return prisma.questionSubtotalAssignment.createMany({
    data: assignments,
  })
}

// QuestionSubtotalAssignment を削除 (IDで)
export const deleteQuestionSubtotalAssignment = async (id: string) => {
  return prisma.questionSubtotalAssignment.delete({
    where: { id },
  })
}

// LayoutRegion (問題解答領域) ID で QuestionSubtotalAssignment を削除
export const deleteAssignmentsByQuestionLayoutRegionId = async (
  questionLayoutRegionId: string,
) => {
  return prisma.questionSubtotalAssignment.deleteMany({
    where: { questionLayoutRegionId },
  })
}

// QuestionGroupItem ID で QuestionSubtotalAssignment を削除
export const deleteAssignmentsByQuestionGroupItemId = async (
  questionGroupItemId: string,
) => {
  return prisma.questionSubtotalAssignment.deleteMany({
    where: { questionGroupItemId },
  })
}

// LayoutRegion (問題解答領域) ID で QuestionSubtotalAssignment を取得
export const getAssignmentsByQuestionLayoutRegionId = async (
  questionLayoutRegionId: string,
) => {
  return prisma.questionSubtotalAssignment.findMany({
    where: { questionLayoutRegionId },
    include: {
      questionGroupItem: true,
    },
  })
}

// QuestionGroupItem ID で QuestionSubtotalAssignment を取得
export const getAssignmentsByQuestionGroupItemId = async (
  questionGroupItemId: string,
) => {
  return prisma.questionSubtotalAssignment.findMany({
    where: { questionGroupItemId },
    include: {
      questionLayoutRegion: true,
    },
  })
}

export type QuestionSubtotalAssignmentWithRelations =
  Prisma.QuestionSubtotalAssignmentGetPayload<{
    include: {
      questionLayoutRegion: true
      questionGroupItem: true
    }
  }>

export type QuestionSubtotalAssignmentPayload = QuestionSubtotalAssignment
