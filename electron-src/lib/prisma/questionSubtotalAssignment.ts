import type { CropSubtotal, Prisma } from "@prisma/client"

import prisma from "./client"

// CropSubtotal を作成 (QuestionSubtotalAssignment の新版)
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

// 複数の CropSubtotal を作成
export const createManyQuestionSubtotalAssignments = async (
  assignments: Prisma.CropSubtotalUncheckedCreateInput[]
) => {
  return prisma.cropSubtotal.createMany({
    data: assignments,
  })
}

// CropSubtotal を削除 (IDで)
export const deleteQuestionSubtotalAssignment = async (id: string) => {
  return prisma.cropSubtotal.delete({
    where: { id },
  })
}

// CropRegion ID で CropSubtotal を削除
export const deleteAssignmentsByQuestionLayoutRegionId = async (
  cropRegionId: string
) => {
  return prisma.cropSubtotal.deleteMany({
    where: { cropRegionId },
  })
}

// Subtotal ID で CropSubtotal を削除
export const deleteAssignmentsByQuestionGroupItemId = async (
  subtotalId: string
) => {
  return prisma.cropSubtotal.deleteMany({
    where: { subtotalId },
  })
}

// CropRegion ID で CropSubtotal を取得
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

// Subtotal ID で CropSubtotal を取得
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

export type QuestionSubtotalAssignmentWithRelations =
  Prisma.CropSubtotalGetPayload<{
    include: {
      cropRegion: true
      subtotal: true
    }
  }>

export type QuestionSubtotalAssignmentPayload = CropSubtotal
