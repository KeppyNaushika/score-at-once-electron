"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"
import { createContext, useContext, useEffect, useEffectEvent } from "react"
import { toast } from "sonner"

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
  quickLogin: (user: PublicUser) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/** 認証状態（ログイン・ログアウト・セッション確認）をアプリ全体に提供するプロバイダー */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()

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
  // 書き先は electron-store という外の入れ物なので effect で同期する
  const dropStaleToken = useEffectEvent(() => clearAuthToken.mutate())
  useEffect(() => {
    if (!authUserId || !users) return
    if (users.some((candidate) => candidate.id === authUserId)) return
    dropStaleToken()
  }, [authUserId, users])

  const quickLogin = (selectedUser: PublicUser) => {
    // パスワード不要のクイックログイン。簡易トークンとして user.id を保存する
    saveAuthToken.mutate(selectedUser.id, {
      onSuccess: () => {
        toast.success(`${selectedUser.name}さん、おかえりなさい！`)
        router.push("/exams")
      },
    })
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
