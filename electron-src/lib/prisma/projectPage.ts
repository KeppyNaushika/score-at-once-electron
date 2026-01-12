import type { Prisma,ProjectPage } from "@prisma/client"

import prisma from "./client"

// ProjectPage を作成
export const createProjectPage = async (
  data: Prisma.ProjectPageUncheckedCreateInput
) => {
  return prisma.projectPage.create({
    data,
    include: {
      masterImages: true,
      studentAnswerImages: true,
      cropRegions: true,
    },
  })
}

// 複数の ProjectPage を作成
export const createManyProjectPages = async (
  data: Prisma.ProjectPageCreateManyInput[]
) => {
  return prisma.projectPage.createMany({
    data,
  })
}

// ProjectPage を更新
export const updateProjectPage = async (
  id: string,
  data: Prisma.ProjectPageUpdateInput
) => {
  return prisma.projectPage.update({
    where: { id },
    data,
    include: {
      masterImages: true,
      studentAnswerImages: true,
      cropRegions: true,
    },
  })
}

// ProjectPage を削除
export const deleteProjectPage = async (id: string) => {
  // 関連する MasterImage, StudentAnswerImage, CropRegion も削除される（onDelete: Cascade 設定済み）
  return prisma.projectPage.delete({
    where: { id },
  })
}

// プロジェクトIDで ProjectPage を取得
export const getProjectPagesByProjectId = async (projectId: string) => {
  return prisma.projectPage.findMany({
    where: { projectId },
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

// IDで ProjectPage を取得
export const getProjectPageById = async (id: string) => {
  return prisma.projectPage.findUnique({
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

export type ProjectPageWithDetails = Prisma.ProjectPageGetPayload<{
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

export type ProjectPagePayload = ProjectPage
