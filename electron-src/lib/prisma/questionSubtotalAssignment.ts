import type { CropSubtotal, Prisma } from "@prisma/client"

import prisma from "./client"

/** 採点領域と小計項目の関連付け（CropSubtotal）を作成する（cropRegion・subtotal含む） */
export const createQuestionSubtotalAssignment = async (
  data: Prisma.CropSubtotalUncheckedCreateInput // cropRegionId と subtotalId を直接含める
) => {
  return prisma.cropSubtotal.create({
    data,
    include: {
      cropRegion: true,
      subtotal: true,
    },
  })
}

/** 採点領域と小計項目の関連付けを一括作成する */
export const createManyQuestionSubtotalAssignments = async (
  assignments: Prisma.CropSubtotalUncheckedCreateInput[]
) => {
  return prisma.cropSubtotal.createMany({
    data: assignments,
  })
}

/** IDで採点領域と小計項目の関連付けを削除する */
export const deleteQuestionSubtotalAssignment = async (id: string) => {
  return prisma.cropSubtotal.delete({
    where: { id },
  })
}

/** 採点領域IDに紐づく全ての小計関連付けを削除する */
export const deleteAssignmentsByQuestionLayoutRegionId = async (
  cropRegionId: string
) => {
  return prisma.cropSubtotal.deleteMany({
    where: { cropRegionId },
  })
}

/** 小計項目IDに紐づく全ての採点領域関連付けを削除する */
export const deleteAssignmentsByQuestionGroupItemId = async (
  subtotalId: string
) => {
  return prisma.cropSubtotal.deleteMany({
    where: { subtotalId },
  })
}

/** 採点領域IDで小計関連付け一覧を取得する（subtotal含む） */
export const getAssignmentsByQuestionLayoutRegionId = async (
  cropRegionId: string
) => {
  return prisma.cropSubtotal.findMany({
    where: { cropRegionId },
    include: {
      subtotal: true,
    },
  })
}

/** 小計項目IDで採点領域関連付け一覧を取得する（cropRegion含む） */
export const getAssignmentsByQuestionGroupItemId = async (
  subtotalId: string
) => {
  return prisma.cropSubtotal.findMany({
    where: { subtotalId },
    include: {
      cropRegion: true,
    },
  })
}

export type CropSubtotalWithRelations = Prisma.CropSubtotalGetPayload<{
  include: {
    cropRegion: true
    subtotal: true
  }
}>

export type QuestionSubtotalAssignmentPayload = CropSubtotal
