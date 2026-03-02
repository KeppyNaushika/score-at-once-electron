import type { ExamPage, Prisma } from "@prisma/client"

import prisma from "./client"

// ExamPage を作成
export const createExamPage = async (
  data: Prisma.ExamPageUncheckedCreateInput
) => {
  return prisma.examPage.create({
    data,
    include: {
      masterImages: true,
      studentAnswerImages: true,
      cropRegions: true,
    },
  })
}

// 複数の ExamPage を作成
export const createManyExamPages = async (
  data: Prisma.ExamPageCreateManyInput[]
) => {
  return prisma.examPage.createMany({
    data,
  })
}

// ExamPage を更新
export const updateExamPage = async (
  id: string,
  data: Prisma.ExamPageUpdateInput
) => {
  return prisma.examPage.update({
    where: { id },
    data,
    include: {
      masterImages: true,
      studentAnswerImages: true,
      cropRegions: true,
    },
  })
}

// ExamPage を削除
export const deleteExamPage = async (id: string) => {
  // 関連する MasterImage, StudentAnswerImage, CropRegion も削除される（onDelete: Cascade 設定済み）
  return prisma.examPage.delete({
    where: { id },
  })
}

// 試験IDで ExamPage を取得
export const getExamPagesByExamId = async (examId: string) => {
  return prisma.examPage.findMany({
    where: { examId },
    include: {
      masterImages: true,
      studentAnswerImages: {
        include: {
          student: true,
        },
      },
      cropRegions: true,
    },
    orderBy: { pageNumber: "asc" },
  })
}

// IDで ExamPage を取得
export const getExamPageById = async (id: string) => {
  return prisma.examPage.findUnique({
    where: { id },
    include: {
      masterImages: true,
      studentAnswerImages: {
        include: {
          student: true,
        },
      },
      cropRegions: true,
    },
  })
}

export type ExamPageWithDetails = Prisma.ExamPageGetPayload<{
  include: {
    masterImages: true
    studentAnswerImages: {
      include: {
        student: true
      }
    }
    cropRegions: true
  }
}>

export type ExamPagePayload = ExamPage
