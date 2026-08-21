import type { User, UserExam } from "@prisma/client"

import type { UserExamWithUserAndInviter } from "@/types/prismaExtensions"

import { recordAuditLog } from "./auditLog"
import { resolveExamScope, resolveUserLabel } from "./auditScope"
import prisma from "./client"

export type UserRole = "OWNER" | "GRADER"

export interface InviteMemberOptions {
  examId: string
  userId: string
  invitedBy: string
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
        user: true,
        inviter: true,
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
): Promise<UserRole | null> => {
  try {
    const userExam = await prisma.userExam.findUnique({
      where: {
        userId_examId: { userId, examId },
      },
    })
    return userExam ? (userExam.role as UserRole) : null
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
 * Invite a member to a exam (as GRADER by default)
 */
export const inviteExamMember = async (
  options: InviteMemberOptions
): Promise<UserExamWithUserAndInviter> => {
  const { examId, userId, invitedBy } = options

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
        role: "GRADER",
        invitedBy,
      },
      include: {
        user: true,
        inviter: true,
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
 * Remove a member from a exam
 * Only the owner can remove members, and the owner cannot remove themselves
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

    // Owner cannot remove themselves
    if (memberToRemove.role === "OWNER") {
      throw new Error("Exam owner cannot be removed")
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
