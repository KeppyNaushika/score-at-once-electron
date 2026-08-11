import type { InviteMemberOptions } from "../lib/prisma/userExam"
import {
  getExamMembers,
  inviteExamMember,
  isExamOwner,
  removeExamMember,
  searchUsersForInvitation,
} from "../lib/prisma/userExam"
import { type HandlerMap } from "./ipcHandlerUtils"

/** ユーザーと試験の関連（UserExam）に関するメンバー管理・権限・招待のIPCチャンネルを登録する */
export const userExamHandlers = {
  // Get all members of a exam
  "user-exam:get-members": async (examId: string) => {
    return await getExamMembers(examId)
  },

  // Check if user is exam owner
  "user-exam:is-owner": async (userId: string, examId: string) => {
    return await isExamOwner(userId, examId)
  },

  // Invite a member to exam
  "user-exam:invite": async (options: InviteMemberOptions) => {
    return await inviteExamMember(options)
  },

  // Remove a member from exam
  "user-exam:remove": async (
    examId: string,
    userId: string,
    removedBy: string
  ) => {
    return await removeExamMember(examId, userId, removedBy)
  },

  // Search users for invitation
  "user-exam:search-users": async (examId: string, query: string) => {
    return await searchUsersForInvitation(examId, query)
  },
} satisfies HandlerMap
