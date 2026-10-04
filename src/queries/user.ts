import { queryOptions } from "@tanstack/react-query"

import type { ConfirmedDeletionCount } from "@/types/deletionConfirmation.types"

import { defineMutation } from "./defineMutation"
import { scopeKeys } from "./keys"

/**
 * 利用者（User）の読み書き。
 *
 * 返ってくる行に `passcode` は含まれない（main が落とす）。照合は
 * `verifyPasscode` が main 側で行い、ハッシュは境界を越えない。
 *
 * 対応する preload は `electron-src/preload-apis/authApi.ts`。
 */

/** 秘密を含まない利用者1件 */
export type PublicUser = Awaited<
  ReturnType<typeof window.electronAPI.fetchUsers>
>[number]

export const userListQuery = () =>
  queryOptions({
    queryKey: ["users"] as const,
    queryFn: () => window.electronAPI.fetchUsers(),
  })

/**
 * 今ログインしている利用者の id。
 *
 * DB ではなく electron-store が持つ。誰なのかは利用者一覧と突き合わせて決める
 * ので、ここが返すのは id だけである。
 */
export const authTokenQuery = () =>
  queryOptions({
    queryKey: ["authToken"] as const,
    queryFn: () => window.electronAPI.getAuthToken(),
  })

/**
 * 利用者を消すと一緒に消えるものの件数（削除確認ダイアログの事前照会）。
 *
 * **件数は main が数えて返す。** 採点結果は1人で数万行になり、行を運んで数えると
 * 重いため（「計算は renderer 側」規約の名指しの例外。docs/coding-style.md）。
 *
 * **開くたびに必ず数え直す。** 古い件数を見せると、他の教員が同期で書き足した分を
 * 告げずに消せてしまう（`studentAnswerDeletionCountsQuery` と同じ理由）。
 */
export const userDeletionCountsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["users", userId, "deletionCounts"] as const,
    queryFn: () => window.electronAPI.getUserDeletionCounts(userId),
    staleTime: 0,
    refetchOnMount: "always",
  })

/**
 * その利用者が所有者として参加している試験（試験ごとに所有者全員を同梱）。
 * ただ1人の所有者になっている試験は `findSoleOwnedExams` で導く。
 * 件数と同じく、開くたびに取り直す。
 */
export const userExamOwnershipsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["users", userId, "examOwnerships"] as const,
    queryFn: () => window.electronAPI.fetchUserExamOwnerships(userId),
    staleTime: 0,
    refetchOnMount: "always",
  })

const usersKey = userListQuery().queryKey
const authTokenKey = authTokenQuery().queryKey

export const createUserMutation = () =>
  defineMutation({
    mutationFn: (input: {
      username: string
      name: string
      passcode?: string
      passcodeType?: "none" | "4digit" | "6digit" | "alphanumeric"
    }) => window.electronAPI.createUser(input),
    meta: {
      invalidates: [usersKey],
      errorMessage: "利用者を作成できませんでした",
    },
  })

export const updateUserMutation = () =>
  defineMutation({
    mutationFn: (input: { id: string; username?: string; name?: string }) => {
      const { id, ...data } = input
      return window.electronAPI.updateUser(id, data)
    },
    meta: {
      invalidates: [usersKey],
      errorMessage: "利用者を保存できませんでした",
    },
  })

export const updateUserPasscodeMutation = () =>
  defineMutation({
    mutationFn: (input: {
      userId: string
      passcode?: string
      passcodeType?: "none" | "4digit" | "6digit" | "alphanumeric"
    }) =>
      window.electronAPI.updateUserPasscode(
        input.userId,
        input.passcode,
        input.passcodeType
      ),
    meta: {
      invalidates: [usersKey],
      errorMessage: "パスコードを保存できませんでした",
    },
  })

/**
 * 利用者を削除する。見せた件数を添えるので、main は消す直前に数え直して、
 * 増えていれば中止する。
 *
 * その利用者の採点結果・注釈・確定・解答用紙・試験への参加・設問の担当が
 * 一緒に消えるので、それを読む取得をまとめて取り直す（どの試験・どの解答用紙に
 * 及ぶかは書き込み側から絞れない）。
 */
export const deleteUserMutation = () =>
  defineMutation({
    mutationFn: (input: {
      userId: string
      confirmedCounts: ConfirmedDeletionCount[]
    }) => window.electronAPI.deleteUser(input.userId, input.confirmedCounts),
    meta: {
      invalidates: [
        usersKey,
        ["exam"],
        ["answerSheetDefinition"],
        scopeKeys.annotation(),
        ["grade"],
        ["gradeSourceFits"],
        ["studentExamResults"],
        ["classroomExamResults"],
      ],
      errorMessage: "利用者を削除できませんでした",
    },
  })

/** パスコードを照合する。DB は変わらない（比較は main 側で行う） */
export const verifyPasscodeMutation = () =>
  defineMutation({
    mutationFn: (input: { userId: string; passcode: string }) =>
      window.electronAPI.verifyPasscode(input.userId, input.passcode),
    meta: {
      writesDatabase: false,
      errorMessage: "パスコードを確認できませんでした",
    },
  })

/** ログインした利用者を憶える（DB ではなく electron-store へ書く） */
export const saveAuthTokenMutation = () =>
  defineMutation({
    mutationFn: (userId: string) => window.electronAPI.saveAuthToken(userId),
    meta: {
      invalidates: [authTokenKey],
      errorMessage: "ログイン状態を保存できませんでした",
    },
  })

/** 憶えているログインを忘れる */
export const clearAuthTokenMutation = () =>
  defineMutation({
    mutationFn: () => window.electronAPI.clearAuthToken(),
    meta: {
      invalidates: [authTokenKey],
      errorMessage: "ログアウトできませんでした",
    },
  })
