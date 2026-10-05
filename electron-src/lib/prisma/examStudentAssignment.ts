/**
 * 受験生徒ごとの採点担当（docs/scoring-scope-and-permissions-design.md §3-1）。
 *
 * 設問ごとの担当（`cropRegionAssignment.ts`）と対等な軸で、採点画面で見える答案は
 * 「自分の設問 × 自分の生徒」になる。担当は権限拒否ではなく選択肢の定義なので、
 * バックエンドで採点そのものを拒否はしない。担当0人の生徒は全員担当とみなす
 * （絞り込みの規則は renderer の `useAssignedExamStudents` が持つ）。
 *
 * 学級は担当の鍵にしない。学級から割り当てるときも、renderer がその時点の生徒を
 * 選んでここへ渡し、生徒の行として焼き込む。
 */
import { recordAuditLog } from "./auditLog"
import {
  resolveExamScope,
  resolveExamStudentTargets,
  resolveUserLabel,
} from "./auditScope"
import prisma from "./client"
import { canManageAssignments } from "./cropRegionAssignment"

/**
 * 試験の受験生徒の担当割当を取得する。
 *
 * **現在この試験のメンバーである担当者に限る**（設問側と同じ。外れたメンバーを担当として
 * 数えると「担当が居るのに誰も採点できない生徒」が生まれる）。行自体は残すので、
 * 招待し直せば割当は戻る。
 */
export const getExamStudentAssignmentsForExam = async (examId: string) =>
  prisma.examStudentAssignment.findMany({
    where: {
      examStudent: { examId },
      user: { userExams: { some: { examId } } },
    },
    // 担当者はパスコードだけを落として渡す（機密除去。縮小射影ではない）
    include: { user: { omit: { passcode: true } } },
  })

interface SetExamStudentAssignmentsInput {
  examId: string
  /** 担当にする・外す採点者 */
  userId: string
  examStudentIds: string[]
  /** true で担当にし、false で外す */
  assigned: boolean
  /** 操作した利用者（試験の OWNER であること） */
  requestedByUserId: string
}

/**
 * 1人の採点者について、何人かの受験生徒の担当をまとめて付け外しする。
 *
 * 表のマス1つも、フィルハンドルで塗った範囲も、学級からの一括も、この1つの口を通る。
 * 既にその姿の生徒には何も書かない（同期で無駄な更新を流さないため）。
 *
 * @returns 実際に書き換えた生徒の数
 */
export const setExamStudentAssignments = async ({
  examId,
  userId,
  examStudentIds,
  assigned,
  requestedByUserId,
}: SetExamStudentAssignmentsInput): Promise<number> => {
  const permission = await canManageAssignments(examId, requestedByUserId)
  if (!permission.allowed) {
    throw new Error(permission.reason)
  }

  // 割当先は試験のメンバーに限る（招待はメンバー管理の責務）
  const member = await prisma.userExam.findUnique({
    where: { userId_examId: { userId, examId } },
  })
  if (!member) {
    throw new Error("この試験のメンバーでないユーザーには割り当てられません")
  }

  // 渡された生徒のうち、この試験の受験生徒だけを扱う（別の試験の行へ書かない）
  const examStudents = await prisma.examStudent.findMany({
    where: { id: { in: examStudentIds }, examId },
  })
  const existing = await prisma.examStudentAssignment.findMany({
    where: {
      userId,
      examStudentId: { in: examStudents.map((examStudent) => examStudent.id) },
    },
  })
  const assignedExamStudentIds = new Set(
    existing.map((assignment) => assignment.examStudentId)
  )

  const changedExamStudentIds = assigned
    ? examStudents
        .map((examStudent) => examStudent.id)
        .filter((examStudentId) => !assignedExamStudentIds.has(examStudentId))
    : [...assignedExamStudentIds]
  if (changedExamStudentIds.length === 0) return 0

  if (assigned) {
    await prisma.$transaction(
      changedExamStudentIds.map((examStudentId) =>
        prisma.examStudentAssignment.create({
          data: { examStudentId, userId, assignedBy: requestedByUserId },
        })
      )
    )
  } else {
    // 既に外れている行は数に入らないだけ。2人が同時に外しても望んだ状態にはなっている
    await prisma.examStudentAssignment.deleteMany({
      where: { userId, examStudentId: { in: changedExamStudentIds } },
    })
  }

  const [scope, userLabel, targets] = await Promise.all([
    resolveExamScope(examId),
    resolveUserLabel(userId),
    resolveExamStudentTargets(changedExamStudentIds),
  ])
  await recordAuditLog({
    action: assigned ? "exam.student.assign" : "exam.student.unassign",
    userId: requestedByUserId,
    entityType: "ExamStudentAssignment",
    // 何人分かをまとめた1件なので、行の id ではなく担当にした採点者を置く
    entityId: userId,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    targets,
    summary: assigned
      ? `${changedExamStudentIds.length}人の生徒の採点担当に${userLabel ?? userId}を割り当てました`
      : `${changedExamStudentIds.length}人の生徒の採点担当から${userLabel ?? userId}を外しました`,
    extra: { count: changedExamStudentIds.length },
  })

  return changedExamStudentIds.length
}
