import type { Prisma } from "@prisma/client"

import { recordAuditLog } from "./auditLog"
import { resolveExamScope } from "./auditScope"
import prisma from "./client"

/**
 * getExamPagesByExamId / getExamPageById の include 形状（SSOT）。
 * 型（GetPayload）と実クエリの双方がこの const を参照する。
 */
export const examPageWithContentInclude = {
  masterImages: true,
  studentAnswerImages: {
    include: {
      examStudent: { include: { student: true } },
    },
  },
  cropRegions: true,
} satisfies Prisma.ExamPageInclude

/** masterImages・studentAnswerImages.examStudent.student・cropRegions を含む ExamPage */
export type ExamPageWithContent = Prisma.ExamPageGetPayload<{
  include: typeof examPageWithContentInclude
}>

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

/** 試験IDで全ページを取得する（masterImages・studentAnswerImages.examStudent.student・cropRegions リレーション含む、ページ番号順） */
export const getExamPagesByExamId = async (examId: string) => {
  return prisma.examPage.findMany({
    where: { examId },
    include: examPageWithContentInclude,
    orderBy: { pageNumber: "asc" },
  })
}
