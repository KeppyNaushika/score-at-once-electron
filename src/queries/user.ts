import { queryOptions } from "@tanstack/react-query"

import { defineMutation } from "./defineMutation"

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
