import { Prisma, UserProject } from "@prisma/client"
import prisma from "./client"

// Types for UserProject with relations
type UserProjectWithUser = Prisma.UserProjectGetPayload<{
  include: {
    user: true
    inviter: true
  }
}>

type UserProjectWithProject = Prisma.UserProjectGetPayload<{
  include: {
    project: true
  }
}>

export type UserRole = "OWNER" | "GRADER"

export interface InviteMemberOptions {
  projectId: string
  userId: string
  invitedBy: string
}

export interface SetOwnerOptions {
  projectId: string
  userId: string
}

/**
 * Get all members of a project with user details
 */
export const getProjectMembers = async (
  projectId: string
): Promise<UserProjectWithUser[]> => {
  try {
    return await prisma.userProject.findMany({
      where: { projectId },
      include: {
        user: true,
        inviter: true,
      },
    })
  } catch (error) {
    console.error(`Failed to get project members for ${projectId}:`, error)
    throw error
  }
}

/**
 * Get a user's role in a specific project
 */
export const getUserRoleInProject = async (
  userId: string,
  projectId: string
): Promise<UserRole | null> => {
  try {
    const userProject = await prisma.userProject.findUnique({
      where: {
        userId_projectId: { userId, projectId },
      },
      select: { role: true },
    })
    return userProject ? (userProject.role as UserRole) : null
  } catch (error) {
    console.error(
      `Failed to get user role for ${userId} in ${projectId}:`,
      error
    )
    throw error
  }
}

/**
 * Check if a user is the owner of a project
 */
export const isProjectOwner = async (
  userId: string,
  projectId: string
): Promise<boolean> => {
  try {
    const role = await getUserRoleInProject(userId, projectId)
    return role === "OWNER"
  } catch (error) {
    console.error(`Failed to check owner status for ${userId}:`, error)
    throw error
  }
}

/**
 * Check if a user is a member (any role) of a project
 */
export const isProjectMember = async (
  userId: string,
  projectId: string
): Promise<boolean> => {
  try {
    const role = await getUserRoleInProject(userId, projectId)
    return role !== null
  } catch (error) {
    console.error(`Failed to check member status for ${userId}:`, error)
    throw error
  }
}

/**
 * Set the owner of a project (used when creating a project)
 */
export const setProjectOwner = async (
  options: SetOwnerOptions
): Promise<UserProject> => {
  const { projectId, userId } = options

  try {
    return await prisma.userProject.create({
      data: {
        projectId,
        userId,
        role: "OWNER",
        invitedBy: null, // Owner is not invited
      },
    })
  } catch (error) {
    console.error(`Failed to set owner for project ${projectId}:`, error)
    throw error
  }
}

/**
 * Invite a member to a project (as GRADER by default)
 */
export const inviteProjectMember = async (
  options: InviteMemberOptions
): Promise<UserProjectWithUser> => {
  const { projectId, userId, invitedBy } = options

  try {
    // Verify the inviter is the owner
    const inviterRole = await getUserRoleInProject(invitedBy, projectId)
    if (inviterRole !== "OWNER") {
      throw new Error("Only project owner can invite members")
    }

    // Check if user is already a member
    const existingMember = await prisma.userProject.findUnique({
      where: {
        userId_projectId: { userId, projectId },
      },
    })
    if (existingMember) {
      throw new Error("User is already a member of this project")
    }

    return await prisma.userProject.create({
      data: {
        projectId,
        userId,
        role: "GRADER",
        invitedBy,
      },
      include: {
        user: true,
        inviter: true,
      },
    })
  } catch (error) {
    console.error(`Failed to invite member ${userId} to ${projectId}:`, error)
    throw error
  }
}

/**
 * Remove a member from a project
 * Only the owner can remove members, and the owner cannot remove themselves
 */
export const removeProjectMember = async (
  projectId: string,
  userId: string,
  removedBy: string
): Promise<UserProject> => {
  try {
    // Verify the remover is the owner
    const removerRole = await getUserRoleInProject(removedBy, projectId)
    if (removerRole !== "OWNER") {
      throw new Error("Only project owner can remove members")
    }

    // Get the member being removed
    const memberToRemove = await prisma.userProject.findUnique({
      where: {
        userId_projectId: { userId, projectId },
      },
    })
    if (!memberToRemove) {
      throw new Error("User is not a member of this project")
    }

    // Owner cannot remove themselves
    if (memberToRemove.role === "OWNER") {
      throw new Error("Project owner cannot be removed")
    }

    return await prisma.userProject.delete({
      where: {
        userId_projectId: { userId, projectId },
      },
    })
  } catch (error) {
    console.error(`Failed to remove member ${userId} from ${projectId}:`, error)
    throw error
  }
}

/**
 * Transfer project ownership to another member
 * Only current owner can do this
 */
export const transferOwnership = async (
  projectId: string,
  newOwnerId: string,
  currentOwnerId: string
): Promise<{ previousOwner: UserProject; newOwner: UserProject }> => {
  try {
    // Verify current owner
    const currentOwnerRole = await getUserRoleInProject(
      currentOwnerId,
      projectId
    )
    if (currentOwnerRole !== "OWNER") {
      throw new Error("Only current owner can transfer ownership")
    }

    // Verify new owner is already a member
    const newOwnerMembership = await prisma.userProject.findUnique({
      where: {
        userId_projectId: { userId: newOwnerId, projectId },
      },
    })
    if (!newOwnerMembership) {
      throw new Error("New owner must be an existing member of the project")
    }

    // Perform the transfer in a transaction
    const [previousOwner, newOwner] = await prisma.$transaction([
      // Demote current owner to GRADER
      prisma.userProject.update({
        where: {
          userId_projectId: { userId: currentOwnerId, projectId },
        },
        data: { role: "GRADER" },
      }),
      // Promote new owner
      prisma.userProject.update({
        where: {
          userId_projectId: { userId: newOwnerId, projectId },
        },
        data: { role: "OWNER", invitedBy: null },
      }),
    ])

    return { previousOwner, newOwner }
  } catch (error) {
    console.error(`Failed to transfer ownership of ${projectId}:`, error)
    throw error
  }
}

/**
 * Get all projects a user is a member of
 */
export const getUserProjects = async (
  userId: string
): Promise<UserProjectWithProject[]> => {
  try {
    return await prisma.userProject.findMany({
      where: { userId },
      include: {
        project: true,
      },
      orderBy: { createdAt: "desc" },
    })
  } catch (error) {
    console.error(`Failed to get projects for user ${userId}:`, error)
    throw error
  }
}

/**
 * Get the owner of a project
 */
export const getProjectOwner = async (
  projectId: string
): Promise<UserProjectWithUser | null> => {
  try {
    return await prisma.userProject.findFirst({
      where: {
        projectId,
        role: "OWNER",
      },
      include: {
        user: true,
        inviter: true,
      },
    })
  } catch (error) {
    console.error(`Failed to get owner for project ${projectId}:`, error)
    throw error
  }
}

/**
 * Search users for invitation (exclude existing members)
 */
export const searchUsersForInvitation = async (
  projectId: string,
  query: string
): Promise<{ id: string; username: string; name: string }[]> => {
  try {
    // Get existing member IDs
    const existingMembers = await prisma.userProject.findMany({
      where: { projectId },
      select: { userId: true },
    })
    const existingMemberIds = existingMembers.map((m) => m.userId)

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
