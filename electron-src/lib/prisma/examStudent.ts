import type { ConfirmedDeletionCount } from "@/types/deletionConfirmation.types"
import {
  type ExamStudentStatus,
  toExamStudentStatus,
} from "@/types/examStudentStatus.types"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

import { recordAuditLog } from "./auditLog"
import { resolveExamScope, resolveStudentLabel } from "./auditScope"
import { getAvailableClassroomsForTarget } from "./availableClassrooms"
import { getAvailableStudentsForTarget } from "./availableStudents"
import prisma from "./client"
import { deleteAfterRecount } from "./deleteAfterRecount"
import { countExamStudentDeletionCounts } from "./gradingData"

/** Exam.referenceDate を在籍判定の基準日として取得（未設定なら null → 現在日時扱い） */
export async function getExamReferenceDate(
  examId: string
): Promise<Date | null> {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
  })
  return exam?.referenceDate ?? null
}

/**
 * 試験に関連する生徒を取得
 */
export async function getStudentsForExam(examId: string) {
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
        },
      },
      // 答案は ExamStudent の子なので、この試験の分がそのまま得られる。
      // 行のまま渡し切り、枚数は renderer が `.length` で取る
      studentAnswerImages: true,
    },
  })

  // ExamStudent をそのまま返し、status のみ ExamStudentStatus へ narrowing する。
  // 生徒識別・学級所属・答案は examStudent.student(.memberships) / .studentAnswerImages 配下に
  // Prisma スキーマのまま保持する（フラットな畳み込みはしない）。
  const examStudentsWithMemberships: ExamStudentWithMemberships[] =
    examStudents.map((examStudent) => ({
      ...examStudent,
      status: toExamStudentStatus(examStudent.status),
    }))

  return examStudentsWithMemberships
}

/**
 * 試験に生徒を追加
 */
export async function addStudentsToExam(examId: string, studentIds: string[]) {
  // 既に参加している生徒を除外
  const existingExamStudents = await prisma.examStudent.findMany({
    where: {
      examId,
      studentId: { in: studentIds },
    },
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
    addedCount: newStudentIds.length,
    skippedCount: studentIds.length - newStudentIds.length,
  }
}

/**
 * 試験から生徒を削除
 *
 * 答案画像・採点・確定・複合回答・返却スナップショットは ExamStudent の子なので、
 * この 1 回の deleteMany が DB の cascade でまとめて消す
 * （手書きで子テーブルを列挙すると、テーブルが増えたときに必ず取りこぼす）。
 *
 * @param confirmedCounts 利用者が確認ダイアログで見た採点データの件数。消す直前に
 *   数え直し、増えていれば削除を中止する（`deleteAfterRecount`）。
 */
export async function removeStudentsFromExam(
  examId: string,
  studentIds: string[],
  confirmedCounts: ConfirmedDeletionCount[]
) {
  await deleteAfterRecount({
    confirmedCounts,
    recount: (tx) => countExamStudentDeletionCounts(tx, examId, studentIds),
    remove: (tx) =>
      tx.examStudent.deleteMany({
        where: {
          examId,
          studentId: { in: studentIds },
        },
      }),
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
}

/**
 * 試験内での生徒の状態を更新
 */
export async function updateStudentExamStatus(
  examId: string,
  studentId: string,
  status: ExamStudentStatus
) {
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
}

/**
 * 試験内での生徒の並び順を更新
 */
export async function updateStudentOrders(
  examId: string,
  studentOrders: { studentId: string; customOrder: number }[]
) {
  // 各生徒の並び順を単一トランザクションで更新
  await prisma.$transaction(
    studentOrders.map(({ studentId, customOrder }) =>
      prisma.examStudent.updateMany({
        where: {
          examId,
          studentId,
        },
        data: {
          customOrder,
        },
      })
    )
  )

  const scope = await resolveExamScope(examId)
  await recordAuditLog({
    action: "exam.student.reorder",
    entityType: "ExamStudent",
    entityId: examId,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    coalesceKey: `student_reorder:${examId}`,
  })
}

/**
 * 試験に追加できる学級候補を取得
 *
 * 既に参加している生徒を除くと在籍が0名になる学級は候補に出さない。
 * @param activeOnly true なら基準日(referenceDate)時点で在籍中の生徒のみ候補にする（既定）。
 *   false なら過去所属も含めて候補にする。
 */
export async function getClassroomsNotInExam(
  examId: string,
  activeOnly = true
) {
  const referenceDate = await getExamReferenceDate(examId)
  const examStudents = await prisma.examStudent.findMany({
    where: { examId },
  })

  return getAvailableClassroomsForTarget({
    existingClassroomIds: [],
    excludeStudentIds: examStudents.map((examStudent) => examStudent.studentId),
    referenceDate,
    activeOnly,
  })
}

/**
 * 試験に追加できる生徒候補を取得（個別追加用）
 *
 * @param activeOnly true なら「終了していない所属が1件以上ある生徒」のみ（既定）。
 */
export async function getStudentsNotInExam(examId: string, activeOnly = true) {
  const referenceDate = await getExamReferenceDate(examId)
  const examStudents = await prisma.examStudent.findMany({
    where: { examId },
  })

  return getAvailableStudentsForTarget({
    excludeStudentIds: examStudents.map((examStudent) => examStudent.studentId),
    referenceDate,
    activeOnly,
  })
}
