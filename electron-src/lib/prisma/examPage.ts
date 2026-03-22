import type { ExamPage, Prisma } from "@prisma/client"

import prisma from "./client"

/** 試験ページを作成する（masterImages・studentAnswerImages・cropRegions リレーション含む） */
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

/** 複数の試験ページを一括作成する */
export const createManyExamPages = async (
  data: Prisma.ExamPageCreateManyInput[]
) => {
  return prisma.examPage.createMany({
    data,
  })
}

/** 試験ページを更新する（masterImages・studentAnswerImages・cropRegions リレーション含む） */
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

/** 試験ページを削除する（関連するMasterImage・StudentAnswerImage・CropRegionもCascade削除） */
export const deleteExamPage = async (id: string) => {
  // 関連する MasterImage, StudentAnswerImage, CropRegion も削除される（onDelete: Cascade 設定済み）
  return prisma.examPage.delete({
    where: { id },
  })
}

/** 試験IDで全ページを取得する（masterImages・studentAnswerImages.student・cropRegions リレーション含む、ページ番号順） */
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

/** IDで試験ページを取得する（masterImages・studentAnswerImages.student・cropRegions リレーション含む） */
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
