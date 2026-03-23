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
  return prisma.$transaction(async (tx) => {
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
      data: data.members.map((m) => ({
        compoundAnswerId: compoundAnswer.id,
        cropRegionId: m.cropRegionId,
        order: m.order,
        roleLabel: m.roleLabel ?? null,
        separator: m.separator ?? null,
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
}

/**
 * 複合回答を削除
 */
export async function deleteCompoundAnswer(id: string): Promise<void> {
  await prisma.compoundAnswer.delete({ where: { id } })
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
  return prisma.compoundAnswerScore.upsert({
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
}
