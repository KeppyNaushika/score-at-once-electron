import { getAvailableClassesForTarget } from "./availableClasses"
import { getAvailableStudentsForTarget } from "./availableStudents"
import prisma from "./client"
// ExamStudentStatus enum は削除されたため、文字列として定義
type ExamStudentStatus = "PARTICIPATING" | "EXPECTED" | "ABSENT"

/** Exam.examDate を在籍判定の基準日として取得（未設定なら null → 現在日時扱い） */
export async function getExamReferenceDate(
  examId: string
): Promise<Date | null> {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { examDate: true },
  })
  return exam?.examDate ?? null
}

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
            _count: {
              select: {
                studentAnswerImages: {
                  where: { examPage: { examId } },
                },
              },
            },
          },
        },
      },
    })

    const studentsWithStatus = examStudents.map((examStudent) => {
      const { _count, ...studentRest } = examStudent.student
      return {
        ...studentRest,
        status: examStudent.status.toLowerCase() as
          | "participating"
          | "expected"
          | "absent",
        isInExam: true,
        customOrder: examStudent.customOrder,
        answerSheetCount: _count.studentAnswerImages,
      }
    })

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
 * 試験に追加できる学級候補を取得
 *
 * 既に参加している生徒を除いた在籍生徒数で 0名学級を非表示にする。
 * @param activeOnly true なら基準日(examDate)時点で在籍中の生徒のみ数える（既定）。
 *   false なら過去所属も含めて数える。
 */
export async function getClassesNotInExam(examId: string, activeOnly = true) {
  try {
    const referenceDate = await getExamReferenceDate(examId)
    const examStudents = await prisma.examStudent.findMany({
      where: { examId },
      select: { studentId: true },
    })

    const classes = await getAvailableClassesForTarget({
      existingClassIds: [],
      excludeStudentIds: examStudents.map((ps) => ps.studentId),
      referenceDate,
      activeOnly,
    })

    return { success: true, classes }
  } catch (error) {
    console.error("Error fetching classes not in exam:", error)
    return {
      success: false,
      error: "Failed to fetch available classes",
    }
  }
}

/**
 * 試験に追加できる生徒候補を取得（個別追加用）
 *
 * @param activeOnly true なら「終了していない所属が1件以上ある生徒」のみ（既定）。
 */
export async function getStudentsNotInExam(examId: string, activeOnly = true) {
  try {
    const referenceDate = await getExamReferenceDate(examId)
    const examStudents = await prisma.examStudent.findMany({
      where: { examId },
      select: { studentId: true },
    })

    const students = await getAvailableStudentsForTarget({
      excludeStudentIds: examStudents.map((ps) => ps.studentId),
      referenceDate,
      activeOnly,
    })

    return { success: true, students }
  } catch (error) {
    console.error("Error fetching students not in exam:", error)
    return {
      success: false,
      error: "Failed to fetch available students",
    }
  }
}
