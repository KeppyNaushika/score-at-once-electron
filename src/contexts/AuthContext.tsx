"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"
import { createContext, useContext, useEffect, useEffectEvent } from "react"
import { toast } from "sonner"

import { showSyncToast } from "@/components/common/syncNoticeToast"
import {
  authTokenQuery,
  clearAuthTokenMutation,
  type PublicUser,
  saveAuthTokenMutation,
  userListQuery,
} from "@/queries/user"

interface AuthContextType {
  user: PublicUser | null
  isLoading: boolean
  quickLogin: (user: PublicUser) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/** 認証状態（ログイン・ログアウト・セッション確認）をアプリ全体に提供するプロバイダー */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const queryClient = useQueryClient()

  // 憶えているのは id だけ。誰なのかは利用者一覧と突き合わせて決める
  const { data: authUserId = null, isPending: authTokenPending } =
    useQuery(authTokenQuery())
  const { data: users, isPending: usersPending } = useQuery(userListQuery())
  const saveAuthToken = useMutation(saveAuthTokenMutation())
  const clearAuthToken = useMutation(clearAuthTokenMutation())

  const user =
    (authUserId && users?.find((candidate) => candidate.id === authUserId)) ||
    null

  // トークンが指す利用者が消えていたらトークンごと捨てる（次回から未ログイン）。
  // 書き先は electron-store という外の入れ物なので effect で同期する。
  //
  // ここに来るのは、ログイン中の利用者が他のPCで削除され、同期で届いた後に利用者
  // 一覧を読み直したときだけ（自分でのログアウトはトークンを先に消すので来ない。
  // 本人は自分を削除できない）。黙ってログイン画面へ戻すと何が起きたか分からない
  // ので、閉じるまで残る知らせを出す。名前は一覧から消えているので出せない。
  //
  // 気づくのは一覧を読み直したときで、同期のたびには読み直さない（他のデータも
  // 同期で読み直していないので、利用者だけを特別扱いしない）
  const dropStaleToken = useEffectEvent(() => {
    showSyncToast(
      "warning",
      "ログイン中の利用者は、他のPCで削除されたためログアウトしました",
      "この利用者と、その採点結果などのデータは、同期で削除されています。別の利用者でログインしてください。"
    )
    clearAuthToken.mutate()
  })
  useEffect(() => {
    if (!authUserId || !users) return
    if (users.some((candidate) => candidate.id === authUserId)) return
    dropStaleToken()
  }, [authUserId, users])

  const quickLogin = async (selectedUser: PublicUser) => {
    // パスワード不要のクイックログイン。簡易トークンとして user.id を保存する。
    //
    // 遷移先は関門の内側なので、**読み直しが終わってから移る**。書いた直後に
    // 移ると、まだ取り直していないキャッシュを関門が見てログイン画面へ弾き返す
    try {
      await saveAuthToken.mutateAsync(selectedUser.id)
      await queryClient.invalidateQueries({
        queryKey: authTokenQuery().queryKey,
      })
    } catch {
      // 失敗の知らせは中央のトーストが出す
      return
    }
    toast.success(`${selectedUser.name}さん、おかえりなさい！`)
    router.push("/exams")
  }

  const logout = () => {
    clearAuthToken.mutate(undefined, {
      onSuccess: () => {
        toast.success("ログアウトしました")
        router.push("/login")
      },
    })
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: authTokenPending || usersPending,
        quickLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

/** 認証コンテキストからユーザー情報・認証操作を取得するフック */
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
