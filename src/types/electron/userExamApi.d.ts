import type { Exam, User, UserExam } from "@prisma/client"

import type { UserRole } from "@/electron-src/lib/prisma/userExam"

/**
 * UserExam with user and inviter details
 */
export interface UserExamWithUserAndInviter {
  id: string
  userId: string
  examId: string
  role: string
  invitedAt: Date
  invitedBy: string | null
  createdAt: Date
  updatedAt: Date
  user: User
  inviter: User | null
}

/**
 * UserExam with exam details
 */
export interface UserExamWithExamDetails {
  id: string
  userId: string
  examId: string
  role: string
  invitedAt: Date
  invitedBy: string | null
  createdAt: Date
  updatedAt: Date
  exam: Exam
}

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
     * ユーザーの試験内ロールを取得
     */
    getRole: (userId: string, examId: string) => Promise<UserRole | null>

    /**
     * ユーザーが試験のオーナーか確認
     */
    isOwner: (userId: string, examId: string) => Promise<boolean>

    /**
     * ユーザーが試験のメンバーか確認
     */
    isMember: (userId: string, examId: string) => Promise<boolean>

    /**
     * 試験のオーナーを設定（試験作成時）
     */
    setOwner: (options: { examId: string; userId: string }) => Promise<UserExam>

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
     * オーナー権限を移譲
     */
    transferOwnership: (
      examId: string,
      newOwnerId: string,
      currentOwnerId: string
    ) => Promise<{
      previousOwner: UserExam
      newOwner: UserExam
    }>

    /**
     * ユーザーが参加している全試験を取得
     */
    getUserExams: (userId: string) => Promise<UserExamWithExamDetails[]>

    /**
     * 試験のオーナーを取得
     */
    getOwner: (examId: string) => Promise<UserExamWithUserAndInviter | null>

    /**
     * 招待可能なユーザーを検索（既存メンバー除外）
     */
    searchUsers: (
      examId: string,
      query: string
    ) => Promise<{ id: string; username: string; name: string }[]>
  }
}
