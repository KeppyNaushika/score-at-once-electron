import { Prisma } from "@prisma/client"

import { diffFields, recordAuditLog } from "./auditLog"
import prisma from "./client"

const studentLabel = (student: {
  lastName: string
  firstName: string
}): string => `${student.lastName} ${student.firstName}`.trim()

type StudentWithMemberships = Prisma.StudentGetPayload<{
  include: {
    memberships: {
      include: {
        classroom: true
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
            classroom: true,
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
    const student = await prisma.student.create({
      data: studentData,
      include: {
        memberships: {
          include: {
            classroom: true,
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

    await recordAuditLog({
      action: "student.create",
      entityType: "Student",
      entityId: student.id,
      target: studentLabel(student),
    })

    return student
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
    const before = await prisma.student.findUnique({
      where: { id },
      select: {
        lastName: true,
        firstName: true,
        lastNameKana: true,
        firstNameKana: true,
        studentNumber: true,
        enrollmentYear: true,
      },
    })

    const student = await prisma.student.update({
      where: { id },
      data: studentData,
      include: {
        memberships: {
          include: {
            classroom: true,
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

    await recordAuditLog({
      action: "student.update",
      entityType: "Student",
      entityId: student.id,
      target: studentLabel(student),
      changes: diffFields(
        before ?? undefined,
        {
          lastName: student.lastName,
          firstName: student.firstName,
          lastNameKana: student.lastNameKana,
          firstNameKana: student.firstNameKana,
          studentNumber: student.studentNumber,
          enrollmentYear: student.enrollmentYear,
        },
        [
          { field: "lastName", label: "姓" },
          { field: "firstName", label: "名" },
          { field: "lastNameKana", label: "姓（かな）" },
          { field: "firstNameKana", label: "名（かな）" },
          { field: "studentNumber", label: "学籍番号" },
          { field: "enrollmentYear", label: "入学年度" },
        ]
      ),
    })

    return student
  } catch (error) {
    console.error("Failed to update student:", error)
    throw error
  }
}

/** 生徒を削除する */
export const deleteStudent = async (id: string): Promise<void> => {
  try {
    const before = await prisma.student.findUnique({
      where: { id },
      select: { lastName: true, firstName: true },
    })

    await prisma.student.delete({ where: { id } })

    await recordAuditLog({
      action: "student.delete",
      entityType: "Student",
      entityId: id,
      target: before ? studentLabel(before) : null,
    })
  } catch (error) {
    console.error("Failed to delete student:", error)
    throw error
  }
}

export interface SubtotalScoreResult {
  subtotalId: string
  subtotalName: string
  subtotalGroupId: string
  subtotalGroupName: string
  score: number
  maxScore: number
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
  subtotalScores: SubtotalScoreResult[]
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
                    cropSubtotals: {
                      where: { assignmentType: "QUESTION_ASSIGNMENT" },
                      include: {
                        subtotal: {
                          include: {
                            subtotalGroup: true,
                          },
                        },
                      },
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

    for (const examStudent of examStudents) {
      const exam = examStudent.exam
      let totalScore = 0
      let maxScore = 0
      let scoredCount = 0
      let totalQuestions = 0

      // 小計スコア集計用
      const subtotalMap = new Map<
        string,
        {
          subtotalName: string
          subtotalGroupId: string
          subtotalGroupName: string
          score: number
          maxScore: number
        }
      >()

      for (const page of exam.examPages) {
        for (const region of page.cropRegions) {
          totalQuestions++
          const regionPoints = region.points || 0
          maxScore += regionPoints

          const questionScoreRecord = region.questionScores[0]
          let questionScore = 0
          let isScored = false

          if (
            questionScoreRecord &&
            questionScoreRecord.status !== "unscored"
          ) {
            isScored = true
            scoredCount++
            if (questionScoreRecord.status === "correct") {
              questionScore = regionPoints
            } else if (
              questionScoreRecord.status === "partial" &&
              questionScoreRecord.partialScore
            ) {
              questionScore = Number(questionScoreRecord.partialScore)
            }
          }

          totalScore += questionScore

          // 小計への振り分け
          for (const cropSubtotal of region.cropSubtotals) {
            const sid = cropSubtotal.subtotal.id
            const existing = subtotalMap.get(sid)
            if (existing) {
              existing.maxScore += regionPoints
              if (isScored) existing.score += questionScore
            } else {
              subtotalMap.set(sid, {
                subtotalName: cropSubtotal.subtotal.name,
                subtotalGroupId: cropSubtotal.subtotal.subtotalGroup.id,
                subtotalGroupName: cropSubtotal.subtotal.subtotalGroup.name,
                score: isScored ? questionScore : 0,
                maxScore: regionPoints,
              })
            }
          }
        }
      }

      let status: "complete" | "partial" | "unscored" = "unscored"
      if (scoredCount === totalQuestions && totalQuestions > 0) {
        status = "complete"
      } else if (scoredCount > 0) {
        status = "partial"
      }

      const subtotalScores: SubtotalScoreResult[] = Array.from(
        subtotalMap.entries()
      ).map(([subtotalId, data]) => ({
        subtotalId,
        ...data,
      }))

      results.push({
        examId: exam.id,
        examName: exam.examName,
        examDate: exam.examDate,
        tags: exam.examTags.map((examTag) => examTag.tag.name),
        totalScore,
        maxScore,
        scoredCount,
        totalQuestions,
        status,
        subtotalScores,
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

export interface ClassStudentExamResult {
  studentId: string
  studentNumber: string
  studentName: string
  attendanceNumber: number | null
  examResults: StudentExamResult[]
}

/** 学級に所属する全生徒の試験成績を一括取得する */
export const getClassExamResults = async (
  classroomId: string
): Promise<ClassStudentExamResult[]> => {
  try {
    const memberships = await prisma.studentClassroomMembership.findMany({
      where: {
        classroomId,
        OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      },
      include: {
        student: true,
      },
      orderBy: [{ attendanceNumber: "asc" }, { student: { lastName: "asc" } }],
    })

    const results: ClassStudentExamResult[] = []

    for (const membership of memberships) {
      const examResults = await getStudentExamResults(membership.student.id)
      results.push({
        studentId: membership.student.id,
        studentNumber: membership.student.studentNumber,
        studentName: `${membership.student.lastName} ${membership.student.firstName}`,
        attendanceNumber: membership.attendanceNumber,
        examResults,
      })
    }

    return results
  } catch (error) {
    console.error("Failed to get class exam results:", error)
    throw error
  }
}

export { type StudentWithMemberships }
