import { queryOptions } from "@tanstack/react-query"

import { defineMutation } from "./defineMutation"
import { scopeKeys } from "./keys"

/**
 * 試験の参加者（UserExam）の読み書き。
 *
 * 対応する preload は `electron-src/preload-apis/userExamApi.ts`。
 */

// =====================================================================
// 取得
// =====================================================================

/** 参加者1件 */
export type ExamMemberRow = Awaited<
  ReturnType<typeof window.electronAPI.userExam.getMembers>
>[number]

/** その試験に参加している利用者 */
export const examMembersQuery = (examId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "members"] as const,
    queryFn: () => window.electronAPI.userExam.getMembers(examId),
  })

/** その利用者がこの試験の担当か */
export const examOwnerQuery = (examId: string, userId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "owner", userId] as const,
    queryFn: () => window.electronAPI.userExam.isOwner(userId, examId),
  })

/** 招待先の候補1件（秘密を含まない利用者） */
export type ExamUserSearchRow = Awaited<
  ReturnType<typeof window.electronAPI.userExam.searchUsers>
>[number]

/** 招待先の利用者検索（検索語は要求の一部なのでキーに入る） */
export const examUserSearchQuery = (examId: string, query: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "userSearch", query] as const,
    queryFn: () => window.electronAPI.userExam.searchUsers(examId, query),
  })

// =====================================================================
// 書き込み
// =====================================================================

export const inviteExamMemberMutation = (examId: string) =>
  defineMutation({
    mutationFn: (
      input: Parameters<typeof window.electronAPI.userExam.invite>[0]
    ) => window.electronAPI.userExam.invite(input),
    meta: {
      // 採点割当も「何人いるか」「割り当てを触れるか」を運んでいる。参加者だけ
      // 取り直すと、招待した直後に割当・確定の入口が出ないまま残る
      invalidates: [
        examMembersQuery(examId).queryKey,
        [...scopeKeys.exam(examId), "cropRegionAssignments"],
        // 生徒の担当もメンバーでない担当者を落として返すので、参加者と一緒に古くなる
        [...scopeKeys.exam(examId), "examStudentAssignments"],
      ],
      errorMessage: "参加者を招待できませんでした",
    },
  })

/**
 * 参加者の役割を変える（オーナー・採点者・閲覧者）。操作者と権限は main が決める。
 *
 * 役割は試験のあちこちの入口（招待・担当の割り当て・採点の確定）を左右するので、
 * その試験に紐づく取得をまとめて取り直す。自分を採点者へ戻したときに、
 * オーナー用の操作が画面に残らないようにするため。
 */
export const changeExamMemberRoleMutation = (examId: string) =>
  defineMutation({
    mutationFn: (input: {
      userId: string
      role: Parameters<typeof window.electronAPI.userExam.changeRole>[2]
    }) =>
      window.electronAPI.userExam.changeRole(examId, input.userId, input.role),
    meta: {
      invalidates: [scopeKeys.exam(examId)],
      errorMessage: "参加者の役割を変更できませんでした",
    },
  })

/**
 * 採点者が「9. 結果出力」を使えるかを変える。操作者と権限は main が決める。
 * 入れる段は参加者の取得から決まるので、参加者を取り直す。
 */
export const setExamMemberExportPermissionMutation = (examId: string) =>
  defineMutation({
    mutationFn: (input: { userId: string; canExportResults: boolean }) =>
      window.electronAPI.userExam.setExportPermission(
        examId,
        input.userId,
        input.canExportResults
      ),
    meta: {
      invalidates: [examMembersQuery(examId).queryKey],
      errorMessage: "結果出力の許可を変更できませんでした",
    },
  })

/**
 * 匿名採点を試験として固定する・外す。操作者と権限は main が決める。
 * 採点画面・概要・メンバー管理が試験の行から読むので、試験に紐づく取得をまとめて取り直す。
 */
export const setExamAnonymousScoringEnforcedMutation = (examId: string) =>
  defineMutation({
    mutationFn: (anonymousScoringEnforced: boolean) =>
      window.electronAPI.userExam.setAnonymousScoringEnforced(
        examId,
        anonymousScoringEnforced
      ),
    meta: {
      invalidates: [scopeKeys.exam(examId)],
      errorMessage: "匿名採点の設定を変更できませんでした",
    },
  })

export const removeExamMemberMutation = (
  examId: string,
  currentUserId: string
) =>
  defineMutation({
    mutationFn: (userId: string) =>
      window.electronAPI.userExam.remove(examId, userId, currentUserId),
    meta: {
      invalidates: [
        examMembersQuery(examId).queryKey,
        [...scopeKeys.exam(examId), "cropRegionAssignments"],
        // 生徒の担当もメンバーでない担当者を落として返すので、参加者と一緒に古くなる
        [...scopeKeys.exam(examId), "examStudentAssignments"],
      ],
      errorMessage: "参加者を外せませんでした",
    },
  })
