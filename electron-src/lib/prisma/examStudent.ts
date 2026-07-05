import {
  type ExamStudentStatus,
  toExamStudentStatus,
} from "@/types/examStudentStatus.types"
import type { ExamStudentWithDetails } from "@/types/prismaExtensions"

import { recordAuditLog } from "./auditLog"
import { resolveExamScope, resolveStudentLabel } from "./auditScope"
import { getAvailableClassesForTarget } from "./availableClasses"
import { getAvailableStudentsForTarget } from "./availableStudents"
import prisma from "./client"

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
                classroom: true,
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

    // ExamStudent をそのまま返し、status のみ ExamStudentStatus へ narrowing する。
    // 生徒識別・学級所属・答案枚数は examStudent.student(.memberships / ._count) 配下に
    // Prisma スキーマのまま保持する（フラットな畳み込みはしない）。
    const examStudentsWithDetails: ExamStudentWithDetails[] = examStudents.map(
      (examStudent) => ({
        ...examStudent,
        status: toExamStudentStatus(examStudent.status),
      })
    )

    return {
      success: true,
      students: examStudentsWithDetails,
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
      existingExamStudents.map((examStudent) => examStudent.studentId)
    )
    const newStudentIds = studentIds.filter((id) => !existingStudentIds.has(id))

    // 新しい生徒を試験に追加
    if (newStudentIds.length > 0) {
      const createData = newStudentIds.map((studentId) => ({
        examId,
        studentId,
        status: "participating",
      }))

      await prisma.examStudent.createMany({
        data: createData,
      })

      // 監査ログ: 受験生徒の追加（追加分をまとめて1件）
      const scope = await resolveExamScope(examId)
      const firstLabel = await resolveStudentLabel(newStudentIds[0])
      const summary =
        newStudentIds.length === 1 && firstLabel
          ? `受験生徒「${firstLabel}」を追加しました`
          : `受験生徒を${newStudentIds.length}名追加しました`
      await recordAuditLog({
        action: "exam.student.add",
        entityType: "ExamStudent",
        entityId: examId,
        scopeId: scope.scopeId,
        scopeLabel: scope.scopeLabel,
        summary,
        extra: { studentIds: newStudentIds, count: newStudentIds.length },
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

    // 監査ログ: 受験生徒の削除
    const scope = await resolveExamScope(examId)
    const firstLabel = await resolveStudentLabel(studentIds[0])
    const summary =
      studentIds.length === 1 && firstLabel
        ? `受験生徒「${firstLabel}」を削除しました`
        : `受験生徒を${studentIds.length}名削除しました`
    await recordAuditLog({
      action: "exam.student.remove",
      entityType: "ExamStudent",
      entityId: examId,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      summary,
      extra: { studentIds, count: studentIds.length },
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
  status: ExamStudentStatus
) {
  try {
    await prisma.examStudent.updateMany({
      where: {
        examId,
        studentId,
      },
      data: {
        status,
      },
    })

    // 監査ログ: 受験状態の変更
    const scope = await resolveExamScope(examId)
    const studentLabel = await resolveStudentLabel(studentId)
    const statusJa: Record<string, string> = {
      participating: "受験",
      expected: "見込",
      absent: "欠席",
    }
    await recordAuditLog({
      action: "exam.student.attendance_update",
      entityType: "ExamStudent",
      entityId: examId,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      target: studentLabel,
      summary: studentLabel
        ? `「${studentLabel}」の受験状態を「${statusJa[status] ?? status}」に変更しました`
        : `受験状態を「${statusJa[status] ?? status}」に変更しました`,
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

    const scope = await resolveExamScope(examId)
    await recordAuditLog({
      action: "exam.student.reorder",
      entityType: "ExamStudent",
      entityId: examId,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      coalesceKey: `student_reorder:${examId}`,
    })

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
      excludeStudentIds: examStudents.map(
        (examStudent) => examStudent.studentId
      ),
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
      excludeStudentIds: examStudents.map(
        (examStudent) => examStudent.studentId
      ),
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
