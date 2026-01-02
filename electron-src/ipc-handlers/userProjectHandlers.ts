import { ipcMain } from "electron"
import {
  getProjectMembers,
  getProjectOwner,
  getUserProjects,
  getUserRoleInProject,
  InviteMemberOptions,
  inviteProjectMember,
  isProjectMember,
  isProjectOwner,
  removeProjectMember,
  searchUsersForInvitation,
  SetOwnerOptions,
  setProjectOwner,
  transferOwnership,
} from "../lib/prisma/userProject"

export function setupUserProjectHandlers(): void {
  // Get all members of a project
  ipcMain.handle(
    "user-project:get-members",
    async (_event, projectId: string) => {
      try {
        return await getProjectMembers(projectId)
      } catch (error) {
        console.error("IPC user-project:get-members error:", error)
        throw error
      }
    }
  )

  // Get user's role in a project
  ipcMain.handle(
    "user-project:get-role",
    async (_event, userId: string, projectId: string) => {
      try {
        return await getUserRoleInProject(userId, projectId)
      } catch (error) {
        console.error("IPC user-project:get-role error:", error)
        throw error
      }
    }
  )

  // Check if user is project owner
  ipcMain.handle(
    "user-project:is-owner",
    async (_event, userId: string, projectId: string) => {
      try {
        return await isProjectOwner(userId, projectId)
      } catch (error) {
        console.error("IPC user-project:is-owner error:", error)
        throw error
      }
    }
  )

  // Check if user is project member
  ipcMain.handle(
    "user-project:is-member",
    async (_event, userId: string, projectId: string) => {
      try {
        return await isProjectMember(userId, projectId)
      } catch (error) {
        console.error("IPC user-project:is-member error:", error)
        throw error
      }
    }
  )

  // Set project owner (when creating project)
  ipcMain.handle(
    "user-project:set-owner",
    async (_event, options: SetOwnerOptions) => {
      try {
        return await setProjectOwner(options)
      } catch (error) {
        console.error("IPC user-project:set-owner error:", error)
        throw error
      }
    }
  )

  // Invite a member to project
  ipcMain.handle(
    "user-project:invite",
    async (_event, options: InviteMemberOptions) => {
      try {
        return await inviteProjectMember(options)
      } catch (error) {
        console.error("IPC user-project:invite error:", error)
        throw error
      }
    }
  )

  // Remove a member from project
  ipcMain.handle(
    "user-project:remove",
    async (_event, projectId: string, userId: string, removedBy: string) => {
      try {
        return await removeProjectMember(projectId, userId, removedBy)
      } catch (error) {
        console.error("IPC user-project:remove error:", error)
        throw error
      }
    }
  )

  // Transfer project ownership
  ipcMain.handle(
    "user-project:transfer-ownership",
    async (
      _event,
      projectId: string,
      newOwnerId: string,
      currentOwnerId: string
    ) => {
      try {
        return await transferOwnership(projectId, newOwnerId, currentOwnerId)
      } catch (error) {
        console.error("IPC user-project:transfer-ownership error:", error)
        throw error
      }
    }
  )

  // Get all projects for a user
  ipcMain.handle(
    "user-project:get-user-projects",
    async (_event, userId: string) => {
      try {
        return await getUserProjects(userId)
      } catch (error) {
        console.error("IPC user-project:get-user-projects error:", error)
        throw error
      }
    }
  )

  // Get project owner
  ipcMain.handle(
    "user-project:get-owner",
    async (_event, projectId: string) => {
      try {
        return await getProjectOwner(projectId)
      } catch (error) {
        console.error("IPC user-project:get-owner error:", error)
        throw error
      }
    }
  )

  // Search users for invitation
  ipcMain.handle(
    "user-project:search-users",
    async (_event, projectId: string, query: string) => {
      try {
        return await searchUsersForInvitation(projectId, query)
      } catch (error) {
        console.error("IPC user-project:search-users error:", error)
        throw error
      }
    }
  )
}
