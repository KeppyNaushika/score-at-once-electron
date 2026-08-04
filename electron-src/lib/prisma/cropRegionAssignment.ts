/**
 * 設問（採点領域）ごとの採点担当。
 *
 * 担当は権限拒否ではなく「その人が採点画面で選べる設問集合」を定義する。
 * バックエンドで採点そのものを拒否はしない — 担当外の設問が選択肢に出ないだけ。
 * 担当0人の設問は全員担当とみなす（絞り込みの規則は renderer の
 * `useAssignedCropRegions` が持つ）。
 */
import { recordAuditLog } from "./auditLog"
import { resolveExamScopeByCropRegion, resolveUserLabel } from "./auditScope"
import prisma from "./client"
import { isRecordNotFoundError } from "./prismaErrors"
import { canDecideExamScores } from "./scoreDecision"

/**
 * 割当の編集権限。確定と同じく試験OWNERのみ。
 * 誰が採点するかの決定は裁定と同じ「試験の運営」の権限に属する。
 */
export const canManageAssignments = canDecideExamScores

/**
 * 試験のメンバー数。
 *
 * 「この試験は協調採点か」を安価に判定するために使う。1以下なら分担する相手が
 * おらず、提案も常に1件なので競合は構造的にゼロ ＝ 裁定サマリを引く必要がない。
 */
export const countExamMembers = async (examId: string): Promise<number> =>
  prisma.userExam.count({ where: { examId } })

/**
 * 試験の全設問の担当割当を取得する。
 *
 * **現在この試験のメンバーである担当者に限る。** 割当行はメンバー削除やアーカイブ
 * インポートで残留しうるが、非メンバーを担当として数えると
 * 「担当が居るのに誰も採点できない設問」が生まれるため、ここで落とす。
 * 行自体は残すので、その人を招待し直せば割当は自動的に復活する。
 */
export const getAssignmentsForExam = async (examId: string) => {
  try {
    const assignments = await prisma.cropRegionAssignment.findMany({
      where: {
        cropRegion: { examPage: { examId }, type: "QUESTION_ANSWER" },
        user: { userExams: { some: { examId } } },
      },
      // 作成者はパスコードだけを落として渡す（機密除去。縮小射影ではない）
      include: { user: { omit: { passcode: true } } },
    })
    return { success: true as const, assignments }
  } catch (error) {
    console.error("Failed to get crop region assignments:", error)
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/** 設問に採点担当を割り当てる（既に割当済みなら何もしない） */
export const assignCropRegion = async (
  cropRegionId: string,
  userId: string,
  assignedByUserId: string
) => {
  try {
    const scope = await resolveExamScopeByCropRegion(cropRegionId)
    if (!scope.scopeId) {
      return { success: false as const, error: "採点領域が見つかりません" }
    }
    const examId = scope.scopeId
    const permission = await canManageAssignments(examId, assignedByUserId)
    if (!permission.allowed) {
      return { success: false as const, error: permission.reason }
    }

    // 割当先は試験のメンバーに限る（招待はメンバー管理の責務）
    const member = await prisma.userExam.findUnique({
      where: { userId_examId: { userId, examId } },
    })
    if (!member) {
      return {
        success: false as const,
        error: "この試験のメンバーでないユーザーには割り当てられません",
      }
    }

    const assignment = await prisma.cropRegionAssignment.upsert({
      where: { cropRegionId_userId: { cropRegionId, userId } },
      create: {
        cropRegionId,
        userId,
        assignedBy: assignedByUserId,
      },
      update: { assignedBy: assignedByUserId },
      include: { user: { omit: { passcode: true } } },
    })

    const userLabel = await resolveUserLabel(userId)
    await recordAuditLog({
      action: "exam.score.assign",
      userId: assignedByUserId,
      entityType: "CropRegionAssignment",
      entityId: assignment.id,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      summary: `設問の採点担当に${userLabel ?? userId}を割り当てました`,
    })

    return { success: true as const, assignment }
  } catch (error) {
    console.error("Failed to assign crop region:", error)
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/** 設問の採点担当を解除する */
export const unassignCropRegion = async (
  cropRegionId: string,
  userId: string,
  requestedByUserId: string
) => {
  try {
    const scope = await resolveExamScopeByCropRegion(cropRegionId)
    if (!scope.scopeId) {
      return { success: false as const, error: "採点領域が見つかりません" }
    }
    const examId = scope.scopeId
    const permission = await canManageAssignments(examId, requestedByUserId)
    if (!permission.allowed) {
      return { success: false as const, error: permission.reason }
    }

    // 鍵は `@@unique`（idは uuidv4 で計算できない）。delete の戻り値から
    // 監査ログ用のidを取る。事前に findUnique で引くと2文に割れ、その隙間で
    // 同期が相手の DELETE を適用したときに P2025 で失敗扱いになる
    const deleted = await prisma.cropRegionAssignment.delete({
      where: { cropRegionId_userId: { cropRegionId, userId } },
    })

    const userLabel = await resolveUserLabel(userId)
    await recordAuditLog({
      action: "exam.score.unassign",
      userId: requestedByUserId,
      entityType: "CropRegionAssignment",
      entityId: deleted.id,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      summary: `設問の採点担当から${userLabel ?? userId}を外しました`,
    })

    return { success: true as const }
  } catch (error) {
    // 既に外れている（同期で消えた・二重クリック）。求めた状態にはなっているので成功
    if (isRecordNotFoundError(error)) {
      return { success: true as const }
    }
    console.error("Failed to unassign crop region:", error)
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
