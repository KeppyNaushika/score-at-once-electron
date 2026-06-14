import type { CropSubtotal, Prisma } from "@prisma/client"

import { recordAuditLog } from "./auditLog"
import { resolveExamScopeByCropRegion } from "./auditScope"
import prisma from "./client"

/** 設問-小計マッピング変更を試験スコープで集約記録する */
async function recordSubtotalAssignmentAudit(cropRegionId: string) {
  const scope = await resolveExamScopeByCropRegion(cropRegionId)
  await recordAuditLog({
    action: "exam.subtotal_assignment.update",
    entityType: "CropSubtotal",
    entityId: scope.scopeId ?? cropRegionId,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    coalesceKey: `subtotal_assignment:${scope.scopeId ?? cropRegionId}`,
  })
}

/** 採点領域と小計項目の関連付け（CropSubtotal）を作成する（cropRegion・subtotal含む） */
export const createQuestionSubtotalAssignment = async (
  data: Prisma.CropSubtotalUncheckedCreateInput // cropRegionId と subtotalId を直接含める
) => {
  const result = await prisma.cropSubtotal.create({
    data,
    include: {
      cropRegion: true,
      subtotal: true,
    },
  })
  await recordSubtotalAssignmentAudit(data.cropRegionId)
  return result
}

/** 採点領域と小計項目の関連付けを一括作成する */
export const createManyQuestionSubtotalAssignments = async (
  assignments: Prisma.CropSubtotalUncheckedCreateInput[]
) => {
  const result = await prisma.cropSubtotal.createMany({
    data: assignments,
  })
  if (assignments.length > 0) {
    await recordSubtotalAssignmentAudit(assignments[0].cropRegionId)
  }
  return result
}

/** IDで採点領域と小計項目の関連付けを削除する */
export const deleteQuestionSubtotalAssignment = async (id: string) => {
  const before = await prisma.cropSubtotal.findUnique({
    where: { id },
    select: { cropRegionId: true },
  })
  const result = await prisma.cropSubtotal.delete({
    where: { id },
  })
  if (before) await recordSubtotalAssignmentAudit(before.cropRegionId)
  return result
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
