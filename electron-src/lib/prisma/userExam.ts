import { Prisma, UserExam } from "@prisma/client"

import { recordAuditLog } from "./auditLog"
import { resolveExamScope, resolveUserLabel } from "./auditScope"
import prisma from "./client"

// Types for UserExam with relations
type UserExamWithUser = Prisma.UserExamGetPayload<{
  include: {
    user: true
    inviter: true
  }
}>

type UserExamWithExam = Prisma.UserExamGetPayload<{
  include: {
    exam: true
  }
}>

export type UserRole = "OWNER" | "GRADER"

export interface InviteMemberOptions {
  examId: string
  userId: string
  invitedBy: string
}

export interface SetOwnerOptions {
  examId: string
  userId: string
}

/**
 * Get all members of a exam with user details
 */
export const getExamMembers = async (
  examId: string
): Promise<UserExamWithUser[]> => {
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
export const getUserRoleInExam = async (
  userId: string,
  examId: string
): Promise<UserRole | null> => {
  try {
    const userExam = await prisma.userExam.findUnique({
      where: {
        userId_examId: { userId, examId },
      },
      select: { role: true },
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
 * Check if a user is a member (any role) of a exam
 */
export const isExamMember = async (
  userId: string,
  examId: string
): Promise<boolean> => {
  try {
    const role = await getUserRoleInExam(userId, examId)
    return role !== null
  } catch (error) {
    console.error(`Failed to check member status for ${userId}:`, error)
    throw error
  }
}

/**
 * Set the owner of a exam (used when creating a exam)
 */
export const setExamOwner = async (
  options: SetOwnerOptions
): Promise<UserExam> => {
  const { examId, userId } = options

  try {
    return await prisma.userExam.create({
      data: {
        examId,
        userId,
        role: "OWNER",
        invitedBy: null, // Owner is not invited
      },
    })
  } catch (error) {
    console.error(`Failed to set owner for exam ${examId}:`, error)
    throw error
  }
}

/**
 * Invite a member to a exam (as GRADER by default)
 */
export const inviteExamMember = async (
  options: InviteMemberOptions
): Promise<UserExamWithUser> => {
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
 * Transfer exam ownership to another member
 * Only current owner can do this
 */
export const transferOwnership = async (
  examId: string,
  newOwnerId: string,
  currentOwnerId: string
): Promise<{ previousOwner: UserExam; newOwner: UserExam }> => {
  try {
    // Verify current owner
    const currentOwnerRole = await getUserRoleInExam(currentOwnerId, examId)
    if (currentOwnerRole !== "OWNER") {
      throw new Error("Only current owner can transfer ownership")
    }

    // Verify new owner is already a member
    const newOwnerMembership = await prisma.userExam.findUnique({
      where: {
        userId_examId: { userId: newOwnerId, examId },
      },
    })
    if (!newOwnerMembership) {
      throw new Error("New owner must be an existing member of the exam")
    }

    // Perform the transfer in a transaction
    const [previousOwner, newOwner] = await prisma.$transaction([
      // Demote current owner to GRADER
      prisma.userExam.update({
        where: {
          userId_examId: { userId: currentOwnerId, examId },
        },
        data: { role: "GRADER" },
      }),
      // Promote new owner
      prisma.userExam.update({
        where: {
          userId_examId: { userId: newOwnerId, examId },
        },
        data: { role: "OWNER", invitedBy: null },
      }),
    ])

    // 監査ログ: 所有権の移譲（ロール変更）
    const scope = await resolveExamScope(examId)
    const newOwnerName = await resolveUserLabel(newOwnerId)
    await recordAuditLog({
      action: "exam.user.role_update",
      userId: currentOwnerId,
      entityType: "UserExam",
      entityId: newOwner.id,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      target: newOwnerName,
      summary: newOwnerName
        ? `「${newOwnerName}」に試験の所有権を移譲しました`
        : "試験の所有権を移譲しました",
      changes: [
        { field: "role", label: "権限", before: "GRADER", after: "OWNER" },
      ],
    })

    return { previousOwner, newOwner }
  } catch (error) {
    console.error(`Failed to transfer ownership of ${examId}:`, error)
    throw error
  }
}

/**
 * Get all exams a user is a member of
 */
export const getUserExams = async (
  userId: string
): Promise<UserExamWithExam[]> => {
  try {
    return await prisma.userExam.findMany({
      where: { userId },
      include: {
        exam: true,
      },
      orderBy: { createdAt: "desc" },
    })
  } catch (error) {
    console.error(`Failed to get exams for user ${userId}:`, error)
    throw error
  }
}

/**
 * Get the owner of a exam
 */
export const getExamOwner = async (
  examId: string
): Promise<UserExamWithUser | null> => {
  try {
    return await prisma.userExam.findFirst({
      where: {
        examId,
        role: "OWNER",
      },
      include: {
        user: true,
        inviter: true,
      },
    })
  } catch (error) {
    console.error(`Failed to get owner for exam ${examId}:`, error)
    throw error
  }
}

/**
 * Search users for invitation (exclude existing members)
 */
export const searchUsersForInvitation = async (
  examId: string,
  query: string
): Promise<{ id: string; username: string; name: string }[]> => {
  try {
    // Get existing member IDs
    const existingMembers = await prisma.userExam.findMany({
      where: { examId },
      select: { userId: true },
    })
    const existingMemberIds = existingMembers.map((member) => member.userId)

    // Search users excluding existing members
    return await prisma.user.findMany({
      where: {
        id: { notIn: existingMemberIds },
        OR: [{ username: { contains: query } }, { name: { contains: query } }],
      },
      select: {
        id: true,
        username: true,
        name: true,
      },
      take: 10,
    })
  } catch (error) {
    console.error(`Failed to search users for invitation:`, error)
    throw error
  }
}
