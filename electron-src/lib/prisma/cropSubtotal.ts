import type { CropSubtotal, Prisma } from "@prisma/client"

import prisma from "./client"

/**
 * CropSubtotal の include 形状（SSOT）。メソッドごとに取得するリレーションが異なるため
 * 3種類を用意し、型（GetPayload）と実クエリの双方がこの const を参照する。
 */
export const cropSubtotalWithRegionAndSubtotalInclude = {
  cropRegion: true,
  subtotal: true,
} satisfies Prisma.CropSubtotalInclude

export const cropSubtotalWithSubtotalGroupInclude = {
  subtotal: {
    include: {
      subtotalGroup: true,
    },
  },
} satisfies Prisma.CropSubtotalInclude

export const cropSubtotalWithRegionPageInclude = {
  cropRegion: {
    include: {
      examPage: true,
    },
  },
} satisfies Prisma.CropSubtotalInclude

/** cropRegion・subtotal（いずれも浅い）を含む CropSubtotal（create の返り値） */
export type CropSubtotalWithRegionAndSubtotal = Prisma.CropSubtotalGetPayload<{
  include: typeof cropSubtotalWithRegionAndSubtotalInclude
}>

/** subtotal.subtotalGroup を含む CropSubtotal（getCropSubtotalsByCropRegionId の返り値） */
export type CropSubtotalWithSubtotalGroup = Prisma.CropSubtotalGetPayload<{
  include: typeof cropSubtotalWithSubtotalGroupInclude
}>

/** cropRegion.examPage を含む CropSubtotal（getCropSubtotalsBySubtotalId の返り値） */
export type CropSubtotalWithRegionPage = Prisma.CropSubtotalGetPayload<{
  include: typeof cropSubtotalWithRegionPageInclude
}>

/** 設問-小計紐付けを作成する（設問領域・小計項目の存在と試験での有効化を検証、cropRegion・subtotal リレーション含む） */
export const createCropSubtotal = async (
  data: Prisma.CropSubtotalUncheckedCreateInput
) => {
  // データ整合性チェック
  const cropRegion = await prisma.cropRegion.findUnique({
    where: { id: data.cropRegionId },
    include: {
      examPage: {
        select: { examId: true },
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
          examSubtotalGroups: {
            where: {
              examId: cropRegion.examPage.examId,
            },
          },
        },
      },
    },
  })

  if (!subtotal) {
    throw new Error("指定された小計項目が見つかりません")
  }

  // 小計項目が試験で有効化されているかチェック
  const isSubtotalActiveInExam =
    subtotal.subtotalGroup.examSubtotalGroups.length > 0

  if (!isSubtotalActiveInExam) {
    throw new Error(
      `小計項目「${subtotal.name}」（グループ：${subtotal.subtotalGroup.name}）は、この試験で有効化されていません。先に04-question-groupページで小計点グループを追加してください。`
    )
  }

  return prisma.cropSubtotal.create({
    data,
    include: cropSubtotalWithRegionAndSubtotalInclude,
  })
}

/** 複数の設問-小計紐付けを一括作成する（各項目のデータ整合性を検証） */
export const createManyCropSubtotals = async (
  data: Prisma.CropSubtotalUncheckedCreateInput[]
) => {
  // 各CropSubtotalについてデータ整合性をチェック
  for (const item of data) {
    const cropRegion = await prisma.cropRegion.findUnique({
      where: { id: item.cropRegionId },
      include: {
        examPage: {
          select: { examId: true },
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
            examSubtotalGroups: {
              where: {
                examId: cropRegion.examPage.examId,
              },
            },
          },
        },
      },
    })

    if (!subtotal) {
      throw new Error(`指定された小計項目が見つかりません: ${item.subtotalId}`)
    }

    // 小計項目が試験で有効化されているかチェック
    const isSubtotalActiveInExam =
      subtotal.subtotalGroup.examSubtotalGroups.length > 0

    if (!isSubtotalActiveInExam) {
      throw new Error(
        `小計項目「${subtotal.name}」（グループ：${subtotal.subtotalGroup.name}）は、この試験で有効化されていません。先に04-question-groupページで小計点グループを追加してください。`
      )
    }
  }

  return prisma.cropSubtotal.createMany({
    data,
  })
}

/** 設問-小計紐付けを更新する（cropRegion・subtotal リレーション含む） */
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

/** 設問-小計紐付けを削除する */
export const deleteCropSubtotal = async (id: string) => {
  return prisma.cropSubtotal.delete({
    where: { id },
  })
}

/** 指定した設問領域に紐づく全ての設問-小計紐付けを削除する */
export const deleteCropSubtotalsByCropRegionId = async (
  cropRegionId: string
) => {
  return prisma.cropSubtotal.deleteMany({
    where: { cropRegionId },
  })
}

/** 設問領域IDで設問-小計紐付けを取得する（subtotal.subtotalGroup リレーション含む） */
export const getCropSubtotalsByCropRegionId = async (cropRegionId: string) => {
  return prisma.cropSubtotal.findMany({
    where: { cropRegionId },
    include: cropSubtotalWithSubtotalGroupInclude,
  })
}

/** 小計項目IDで設問-小計紐付けを取得する（cropRegion.examPage リレーション含む） */
export const getCropSubtotalsBySubtotalId = async (subtotalId: string) => {
  return prisma.cropSubtotal.findMany({
    where: { subtotalId },
    include: cropSubtotalWithRegionPageInclude,
  })
}

/** 設問領域IDでSUBTOTAL_DEFINITION型の紐付けを取得する（旧SubtotalDefinition互換） */
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

/** 設問領域IDでQUESTION_ASSIGNMENT型の紐付けを取得する（旧QuestionSubtotalAssignment互換） */
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

/** IDで設問-小計紐付けを取得する（cropRegion.examPage・subtotal.subtotalGroup リレーション含む） */
export const getCropSubtotalById = async (id: string) => {
  return prisma.cropSubtotal.findUnique({
    where: { id },
    include: {
      cropRegion: {
        include: {
          examPage: true,
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

export type CropSubtotalWithRegionPageAndSubtotalGroup =
  Prisma.CropSubtotalGetPayload<{
    include: {
      cropRegion: {
        include: {
          examPage: true
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
        examPage: true
      }
    }
  }
}>

export type CropSubtotalPayload = CropSubtotal
