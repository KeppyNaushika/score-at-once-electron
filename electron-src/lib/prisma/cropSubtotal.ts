import type { CropSubtotal,Prisma } from "@prisma/client"

import prisma from "./client"

// CropSubtotal を作成
export const createCropSubtotal = async (
  data: Prisma.CropSubtotalUncheckedCreateInput
) => {
  // データ整合性チェック
  const cropRegion = await prisma.cropRegion.findUnique({
    where: { id: data.cropRegionId },
    include: {
      projectPage: {
        select: { projectId: true },
      },
    },
  })

  if (!cropRegion) {
    throw new Error("指定された設問領域が見つかりません")
  }

  const subtotal = await prisma.subtotal.findUnique({
    where: { id: data.subtotalId },
    include: {
      subtotalGroup: {
        include: {
          projectSubtotalGroups: {
            where: {
              projectId: cropRegion.projectPage.projectId,
            },
          },
        },
      },
    },
  })

  if (!subtotal) {
    throw new Error("指定された小計項目が見つかりません")
  }

  // 小計項目がプロジェクトで有効化されているかチェック
  const isSubtotalActiveInProject =
    subtotal.subtotalGroup.projectSubtotalGroups.length > 0

  if (!isSubtotalActiveInProject) {
    throw new Error(
      `小計項目「${subtotal.name}」（グループ：${subtotal.subtotalGroup.name}）は、このプロジェクトで有効化されていません。先に04-question-groupページで小計点グループを追加してください。`
    )
  }

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
  data: Prisma.CropSubtotalUncheckedCreateInput[]
) => {
  // 各CropSubtotalについてデータ整合性をチェック
  for (const item of data) {
    const cropRegion = await prisma.cropRegion.findUnique({
      where: { id: item.cropRegionId },
      include: {
        projectPage: {
          select: { projectId: true },
        },
      },
    })

    if (!cropRegion) {
      throw new Error(
        `指定された設問領域が見つかりません: ${item.cropRegionId}`
      )
    }

    const subtotal = await prisma.subtotal.findUnique({
      where: { id: item.subtotalId },
      include: {
        subtotalGroup: {
          include: {
            projectSubtotalGroups: {
              where: {
                projectId: cropRegion.projectPage.projectId,
              },
            },
          },
        },
      },
    })

    if (!subtotal) {
      throw new Error(`指定された小計項目が見つかりません: ${item.subtotalId}`)
    }

    // 小計項目がプロジェクトで有効化されているかチェック
    const isSubtotalActiveInProject =
      subtotal.subtotalGroup.projectSubtotalGroups.length > 0

    if (!isSubtotalActiveInProject) {
      throw new Error(
        `小計項目「${subtotal.name}」（グループ：${subtotal.subtotalGroup.name}）は、このプロジェクトで有効化されていません。先に04-question-groupページで小計点グループを追加してください。`
      )
    }
  }

  return prisma.cropSubtotal.createMany({
    data,
  })
}

// CropSubtotal を更新
export const updateCropSubtotal = async (
  id: string,
  data: Prisma.CropSubtotalUpdateInput
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

// CropRegion ID で CropSubtotal をすべて削除
export const deleteCropSubtotalsByCropRegionId = async (
  cropRegionId: string
) => {
  return prisma.cropSubtotal.deleteMany({
    where: { cropRegionId },
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
export const getSubtotalDefinitionsByCropRegionId = async (
  cropRegionId: string
) => {
  return prisma.cropSubtotal.findMany({
    where: {
      cropRegionId,
      assignmentType: "SUBTOTAL_DEFINITION",
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
export const getQuestionSubtotalAssignmentsByCropRegionId = async (
  cropRegionId: string
) => {
  return prisma.cropSubtotal.findMany({
    where: {
      cropRegionId,
      assignmentType: "QUESTION_ASSIGNMENT",
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

/** getCropSubtotalsByCropRegionIdの戻り値型 */
export type CropSubtotalWithSubtotal = Prisma.CropSubtotalGetPayload<{
  include: {
    subtotal: {
      include: {
        subtotalGroup: true
      }
    }
  }
}>

/** getCropSubtotalsBySubtotalIdの戻り値型 */
export type CropSubtotalWithCropRegion = Prisma.CropSubtotalGetPayload<{
  include: {
    cropRegion: {
      include: {
        projectPage: true
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
