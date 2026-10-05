import type { User, UserExam } from "@prisma/client"

import {
  EXAM_ROLE_LABELS,
  type ExamRole,
  parseExamRole,
} from "@/lib/shared/examRoles"
import type { UserExamWithUserAndInviter } from "@/types/prismaExtensions"

import { getCurrentActorUserId } from "./auditActor"
import { diffFields, recordAuditLog } from "./auditLog"
import { resolveExamScope, resolveUserLabel } from "./auditScope"
import prisma from "./client"
import { PUBLIC_USER_OMIT } from "./publicUser"

export interface InviteMemberOptions {
  examId: string
  userId: string
  invitedBy: string
  /** 招待するときのロール。省略すると採点者（EDITOR） */
  role?: ExamRole
}

/**
 * Get all members of a exam with user details
 */
export const getExamMembers = async (
  examId: string
): Promise<UserExamWithUserAndInviter[]> => {
  try {
    return await prisma.userExam.findMany({
      where: { examId },
      include: {
        user: { omit: PUBLIC_USER_OMIT },
        inviter: { omit: PUBLIC_USER_OMIT },
      },
    })
  } catch (error) {
    console.error(`Failed to get exam members for ${examId}:`, error)
    throw error
  }
}

/**
 * Get a user's role in a specific exam
 */
const getUserRoleInExam = async (
  userId: string,
  examId: string
): Promise<ExamRole | null> => {
  try {
    const userExam = await prisma.userExam.findUnique({
      where: {
        userId_examId: { userId, examId },
      },
    })
    return userExam ? parseExamRole(userExam.role) : null
  } catch (error) {
    console.error(`Failed to get user role for ${userId} in ${examId}:`, error)
    throw error
  }
}

/**
 * Check if a user is the owner of a exam
 */
export const isExamOwner = async (
  userId: string,
  examId: string
): Promise<boolean> => {
  try {
    const role = await getUserRoleInExam(userId, examId)
    return role === "OWNER"
  } catch (error) {
    console.error(`Failed to check owner status for ${userId}:`, error)
    throw error
  }
}

/**
 * 試験に参加者を招待する（ロールを省略すると採点者）。招待できるのはオーナーだけ
 */
export const inviteExamMember = async (
  options: InviteMemberOptions
): Promise<UserExamWithUserAndInviter> => {
  const { examId, userId, invitedBy, role = "EDITOR" } = options

  try {
    // Verify the inviter is the owner
    const inviterRole = await getUserRoleInExam(invitedBy, examId)
    if (inviterRole !== "OWNER") {
      throw new Error("Only exam owner can invite members")
    }

    // Check if user is already a member
    const existingMember = await prisma.userExam.findUnique({
      where: {
        userId_examId: { userId, examId },
      },
    })
    if (existingMember) {
      throw new Error("User is already a member of this exam")
    }

    const created = await prisma.userExam.create({
      data: {
        examId,
        userId,
        role,
        invitedBy,
      },
      include: {
        user: { omit: PUBLIC_USER_OMIT },
        inviter: { omit: PUBLIC_USER_OMIT },
      },
    })

    // 監査ログ: 試験への招待
    const scope = await resolveExamScope(examId)
    await recordAuditLog({
      action: "exam.user.invite",
      userId: invitedBy,
      entityType: "UserExam",
      entityId: created.id,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      target: created.user?.name ?? null,
    })

    return created
  } catch (error) {
    console.error(`Failed to invite member ${userId} to ${examId}:`, error)
    throw error
  }
}

/**
 * 試験から参加者を外す。外せるのはオーナーだけ。
 *
 * **最後の1人のオーナーは外せない**（オーナーの居ない試験が残る）。オーナーが複数いれば、
 * オーナーも外せる（docs/scoring-scope-and-permissions-design.md §3-3）。
 */
export const removeExamMember = async (
  examId: string,
  userId: string,
  removedBy: string
): Promise<UserExam> => {
  try {
    // Verify the remover is the owner
    const removerRole = await getUserRoleInExam(removedBy, examId)
    if (removerRole !== "OWNER") {
      throw new Error("Only exam owner can remove members")
    }

    // Get the member being removed
    const memberToRemove = await prisma.userExam.findUnique({
      where: {
        userId_examId: { userId, examId },
      },
    })
    if (!memberToRemove) {
      throw new Error("User is not a member of this exam")
    }

    if (memberToRemove.role === "OWNER") {
      const ownerCount = await prisma.userExam.count({
        where: { examId, role: "OWNER" },
      })
      if (ownerCount <= 1) {
        throw new Error(
          "最後のオーナーは外せません。先に別の参加者をオーナーにしてください"
        )
      }
    }

    const removed = await prisma.userExam.delete({
      where: {
        userId_examId: { userId, examId },
      },
    })

    // 監査ログ: 試験メンバーの削除
    const scope = await resolveExamScope(examId)
    const targetName = await resolveUserLabel(userId)
    await recordAuditLog({
      action: "exam.user.remove",
      userId: removedBy,
      entityType: "UserExam",
      entityId: removed.id,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      target: targetName,
    })

    return removed
  } catch (error) {
    console.error(`Failed to remove member ${userId} from ${examId}:`, error)
    throw error
  }
}

/**
 * 参加者の役割を変える（オーナー・採点者・閲覧者のあいだ）。
 *
 * オーナーを別の教員へ移すときは、相手をオーナーにしてから自分の役割を変える。
 * 利用者の削除は、その利用者だけがオーナーの試験があると断るので、その前に
 * これでオーナーを移す（docs/ownership-and-sharing-design.md §4.4）。
 *
 * - **変えられるのはその試験のオーナーだけ。** 操作者は main が決める
 *   （`getCurrentActorUserId`）。renderer が渡した id を信じると、他端末で役割が
 *   変わった後も手元の古い判定で通ってしまう
 * - **最後の1人のオーナーはほかの役割へ変えられない。** オーナーの居ない試験が残る
 *   （docs/scoring-scope-and-permissions-design.md §3-3）
 *
 * これはセキュリティではなく、アプリの導線を通した誤操作を防ぐだけである
 * （同 §2-4）。
 */
export const changeExamMemberRole = async (
  examId: string,
  userId: string,
  role: ExamRole
): Promise<UserExamWithUserAndInviter> => {
  const actorUserId = getCurrentActorUserId()
  if (actorUserId === null) {
    throw new Error(
      "ログインしている利用者が分からないため、役割を変更できません"
    )
  }
  if ((await getUserRoleInExam(actorUserId, examId)) !== "OWNER") {
    throw new Error("役割を変更できるのは、この試験のオーナーだけです")
  }

  const before = await prisma.userExam.findUnique({
    where: { userId_examId: { userId, examId } },
  })
  if (!before) {
    throw new Error("この利用者は試験の参加者ではありません")
  }

  if (before.role === "OWNER" && role !== "OWNER") {
    const ownerCount = await prisma.userExam.count({
      where: { examId, role: "OWNER" },
    })
    if (ownerCount <= 1) {
      throw new Error(
        "最後のオーナーはほかの役割に変えられません。先に別の参加者をオーナーにしてください"
      )
    }
  }

  const updated = await prisma.userExam.update({
    where: { userId_examId: { userId, examId } },
    data: { role },
    include: {
      user: { omit: PUBLIC_USER_OMIT },
      inviter: { omit: PUBLIC_USER_OMIT },
    },
  })

  const changes = diffFields(before, updated, [
    { field: "role", label: "役割" },
  ])
  if (changes.length > 0) {
    const scope = await resolveExamScope(examId)
    await recordAuditLog({
      action: "exam.user.role_update",
      entityType: "UserExam",
      entityId: updated.id,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      target: updated.user.name,
      summary: `「${updated.user.name}」を${EXAM_ROLE_LABELS[role]}にしました`,
      changes,
    })
  }

  return updated
}

/**
 * 採点者が「9. 結果出力」を使えるかを変える（docs/scoring-scope-and-permissions-design.md §3-3）。
 *
 * 効くのは採点者（EDITOR）だけで、オーナーと閲覧者はいつでも使える。既定は許可で、
 * オーナーがメンバーごとに外す。変えられるのはその試験のオーナーだけ（操作者は main が決める）。
 */
export const setExamMemberExportPermission = async (
  examId: string,
  userId: string,
  canExportResults: boolean
): Promise<UserExamWithUserAndInviter> => {
  const actorUserId = getCurrentActorUserId()
  if (actorUserId === null) {
    throw new Error(
      "ログインしている利用者が分からないため、結果出力の許可を変更できません"
    )
  }
  if ((await getUserRoleInExam(actorUserId, examId)) !== "OWNER") {
    throw new Error(
      "結果出力の許可を変更できるのは、この試験のオーナーだけです"
    )
  }

  const before = await prisma.userExam.findUnique({
    where: { userId_examId: { userId, examId } },
  })
  if (!before) {
    throw new Error("この利用者は試験の参加者ではありません")
  }

  const updated = await prisma.userExam.update({
    where: { userId_examId: { userId, examId } },
    data: { canExportResults },
    include: {
      user: { omit: PUBLIC_USER_OMIT },
      inviter: { omit: PUBLIC_USER_OMIT },
    },
  })

  const changes = diffFields(before, updated, [
    { field: "canExportResults", label: "結果出力の許可" },
  ])
  if (changes.length > 0) {
    const scope = await resolveExamScope(examId)
    await recordAuditLog({
      action: "exam.user.export_permission_update",
      entityType: "UserExam",
      entityId: updated.id,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      target: updated.user.name,
      summary: canExportResults
        ? `「${updated.user.name}」に結果出力を許可しました`
        : `「${updated.user.name}」の結果出力を止めました`,
      changes,
    })
  }

  return updated
}

/**
 * 匿名採点を試験として固定する・外す（docs/scoring-scope-and-permissions-design.md §3-5）。
 *
 * 固定している間、オーナー以外は「7. 採点」で生徒の名前・答案の氏名欄・名簿順を見られず、
 * 自分で解除もできない。変えられるのはその試験のオーナーだけ（操作者は main が決める）。
 * 結果出力を許可した採点者には氏名と得点の対応が見えてしまうが、止めはせず画面で伝える。
 */
export const setExamAnonymousScoringEnforced = async (
  examId: string,
  anonymousScoringEnforced: boolean
) => {
  const actorUserId = getCurrentActorUserId()
  if (actorUserId === null) {
    throw new Error(
      "ログインしている利用者が分からないため、匿名採点の設定を変更できません"
    )
  }
  if ((await getUserRoleInExam(actorUserId, examId)) !== "OWNER") {
    throw new Error(
      "匿名採点の設定を変更できるのは、この試験のオーナーだけです"
    )
  }

  const before = await prisma.exam.findUniqueOrThrow({ where: { id: examId } })
  const updated = await prisma.exam.update({
    where: { id: examId },
    data: { anonymousScoringEnforced },
  })

  const changes = diffFields(before, updated, [
    { field: "anonymousScoringEnforced", label: "匿名採点の固定" },
  ])
  if (changes.length > 0) {
    await recordAuditLog({
      action: "exam.anonymous_scoring.update",
      entityType: "Exam",
      entityId: examId,
      scopeId: examId,
      scopeLabel: updated.examName,
      target: updated.examName,
      summary: anonymousScoringEnforced
        ? `試験「${updated.examName}」の匿名採点を固定しました`
        : `試験「${updated.examName}」の匿名採点の固定を外しました`,
      changes,
    })
  }

  return updated
}

/**
 * Search users for invitation (exclude existing members)
 */
export const searchUsersForInvitation = async (
  examId: string,
  query: string
): Promise<Omit<User, "passcode">[]> => {
  try {
    // Get existing member IDs
    const existingMembers = await prisma.userExam.findMany({
      where: { examId },
    })
    const existingMemberIds = existingMembers.map((member) => member.userId)

    // Search users excluding existing members
    return await prisma.user.findMany({
      where: {
        id: { notIn: existingMemberIds },
        OR: [{ username: { contains: query } }, { name: { contains: query } }],
      },
      // パスコードだけを落とす（機密除去。縮小射影ではない）
      omit: { passcode: true },
      take: 10,
    })
  } catch (error) {
    console.error(`Failed to search users for invitation:`, error)
    throw error
  }
}
