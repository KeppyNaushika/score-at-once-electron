import type { Prisma as PrismaTypes } from "@prisma/client"

import prisma from "./client"

// Exam一覧用の軽量クエリ（ステップ判定に必要な最小限のデータのみ取得）
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
      subject: true,
      description: true,
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

// Exam一覧を取得 (ユーザーでフィルタリング) - 詳細ページ用
export const getExams = async (userId: string) => {
  return prisma.exam.findMany({
    where: {
      userExams: {
        some: {
          userId,
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
          studentAnswerImages: {
            include: {
              student: true,
            },
          },
          cropRegions: {
            include: {
              questionScores: {
                include: {
                  student: true,
                  user: true,
                },
              },
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
              subtotals: true,
            },
          },
        },
      },
      examStudents: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  })
}

// getExams の戻り値の型
export type ExamPayload = PrismaTypes.PromiseReturnType<typeof getExams>[number]

// IDで単一のExamを取得 (詳細情報も含む)
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
            include: {
              questionScores: {
                include: {
                  student: true,
                  user: true,
                },
              },
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
    },
  })
}

// getExamById の戻り値の型
export type ExamWithDetailsPayload = PrismaTypes.PromiseReturnType<
  typeof getExamById
>

// Exam作成
export const createExam = async (
  data: Omit<PrismaTypes.ExamCreateInput, "userExams">,
  userId: string
) => {
  return prisma.exam.create({
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
    },
  })
}

// Exam更新
export const updateExam = async (
  id: string,
  data: PrismaTypes.ExamUpdateInput
) => {
  return prisma.exam.update({
    where: { id },
    data,
  })
}

// Exam削除
export const deleteExam = async (id: string) => {
  return prisma.exam.delete({
    where: { id },
  })
}
