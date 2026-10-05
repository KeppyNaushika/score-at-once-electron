import type { ExamRole } from "@/lib/shared/examRoles"

import type { InviteMemberOptions } from "../lib/prisma/userExam"
import {
  changeExamMemberRole,
  getExamMembers,
  inviteExamMember,
  isExamOwner,
  removeExamMember,
  searchUsersForInvitation,
  setExamAnonymousScoringEnforced,
  setExamMemberExportPermission,
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

  // 参加者の役割を変える（操作者と権限は main が判定する）
  "user-exam:change-role": async (
    examId: string,
    userId: string,
    role: ExamRole
  ) => {
    return await changeExamMemberRole(examId, userId, role)
  },

  // 採点者が結果出力を使えるかを変える（操作者と権限は main が判定する）
  "user-exam:set-export-permission": async (
    examId: string,
    userId: string,
    canExportResults: boolean
  ) => {
    return await setExamMemberExportPermission(examId, userId, canExportResults)
  },

  // 匿名採点を試験として固定する・外す（操作者と権限は main が判定する）
  "user-exam:set-anonymous-scoring-enforced": async (
    examId: string,
    anonymousScoringEnforced: boolean
  ) => {
    return await setExamAnonymousScoringEnforced(
      examId,
      anonymousScoringEnforced
    )
  },

  // Search users for invitation
  "user-exam:search-users": async (examId: string, query: string) => {
    return await searchUsersForInvitation(examId, query)
  },
} satisfies HandlerMap
