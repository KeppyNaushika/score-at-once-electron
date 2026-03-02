import prisma from "./client"
// ExamStudentStatus enum は削除されたため、文字列として定義
type ExamStudentStatus = "PARTICIPATING" | "EXPECTED" | "ABSENT"

/**
 * 試験に関連する生徒を取得
 */
export async function getStudentsForExam(examId: string) {
  try {
    // 試験に参加している生徒を取得
    const examStudents = await prisma.examStudent.findMany({
      where: { examId },
      orderBy: [
        { customOrder: "asc" }, // カスタム順序を優先
        { student: { studentNumber: "asc" } }, // 学籍番号順をフォールバック
      ],
      include: {
        student: {
          include: {
            memberships: {
              include: {
                class: true,
              },
              // endDate制限を削除 - 過去の所属も含めて取得
              orderBy: {
                startDate: "desc",
              },
            },
          },
        },
      },
    })

    const studentsWithStatus = examStudents.map((examStudent) => ({
      ...examStudent.student,
      status: examStudent.status.toLowerCase() as
        | "participating"
        | "expected"
        | "absent",
      isInExam: true,
      customOrder: examStudent.customOrder,
    }))

    return {
      success: true,
      students: studentsWithStatus,
    }
  } catch (error) {
    console.error("Error fetching students for exam:", error)
    return {
      success: false,
      error: "Failed to fetch students for exam",
    }
  }
}

/**
 * 試験に生徒を追加
 */
export async function addStudentsToExam(examId: string, studentIds: string[]) {
  try {
    // 既に参加している生徒を除外
    const existingExamStudents = await prisma.examStudent.findMany({
      where: {
        examId,
        studentId: { in: studentIds },
      },
      select: { studentId: true },
    })

    const existingStudentIds = new Set(
      existingExamStudents.map((ps) => ps.studentId)
    )
    const newStudentIds = studentIds.filter((id) => !existingStudentIds.has(id))

    // 新しい生徒を試験に追加
    if (newStudentIds.length > 0) {
      const createData = newStudentIds.map((studentId) => ({
        examId,
        studentId,
        status: "PARTICIPATING",
      }))

      await prisma.examStudent.createMany({
        data: createData,
      })
    }
    return {
      success: true,
      addedCount: newStudentIds.length,
      skippedCount: studentIds.length - newStudentIds.length,
    }
  } catch (error) {
    console.error("Error adding students to exam:", error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to add students to exam",
    }
  }
}

/**
 * 試験から生徒を削除
 */
export async function removeStudentsFromExam(
  examId: string,
  studentIds: string[]
) {
  try {
    // 試験から生徒を削除
    await prisma.examStudent.deleteMany({
      where: {
        examId,
        studentId: { in: studentIds },
      },
    })

    // 関連するAnswerSheetを削除 (StudentAnswerImageから)
    await prisma.studentAnswerImage.deleteMany({
      where: {
        studentId: {
          in: studentIds,
        },
        examPage: {
          examId: examId,
        },
      },
    })

    return {
      success: true,
    }
  } catch (error) {
    console.error("Error removing students from exam:", error)
    return {
      success: false,
      error: "Failed to remove students from exam",
    }
  }
}

/**
 * 試験内での生徒の状態を更新
 */
export async function updateStudentExamStatus(
  examId: string,
  studentId: string,
  status: "participating" | "expected" | "absent"
) {
  try {
    // statusを大文字に変換してenumに合わせる
    const enumStatus = status.toUpperCase() as ExamStudentStatus

    await prisma.examStudent.updateMany({
      where: {
        examId,
        studentId,
      },
      data: {
        status: enumStatus,
      },
    })

    return {
      success: true,
    }
  } catch (error) {
    console.error("Error updating student exam status:", error)
    return {
      success: false,
      error: "Failed to update student exam status",
    }
  }
}

/**
 * 試験内での生徒の並び順を更新
 */
export async function updateStudentOrders(
  examId: string,
  studentOrders: { studentId: string; customOrder: number }[]
) {
  try {
    // 各生徒の並び順を更新
    for (const { studentId, customOrder } of studentOrders) {
      // customOrderが-1の場合はnullにリセット（デフォルト順序）
      const orderValue = customOrder === -1 ? null : customOrder

      await prisma.examStudent.updateMany({
        where: {
          examId,
          studentId,
        },
        data: {
          customOrder: orderValue,
        },
      })
    }

    return {
      success: true,
    }
  } catch (error) {
    console.error("Error updating student orders:", error)
    return {
      success: false,
      error: "Failed to update student orders",
    }
  }
}

/**
 * 試験に参加していない学級を取得
 */
export async function getClassesNotInExam(examId: string) {
  try {
    // 全ての学級を取得（所属期限を無視）
    const allClasses = await prisma.class.findMany({
      include: {
        memberships: {
          include: {
            student: true,
          },
          // endDate条件を削除 - 期限切れでも採点できるべき
        },
      },
    })

    // 試験に既に参加している生徒IDを取得
    const examStudents = await prisma.examStudent.findMany({
      where: { examId },
      select: { studentId: true },
    })
    const participatingStudentIds = new Set(
      examStudents.map((ps) => ps.studentId)
    )

    // 試験に参加していない学級を抽出
    const availableClasses = allClasses
      .map((cls) => {
        const allStudents = cls.memberships.map((m) => m.student)
        const nonParticipatingStudents = allStudents.filter(
          (student) => !participatingStudentIds.has(student.id)
        )

        return {
          ...cls,
          studentCount: nonParticipatingStudents.length,
        }
      })
      .filter((cls) => cls.studentCount > 0)

    return {
      success: true,
      classes: availableClasses,
    }
  } catch (error) {
    console.error("Error fetching classes not in exam:", error)
    return {
      success: false,
      error: "Failed to fetch available classes",
    }
  }
}

/**
 * 試験に参加していない生徒を取得（検索・フィルタ機能付き）
 */
export async function getStudentsNotInExam(examId: string) {
  try {
    // 試験に既に参加している生徒IDを取得
    const examStudents = await prisma.examStudent.findMany({
      where: { examId },
      select: { studentId: true },
    })
    const participatingStudentIds = new Set(
      examStudents.map((ps) => ps.studentId)
    )

    // 試験に参加していない生徒を取得
    const availableStudents = await prisma.student.findMany({
      where: {
        id: {
          notIn: Array.from(participatingStudentIds),
        },
      },
      include: {
        memberships: {
          include: {
            class: true,
          },
          orderBy: {
            startDate: "desc",
          },
        },
      },
    })

    return {
      success: true,
      students: availableStudents,
    }
  } catch (error) {
    console.error("Error fetching students not in exam:", error)
    return {
      success: false,
      error: "Failed to fetch available students",
    }
  }
}
