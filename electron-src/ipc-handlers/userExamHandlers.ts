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
import { registerHandler } from "./ipcHandlerUtils"

/** ユーザーと試験の関連（UserExam）に関するメンバー管理・権限・招待のIPCチャンネルを登録する */
export function setupUserExamHandlers(): void {
  // Get all members of a exam
  registerHandler("user-exam:get-members", async (examId: string) => {
    return await getExamMembers(examId)
  })

  // Get user's role in a exam
  registerHandler(
    "user-exam:get-role",
    async (userId: string, examId: string) => {
      return await getUserRoleInExam(userId, examId)
    }
  )

  // Check if user is exam owner
  registerHandler(
    "user-exam:is-owner",
    async (userId: string, examId: string) => {
      return await isExamOwner(userId, examId)
    }
  )

  // Check if user is exam member
  registerHandler(
    "user-exam:is-member",
    async (userId: string, examId: string) => {
      return await isExamMember(userId, examId)
    }
  )

  // Set exam owner (when creating exam)
  registerHandler("user-exam:set-owner", async (options: SetOwnerOptions) => {
    return await setExamOwner(options)
  })

  // Invite a member to exam
  registerHandler("user-exam:invite", async (options: InviteMemberOptions) => {
    return await inviteExamMember(options)
  })

  // Remove a member from exam
  registerHandler(
    "user-exam:remove",
    async (examId: string, userId: string, removedBy: string) => {
      return await removeExamMember(examId, userId, removedBy)
    }
  )

  // Transfer exam ownership
  registerHandler(
    "user-exam:transfer-ownership",
    async (examId: string, newOwnerId: string, currentOwnerId: string) => {
      return await transferOwnership(examId, newOwnerId, currentOwnerId)
    }
  )

  // Get all exams for a user
  registerHandler("user-exam:get-user-exams", async (userId: string) => {
    return await getUserExams(userId)
  })

  // Get exam owner
  registerHandler("user-exam:get-owner", async (examId: string) => {
    return await getExamOwner(examId)
  })

  // Search users for invitation
  registerHandler(
    "user-exam:search-users",
    async (examId: string, query: string) => {
      return await searchUsersForInvitation(examId, query)
    }
  )
}
