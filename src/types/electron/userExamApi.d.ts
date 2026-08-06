import type { UserExam } from "@prisma/client"

import type { UserExamWithUserAndInviter } from "../prismaExtensions"

/**
 * UserExam権限管理関連API
 */
export interface UserExamAPI {
  userExam: {
    /**
     * 試験のメンバー一覧を取得
     */
    getMembers: (examId: string) => Promise<UserExamWithUserAndInviter[]>

    /**
     * ユーザーが試験のオーナーか確認
     */
    isOwner: (userId: string, examId: string) => Promise<boolean>

    /**
     * メンバーを招待（GRADERとして追加）
     */
    invite: (options: {
      examId: string
      userId: string
      invitedBy: string
    }) => Promise<UserExamWithUserAndInviter>

    /**
     * メンバーを削除
     */
    remove: (
      examId: string,
      userId: string,
      removedBy: string
    ) => Promise<UserExam>

    /**
     * 招待可能なユーザーを検索（既存メンバー除外）
     */
    searchUsers: (
      examId: string,
      query: string
    ) => Promise<{ id: string; username: string; name: string }[]>
  }
}
