import type { ExamPage, Prisma } from "@prisma/client"

import { recordAuditLog } from "./auditLog"
import { resolveExamScope, resolveExamScopeByPage } from "./auditScope"
import prisma from "./client"

/** 試験ページを作成する（masterImages・studentAnswerImages・cropRegions リレーション含む） */
export const createExamPage = async (
  data: Prisma.ExamPageUncheckedCreateInput
) => {
  const page = await prisma.examPage.create({
    data,
    include: {
      masterImages: true,
      studentAnswerImages: true,
      cropRegions: true,
    },
  })

  const scope = await resolveExamScope(page.examId)
  await recordAuditLog({
    action: "exam.page.upload",
    entityType: "ExamPage",
    entityId: page.id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
  })

  return page
}

/** 複数の試験ページを一括作成する */
export const createManyExamPages = async (
  data: Prisma.ExamPageCreateManyInput[]
) => {
  const result = await prisma.examPage.createMany({
    data,
  })

  if (data.length > 0) {
    const scope = await resolveExamScope(data[0].examId)
    await recordAuditLog({
      action: "exam.page.upload",
      entityType: "ExamPage",
      entityId: data[0].examId,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      summary: `模範解答ページを${data.length}枚アップロードしました`,
      extra: { count: data.length },
    })
  }

  return result
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
  const scope = await resolveExamScopeByPage(id)

  // 関連する MasterImage, StudentAnswerImage, CropRegion も削除される（onDelete: Cascade 設定済み）
  const page = await prisma.examPage.delete({
    where: { id },
  })

  await recordAuditLog({
    action: "exam.page.delete",
    entityType: "ExamPage",
    entityId: id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
  })

  return page
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
