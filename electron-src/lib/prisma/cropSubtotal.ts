import type { Prisma, CropSubtotal } from "@prisma/client"
import prisma from "./client"

// CropSubtotal を作成
export const createCropSubtotal = async (
  data: Prisma.CropSubtotalUncheckedCreateInput,
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
export const createManyCropSubtotals = async (
  data: Prisma.CropSubtotalUncheckedCreateInput[],
) => {
  return prisma.cropSubtotal.createMany({
    data,
  })
}

// CropSubtotal を更新
export const updateCropSubtotal = async (
  id: string,
  data: Prisma.CropSubtotalUpdateInput,
) => {
  return prisma.cropSubtotal.update({
    where: { id },
    data,
    include: {
      cropRegion: true,
      subtotal: true,
    },
  })
}

// CropSubtotal を削除
export const deleteCropSubtotal = async (id: string) => {
  return prisma.cropSubtotal.delete({
    where: { id },
  })
}

// CropRegion ID で CropSubtotal を取得
export const getCropSubtotalsByCropRegionId = async (cropRegionId: string) => {
  return prisma.cropSubtotal.findMany({
    where: { cropRegionId },
    include: {
      subtotal: {
        include: {
          subtotalGroup: true,
        },
      },
    },
  })
}

// Subtotal ID で CropSubtotal を取得
export const getCropSubtotalsBySubtotalId = async (subtotalId: string) => {
  return prisma.cropSubtotal.findMany({
    where: { subtotalId },
    include: {
      cropRegion: {
        include: {
          projectPage: true,
        },
      },
    },
  })
}

// CropRegion ID とassignmentTypeで CropSubtotal を取得（旧SubtotalDefinition互換）
export const getSubtotalDefinitionsByCropRegionId = async (cropRegionId: string) => {
  return prisma.cropSubtotal.findMany({
    where: { 
      cropRegionId,
      assignmentType: 'SUBTOTAL_DEFINITION'
    },
    include: {
      subtotal: {
        include: {
          subtotalGroup: true,
        },
      },
    },
  })
}

// CropRegion ID とassignmentTypeで CropSubtotal を取得（旧QuestionSubtotalAssignment互換）
export const getQuestionSubtotalAssignmentsByCropRegionId = async (cropRegionId: string) => {
  return prisma.cropSubtotal.findMany({
    where: { 
      cropRegionId,
      assignmentType: 'QUESTION_ASSIGNMENT'
    },
    include: {
      subtotal: {
        include: {
          subtotalGroup: true,
        },
      },
    },
  })
}

// IDで CropSubtotal を取得
export const getCropSubtotalById = async (id: string) => {
  return prisma.cropSubtotal.findUnique({
    where: { id },
    include: {
      cropRegion: {
        include: {
          projectPage: true,
        },
      },
      subtotal: {
        include: {
          subtotalGroup: true,
        },
      },
    },
  })
}

export type CropSubtotalWithDetails = Prisma.CropSubtotalGetPayload<{
  include: {
    cropRegion: {
      include: {
        projectPage: true
      }
    }
    subtotal: {
      include: {
        subtotalGroup: true
      }
    }
  }
}>

export type CropSubtotalPayload = CropSubtotal

// 互換性のためのエイリアス関数
export const createSubtotalDefinition = createCropSubtotal
export const createQuestionSubtotalAssignment = createCropSubtotal
export const deleteSubtotalDefinition = deleteCropSubtotal
export const deleteQuestionSubtotalAssignment = deleteCropSubtotal