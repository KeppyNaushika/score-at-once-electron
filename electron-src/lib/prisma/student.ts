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

type ClassWithMemberships = Prisma.ClassGetPayload<{
  include: {
    memberships: {
      include: {
        student: true
      }
      where: {
        endDate: null // 現在所属中の学生のみ
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

/** 全学級を取得する（現在所属中の生徒メンバーシップ含む） */
export const fetchClasses = async (): Promise<ClassWithMemberships[]> => {
  try {
    return await prisma.class.findMany({
      include: {
        memberships: {
          include: {
            student: true,
          },
          where: {
            endDate: null, // 現在所属中の学生のみ
          },
        },
      },
    })
  } catch (error) {
    console.error("Failed to fetch classes:", error)
    throw error
  }
}

/** 学級を作成する（現在所属中のメンバーシップ含む） */
export const createClass = async (
  classData: Prisma.ClassCreateInput
): Promise<ClassWithMemberships> => {
  try {
    return await prisma.class.create({
      data: classData,
      include: {
        memberships: {
          include: {
            student: true,
          },
          where: {
            endDate: null,
          },
        },
      },
    })
  } catch (error) {
    console.error("Failed to create class:", error)
    throw error
  }
}

/** 学級情報を更新する（現在所属中のメンバーシップ含む） */
export const updateClass = async (
  id: string,
  classData: Prisma.ClassUpdateInput
): Promise<ClassWithMemberships> => {
  try {
    return await prisma.class.update({
      where: { id },
      data: classData,
      include: {
        memberships: {
          include: {
            student: true,
          },
          where: {
            endDate: null,
          },
        },
      },
    })
  } catch (error) {
    console.error("Failed to update class:", error)
    throw error
  }
}

/** 学級を削除する（現在所属中の生徒がいる場合はエラー） */
export const deleteClass = async (id: string): Promise<void> => {
  try {
    // Check if class has current students before deleting
    const classWithMemberships = await prisma.class.findUnique({
      where: { id },
      include: {
        memberships: {
          where: {
            endDate: null, // 現在所属中の学生をチェック
          },
        },
      },
    })

    if (classWithMemberships && classWithMemberships.memberships.length > 0) {
      throw new Error(
        "この学級には現在も所属している生徒がいるため削除できません。"
      )
    }

    await prisma.class.delete({ where: { id } })
  } catch (error) {
    console.error("Failed to delete class:", error)
    throw error
  }
}

export interface StudentExamResult {
  examId: string
  examName: string
  examDate: Date | null
  subject: string | null
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
        subject: exam.subject,
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

// Export the updated types
export { type ClassWithMemberships, type StudentWithMemberships }
