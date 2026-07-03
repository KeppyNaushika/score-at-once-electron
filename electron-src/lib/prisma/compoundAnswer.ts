/**
 * CompoundAnswer CRUD操作
 * 複合回答（共通テスト数学の分数、SAT Grid-Inなど）の管理
 */

import type {
  CompoundAnswer,
  CompoundAnswerMember,
  CompoundAnswerScore,
  Prisma,
} from "@prisma/client"

import { recordAuditLog } from "./auditLog"
import { resolveExamScopeByPage } from "./auditScope"
import prisma from "./client"

export type CompoundAnswerWithMembers = CompoundAnswer & {
  members: (CompoundAnswerMember & {
    cropRegion: { id: string; label: string }
  })[]
}

export type CompoundAnswerWithAll = CompoundAnswerWithMembers & {
  scores: CompoundAnswerScore[]
}

export interface CreateCompoundAnswerData {
  examPageId: string
  label: string
  answerFormat: string
  correctAnswer: string
  points?: number
  orderIndex?: number
  alternativeAnswers?: string | null
  requireReduced?: boolean
  members: Array<{
    cropRegionId: string
    order: number
    roleLabel?: string | null
    separator?: string | null
  }>
}

/**
 * 複合回答を作成
 */
export async function createCompoundAnswer(
  data: CreateCompoundAnswerData
): Promise<CompoundAnswerWithMembers> {
  const result = await prisma.$transaction(async (tx) => {
    const compoundAnswer = await tx.compoundAnswer.create({
      data: {
        examPageId: data.examPageId,
        label: data.label,
        answerFormat: data.answerFormat,
        correctAnswer: data.correctAnswer,
        points: data.points ?? 0,
        orderIndex: data.orderIndex,
        alternativeAnswers: data.alternativeAnswers ?? null,
        requireReduced: data.requireReduced ?? false,
      },
    })

    await tx.compoundAnswerMember.createMany({
      data: data.members.map((member) => ({
        compoundAnswerId: compoundAnswer.id,
        cropRegionId: member.cropRegionId,
        order: member.order,
        roleLabel: member.roleLabel ?? null,
        separator: member.separator ?? null,
      })),
    })

    return tx.compoundAnswer.findUniqueOrThrow({
      where: { id: compoundAnswer.id },
      include: {
        members: {
          include: { cropRegion: { select: { id: true, label: true } } },
          orderBy: { order: "asc" },
        },
      },
    })
  })

  const scope = await resolveExamScopeByPage(data.examPageId)
  await recordAuditLog({
    action: "exam.compound_answer.update",
    entityType: "CompoundAnswer",
    entityId: result.id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    target: result.label,
  })

  return result
}

/**
 * 複合回答を削除
 */
export async function deleteCompoundAnswer(id: string): Promise<void> {
  const before = await prisma.compoundAnswer.findUnique({
    where: { id },
    select: { examPageId: true, label: true },
  })

  await prisma.compoundAnswer.delete({ where: { id } })

  if (before) {
    const scope = await resolveExamScopeByPage(before.examPageId)
    await recordAuditLog({
      action: "exam.compound_answer.update",
      entityType: "CompoundAnswer",
      entityId: id,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      summary: `複合解答「${before.label}」を削除しました`,
    })
  }
}

/**
 * 試験ページIDに紐づく複合回答を取得
 */
export async function getCompoundAnswersByExamPageId(
  examPageId: string
): Promise<CompoundAnswerWithMembers[]> {
  return prisma.compoundAnswer.findMany({
    where: { examPageId },
    include: {
      members: {
        include: { cropRegion: { select: { id: true, label: true } } },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { orderIndex: "asc" },
  })
}

/**
 * 試験IDに紐づく全複合回答を取得
 */
export async function getCompoundAnswersByExamId(
  examId: string
): Promise<CompoundAnswerWithMembers[]> {
  return prisma.compoundAnswer.findMany({
    where: { examPage: { examId } },
    include: {
      members: {
        include: { cropRegion: { select: { id: true, label: true } } },
        orderBy: { order: "asc" },
      },
    },
    orderBy: [{ examPage: { pageNumber: "asc" } }, { orderIndex: "asc" }],
  })
}

/**
 * 複合回答の採点結果をupsert
 */
export async function upsertCompoundAnswerScore(data: {
  compoundAnswerId: string
  studentId: string
  userId: string
  recognizedAnswer?: string | null
  status: string
  partialScore?: Prisma.Decimal | null
}): Promise<CompoundAnswerScore> {
  const result = await prisma.compoundAnswerScore.upsert({
    where: {
      compoundAnswerId_studentId: {
        compoundAnswerId: data.compoundAnswerId,
        studentId: data.studentId,
      },
    },
    create: {
      compoundAnswerId: data.compoundAnswerId,
      studentId: data.studentId,
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
