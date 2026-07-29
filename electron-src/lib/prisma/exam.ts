import type { Prisma as PrismaTypes } from "@prisma/client"
import * as fs from "fs/promises"

import { getExamDirectory } from "../dataManager"
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
            select: { examStudentId: true },
          },
          cropRegions: {
            select: {
              type: true,
              questionScores: {
                select: {
                  status: true,
                  examStudentId: true,
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
        // 進捗計算（renderer の getExamProgress）は受験者IDで答案・採点を突き合わせるので
        // id が要る。select で主キーを落とすとこの突き合わせが黙って全滅する。
        select: { id: true, status: true },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })
}

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
              examStudent: { include: { student: true } },
            },
          },
          cropRegions: {
            // 進捗計算は questionScores のスカラーのみ読むため examStudent/user は join しない
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
      // 試験削除時に参照を失う（examIdがSetNull・cropRegion経由はcascade削除）成績データソース
      gradeDataSources: {
        select: { id: true },
      },
    },
  })
}

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

/** 試験を削除する（DBレコードのcascade削除に加え、画像ファイルのディレクトリも削除する） */
export const deleteExam = async (id: string) => {
  const before = await prisma.exam.findUnique({
    where: { id },
    select: { examName: true },
  })

  const exam = await prisma.exam.delete({
    where: { id },
  })

  // 模範解答・答案の画像はDBのcascadeでは消えないため、試験ディレクトリごと削除する。
  // ファイル削除の失敗で試験削除自体を巻き戻さない（DBは既に削除済み）。
  try {
    await fs.rm(getExamDirectory(id), { recursive: true, force: true })
  } catch (fileError) {
    console.warn(`Failed to delete exam directory for ${id}:`, fileError)
  }

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
