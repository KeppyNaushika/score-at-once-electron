import type { Prisma as PrismaTypes } from "@prisma/client"

import { diffFields, recordAuditLog } from "./auditLog"
import prisma from "./client"
import { examPageWithContentInclude } from "./examPage"

/** 試験一覧用の軽量クエリ（ステップ判定に必要な最小限のデータのみ取得、ユーザーでフィルタリング） */
export const getExamsForList = async (userId: string) => {
  return prisma.exam.findMany({
    where: {
      userExams: {
        some: {
          userId,
        },
      },
    },
    select: {
      id: true,
      examName: true,
      examDate: true,
      description: true,
      examTags: {
        select: {
          tag: {
            select: { id: true, name: true, color: true },
          },
        },
        orderBy: { tag: { order: "asc" } },
      },
      createdAt: true,
      updatedAt: true,
      examPages: {
        select: {
          id: true,
          studentAnswerImages: {
            select: { studentId: true },
          },
          cropRegions: {
            select: {
              type: true,
              questionScores: {
                select: {
                  status: true,
                  studentId: true,
                  partialScore: true,
                },
              },
            },
          },
        },
      },
      examSubtotalGroups: {
        select: { id: true },
      },
      examStudents: {
        select: { studentId: true, status: true },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })
}

// getExamsForList の戻り値の型
export type ExamForListPayload = Awaited<
  ReturnType<typeof getExamsForList>
>[number]

/** IDで試験を取得する（全リレーション含む: userExams・examPages・examSubtotalGroups・examStudents） */
export const getExamById = async (id: string) => {
  return prisma.exam.findUnique({
    where: { id },
    include: {
      userExams: {
        include: {
          user: true,
        },
      },
      examPages: {
        include: {
          masterImages: true,
          studentAnswerImages: {
            include: {
              student: true,
            },
          },
          cropRegions: {
            // 進捗計算は questionScores のスカラーのみ読むため student/user は join しない
            include: {
              questionScores: true,
            },
            orderBy: {
              orderIndex: "asc",
            },
          },
        },
        orderBy: {
          pageNumber: "asc",
        },
      },
      examSubtotalGroups: {
        include: {
          subtotalGroup: {
            include: {
              subtotals: {
                orderBy: {
                  order: "asc",
                },
              },
            },
          },
        },
      },
      examStudents: {
        include: {
          student: true,
        },
        orderBy: {
          customOrder: "asc",
        },
      },
      examTags: {
        select: {
          tag: {
            select: { id: true, name: true, color: true },
          },
        },
        orderBy: { tag: { order: "asc" } },
      },
    },
  })
}

// getExamById の戻り値の型
export type ExamWithRelationsPayload = Awaited<ReturnType<typeof getExamById>>

/** 試験の基本スカラーのみを取得する（リレーション無し・軽量）。編集/スカラー参照用途向け。 */
export const getExam = async (id: string) => {
  return prisma.exam.findUnique({ where: { id } })
}

/**
 * 試験スカラー + examPages（masterImages 含む）を1クエリで取得する。
 * 採点画面（07）がタイトル用 examName とページ画像を必要とする用途向け。
 */
export const getExamWithPages = async (id: string) => {
  return prisma.exam.findUnique({
    where: { id },
    include: {
      examPages: {
        include: examPageWithContentInclude,
        orderBy: { pageNumber: "asc" },
      },
    },
  })
}

/** 試験を作成し、指定ユーザーをOWNERとしてUserExamに登録する */
export const createExam = async (
  data: Omit<PrismaTypes.ExamCreateInput, "userExams">,
  userId: string
) => {
  const exam = await prisma.exam.create({
    data: {
      ...data,
      userExams: {
        create: {
          userId: userId,
          role: "OWNER",
        },
      },
    },
    include: {
      userExams: {
        include: {
          user: true,
        },
      },
      examPages: {
        include: {
          masterImages: true,
          studentAnswerImages: true,
          cropRegions: true,
        },
      },
      examSubtotalGroups: {
        include: {
          subtotalGroup: {
            include: {
              subtotals: true,
            },
          },
        },
      },
      examStudents: true,
      examTags: {
        select: {
          tag: {
            select: { id: true, name: true, color: true },
          },
        },
        orderBy: { tag: { order: "asc" } },
      },
    },
  })

  // 監査ログ（リファレンス計装）。失敗しても主操作は壊さない。
  await recordAuditLog({
    action: "exam.create",
    userId,
    entityType: "Exam",
    entityId: exam.id,
    scopeId: exam.id,
    scopeLabel: exam.examName,
    target: exam.examName,
  })

  return exam
}

/** 試験情報を更新する */
export const updateExam = async (
  id: string,
  data: PrismaTypes.ExamUpdateInput
) => {
  // 差分記録用に変更前を取得
  const before = await prisma.exam.findUnique({
    where: { id },
    select: { examName: true, examDate: true, description: true },
  })

  const exam = await prisma.exam.update({
    where: { id },
    data,
  })

  await recordAuditLog({
    action: "exam.update",
    entityType: "Exam",
    entityId: exam.id,
    scopeId: exam.id,
    scopeLabel: exam.examName,
    target: exam.examName,
    changes: diffFields(
      before ?? undefined,
      {
        examName: exam.examName,
        examDate: exam.examDate,
        description: exam.description,
      },
      [
        { field: "examName", label: "試験名" },
        { field: "examDate", label: "試験日" },
        { field: "description", label: "説明" },
      ]
    ),
  })

  return exam
}

/** 試験を削除する */
export const deleteExam = async (id: string) => {
  const before = await prisma.exam.findUnique({
    where: { id },
    select: { examName: true },
  })

  const exam = await prisma.exam.delete({
    where: { id },
  })

  await recordAuditLog({
    action: "exam.delete",
    entityType: "Exam",
    entityId: id,
    scopeId: id,
    scopeLabel: before?.examName ?? null,
    target: before?.examName ?? null,
  })

  return exam
}
