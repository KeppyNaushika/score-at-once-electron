/**
 * CompoundAnswer CRUD操作
 * 複合回答（共通テスト数学の分数、SAT Grid-Inなど）の管理
 */

import type { CompoundAnswerScore, Prisma } from "@prisma/client"

import { recordAuditLog } from "./auditLog"
import { resolveExamScopeByPage } from "./auditScope"
import prisma from "./client"
import { assertCompoundAnswersInSameExam } from "./examScopeGuard"

/**
 * 複合回答の採点結果をupsert
 */
export async function upsertCompoundAnswerScore(data: {
  compoundAnswerId: string
  examStudentId: string
  userId: string
  recognizedAnswer?: string | null
  status: string
  partialScore?: Prisma.Decimal | null
}): Promise<CompoundAnswerScore> {
  // 複合回答と受験者が同じ試験のものであること（FK は片方ずつしか見ない）
  await assertCompoundAnswersInSameExam([
    {
      compoundAnswerId: data.compoundAnswerId,
      examStudentId: data.examStudentId,
    },
  ])

  const result = await prisma.compoundAnswerScore.upsert({
    where: {
      compoundAnswerId_examStudentId: {
        compoundAnswerId: data.compoundAnswerId,
        examStudentId: data.examStudentId,
      },
    },
    create: {
      compoundAnswerId: data.compoundAnswerId,
      examStudentId: data.examStudentId,
      userId: data.userId,
      recognizedAnswer: data.recognizedAnswer ?? null,
      status: data.status,
      partialScore: data.partialScore ?? null,
    },
    update: {
      userId: data.userId,
      recognizedAnswer: data.recognizedAnswer ?? null,
      status: data.status,
      partialScore: data.partialScore ?? null,
    },
  })

  // 採点（複合解答）。同じ複合解答×操作者の連続採点を集約する。
  const compoundAnswer = await prisma.compoundAnswer.findUnique({
    where: { id: data.compoundAnswerId },
    select: { examPageId: true },
  })
  const scope = compoundAnswer
    ? await resolveExamScopeByPage(compoundAnswer.examPageId)
    : { scopeId: null, scopeLabel: null }
  await recordAuditLog({
    action: "exam.compound_answer.update",
    userId: data.userId,
    entityType: "CompoundAnswerScore",
    entityId: result.id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    summary: "複合解答を採点しました",
    coalesceKey: `compound_score:${data.compoundAnswerId}:${data.userId}`,
  })

  return result
}
