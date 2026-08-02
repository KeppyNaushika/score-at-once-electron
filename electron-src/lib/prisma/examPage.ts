import type { Prisma } from "@prisma/client"

import { recordAuditLog } from "./auditLog"
import { resolveExamScope } from "./auditScope"
import prisma from "./client"

/**
 * getExamPagesByExamId / getExamPageById の include 形状（SSOT）。
 * 型（GetPayload）と実クエリの双方がこの const を参照する。
 */
export const examPageWithContentInclude = {
  studentAnswerImages: {
    include: {
      examStudent: { include: { student: true } },
    },
  },
  cropRegions: true,
} satisfies Prisma.ExamPageInclude

/** studentAnswerImages.examStudent.student・cropRegions を含む ExamPage */
export type ExamPageWithContent = Prisma.ExamPageGetPayload<{
  include: typeof examPageWithContentInclude
}>

/** 試験ページを作成する（studentAnswerImages・cropRegions リレーション含む） */
export const createExamPage = async (
  data: Prisma.ExamPageUncheckedCreateInput
) => {
  const page = await prisma.examPage.create({
    data,
    include: {
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

/**
 * 試験IDで全ページを取得する（studentAnswerImages.examStudent.student・cropRegions
 * リレーション含む、ページ番号順）。
 *
 * pageNumber は一意ではない（sync 構成では2台が同時に追加すると同じ番号の行が別 id で
 * 並ぶ。防ぐ手立ては無い ── 詳細は studentAnswer/crud.ts の getStudentAnswersDataset）。
 * タイブレークを入れないと 01-upload のページ一覧が読み込みのたびに入れ替わるため、
 * id で並びを決定的にする。
 */
export const getExamPagesByExamId = async (examId: string) => {
  return prisma.examPage.findMany({
    where: { examId },
    include: examPageWithContentInclude,
    orderBy: [{ pageNumber: "asc" }, { id: "asc" }],
  })
}
