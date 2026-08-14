"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"
import { createContext, useCallback, useContext } from "react"
import { toast } from "sonner"

import { queryKeys } from "@/lib/queryKeys"
import type { PublicUser } from "@/queries/user"

interface AuthContextType {
  user: PublicUser | null
  isLoading: boolean
  quickLogin: (user: PublicUser) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/** 認証状態（ログイン・ログアウト・セッション確認）をアプリ全体に提供するプロバイダー */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const queryClient = useQueryClient()

  /**
   * 保存されたトークンから今のログイン利用者を解決する。
   * トークンが指す利用者が消えていたらトークンごと捨てる（次回から未ログイン）。
   */
  const { data: user = null, isPending: isLoading } = useQuery({
    queryKey: queryKeys.currentUser.all,
    queryFn: async (): Promise<PublicUser | null> => {
      const userId = await window.electronAPI.getAuthToken()
      if (!userId) return null

      const users = await window.electronAPI.fetchUsers()
      const found = users.find((candidate) => candidate.id === userId) ?? null
      if (!found) await window.electronAPI.clearAuthToken()
      return found
    },
  })

  const setUser = useCallback(
    (next: PublicUser | null) =>
      queryClient.setQueryData(queryKeys.currentUser.all, next),
    [queryClient]
  )

  const checkAuth = useCallback(
    () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.currentUser.all }),
    [queryClient]
  )

  const quickLogin = async (selectedUser: PublicUser) => {
    try {
      // パスワード不要のクイックログイン
      setUser(selectedUser)
      // 簡易トークンとして user.id を保存
      await window.electronAPI.saveAuthToken(selectedUser.id)
      toast.success(`${selectedUser.name}さん、おかえりなさい！`)
      router.push("/exams")
    } catch (error) {
      console.error("Quick login failed:", error)
      toast.error("ログインに失敗しました")
    }
  }

  const logout = async () => {
    await window.electronAPI.clearAuthToken()
    setUser(null)
    toast.success("ログアウトしました")
    router.push("/login")
  }

  return (
    <AuthContext.Provider
      value={{ user, isLoading, quickLogin, logout, checkAuth }}
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
