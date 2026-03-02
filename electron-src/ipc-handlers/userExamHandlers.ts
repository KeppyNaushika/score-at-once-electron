import { ipcMain } from "electron"

import {
  getExamMembers,
  getExamOwner,
  getUserExams,
  getUserRoleInExam,
  inviteExamMember,
  InviteMemberOptions,
  isExamMember,
  isExamOwner,
  removeExamMember,
  searchUsersForInvitation,
  setExamOwner,
  SetOwnerOptions,
  transferOwnership,
} from "../lib/prisma/userExam"

export function setupUserExamHandlers(): void {
  // Get all members of a exam
  ipcMain.handle("user-exam:get-members", async (_event, examId: string) => {
    try {
      return await getExamMembers(examId)
    } catch (error) {
      console.error("IPC user-exam:get-members error:", error)
      throw error
    }
  })

  // Get user's role in a exam
  ipcMain.handle(
    "user-exam:get-role",
    async (_event, userId: string, examId: string) => {
      try {
        return await getUserRoleInExam(userId, examId)
      } catch (error) {
        console.error("IPC user-exam:get-role error:", error)
        throw error
      }
    }
  )

  // Check if user is exam owner
  ipcMain.handle(
    "user-exam:is-owner",
    async (_event, userId: string, examId: string) => {
      try {
        return await isExamOwner(userId, examId)
      } catch (error) {
        console.error("IPC user-exam:is-owner error:", error)
        throw error
      }
    }
  )

  // Check if user is exam member
  ipcMain.handle(
    "user-exam:is-member",
    async (_event, userId: string, examId: string) => {
      try {
        return await isExamMember(userId, examId)
      } catch (error) {
        console.error("IPC user-exam:is-member error:", error)
        throw error
      }
    }
  )

  // Set exam owner (when creating exam)
  ipcMain.handle(
    "user-exam:set-owner",
    async (_event, options: SetOwnerOptions) => {
      try {
        return await setExamOwner(options)
      } catch (error) {
        console.error("IPC user-exam:set-owner error:", error)
        throw error
      }
    }
  )

  // Invite a member to exam
  ipcMain.handle(
    "user-exam:invite",
    async (_event, options: InviteMemberOptions) => {
      try {
        return await inviteExamMember(options)
      } catch (error) {
        console.error("IPC user-exam:invite error:", error)
        throw error
      }
    }
  )

  // Remove a member from exam
  ipcMain.handle(
    "user-exam:remove",
    async (_event, examId: string, userId: string, removedBy: string) => {
      try {
        return await removeExamMember(examId, userId, removedBy)
      } catch (error) {
        console.error("IPC user-exam:remove error:", error)
        throw error
      }
    }
  )

  // Transfer exam ownership
  ipcMain.handle(
    "user-exam:transfer-ownership",
    async (
      _event,
      examId: string,
      newOwnerId: string,
      currentOwnerId: string
    ) => {
      try {
        return await transferOwnership(examId, newOwnerId, currentOwnerId)
      } catch (error) {
        console.error("IPC user-exam:transfer-ownership error:", error)
        throw error
      }
    }
  )

  // Get all exams for a user
  ipcMain.handle("user-exam:get-user-exams", async (_event, userId: string) => {
    try {
      return await getUserExams(userId)
    } catch (error) {
      console.error("IPC user-exam:get-user-exams error:", error)
      throw error
    }
  })

  // Get exam owner
  ipcMain.handle("user-exam:get-owner", async (_event, examId: string) => {
    try {
      return await getExamOwner(examId)
    } catch (error) {
      console.error("IPC user-exam:get-owner error:", error)
      throw error
    }
  })

  // Search users for invitation
  ipcMain.handle(
    "user-exam:search-users",
    async (_event, examId: string, query: string) => {
      try {
        return await searchUsersForInvitation(examId, query)
      } catch (error) {
        console.error("IPC user-exam:search-users error:", error)
        throw error
      }
    }
  )
}
