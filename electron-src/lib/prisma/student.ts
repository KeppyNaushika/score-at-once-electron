import { Prisma } from "@prisma/client"

import prisma from "./client"

type StudentWithMemberships = Prisma.StudentGetPayload<{
  include: {
    memberships: {
      include: {
        class: true
      }
      orderBy: {
        startDate: "desc"
      }
    }
  }
}>

/** 全生徒を取得する（学級メンバーシップ・クラス情報含む、現在・過去両方） */
export const fetchStudents = async (): Promise<StudentWithMemberships[]> => {
  try {
    const students = await prisma.student.findMany({
      include: {
        memberships: {
          include: {
            class: true,
          },
          // すべてのメンバーシップを取得（現在・過去両方）
          orderBy: {
            startDate: "desc",
          },
        },
      },
    })
    return students
  } catch (error) {
    console.error("Failed to fetch students:", error)
    throw error
  }
}

/** 生徒を作成する（現在有効なメンバーシップ含む） */
export const createStudent = async (
  studentData: Prisma.StudentCreateInput
): Promise<StudentWithMemberships> => {
  try {
    return await prisma.student.create({
      data: studentData,
      include: {
        memberships: {
          include: {
            class: true,
          },
          where: {
            endDate: null,
          },
          orderBy: {
            startDate: "desc",
          },
        },
      },
    })
  } catch (error) {
    console.error("Failed to create student:", error)
    throw error
  }
}

/** 生徒情報を更新する（現在有効なメンバーシップ含む） */
export const updateStudent = async (
  id: string,
  studentData: Prisma.StudentUpdateInput
): Promise<StudentWithMemberships> => {
  try {
    return await prisma.student.update({
      where: { id },
      data: studentData,
      include: {
        memberships: {
          include: {
            class: true,
          },
          where: {
            endDate: null,
          },
          orderBy: {
            startDate: "desc",
          },
        },
      },
    })
  } catch (error) {
    console.error("Failed to update student:", error)
    throw error
  }
}

/** 生徒を削除する */
export const deleteStudent = async (id: string): Promise<void> => {
  try {
    await prisma.student.delete({ where: { id } })
  } catch (error) {
    console.error("Failed to delete student:", error)
    throw error
  }
}

export interface StudentExamResult {
  examId: string
  examName: string
  examDate: Date | null
  tags: string[]
  totalScore: number
  maxScore: number
  scoredCount: number
  totalQuestions: number
  status: "complete" | "partial" | "unscored"
}

/** 生徒の全試験成績を取得する（得点・配点・採点状況を集計、試験日降順） */
export const getStudentExamResults = async (
  studentId: string
): Promise<StudentExamResult[]> => {
  try {
    // 生徒が参加している試験を取得
    const examStudents = await prisma.examStudent.findMany({
      where: { studentId },
      include: {
        exam: {
          include: {
            examTags: {
              select: {
                tag: {
                  select: { id: true, name: true },
                },
              },
            },
            examPages: {
              include: {
                cropRegions: {
                  where: { type: "QUESTION_ANSWER" },
                  include: {
                    questionScores: {
                      where: { studentId },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    const results: StudentExamResult[] = []

    for (const ps of examStudents) {
      const exam = ps.exam
      let totalScore = 0
      let maxScore = 0
      let scoredCount = 0
      let totalQuestions = 0

      for (const page of exam.examPages) {
        for (const region of page.cropRegions) {
          totalQuestions++
          maxScore += region.points || 0

          const score = region.questionScores[0]
          if (score && score.status !== "unscored") {
            scoredCount++
            if (score.status === "correct") {
              totalScore += region.points || 0
            } else if (score.status === "partial" && score.partialScore) {
              totalScore += Number(score.partialScore)
            }
            // incorrect の場合は 0 点
          }
        }
      }

      let status: "complete" | "partial" | "unscored" = "unscored"
      if (scoredCount === totalQuestions && totalQuestions > 0) {
        status = "complete"
      } else if (scoredCount > 0) {
        status = "partial"
      }

      results.push({
        examId: exam.id,
        examName: exam.examName,
        examDate: exam.examDate,
        tags: exam.examTags.map((et) => et.tag.name),
        totalScore,
        maxScore,
        scoredCount,
        totalQuestions,
        status,
      })
    }

    // 試験日の降順でソート
    results.sort((a, b) => {
      if (!a.examDate && !b.examDate) return 0
      if (!a.examDate) return 1
      if (!b.examDate) return -1
      return new Date(b.examDate).getTime() - new Date(a.examDate).getTime()
    })

    return results
  } catch (error) {
    console.error("Failed to get student exam results:", error)
    throw error
  }
}

export { type StudentWithMemberships }
