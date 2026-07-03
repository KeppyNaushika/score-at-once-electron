"use client"

import { useRouter } from "next/navigation"
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react"
import { toast } from "sonner"

interface User {
  id: string
  username: string
  name: string
  role: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  quickLogin: (user: User) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/** 認証状態（ログイン・ログアウト・セッション確認）をアプリ全体に提供するプロバイダー */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      // electron-storeから認証トークンを取得
      const result = await window.electronAPI.getAuthToken()
      const userId = result.success ? result.token : null

      if (userId) {
        // userIdから直接ユーザー情報を取得
        const users = await window.electronAPI.fetchUsers()
        const user = users.find((candidate: User) => candidate.id === userId)
        if (user) {
          setUser(user)
        } else {
          // 無効なトークンの場合は削除
          await window.electronAPI.clearAuthToken()
          setUser(null)
        }
      } else {
        // トークンがない場合は明示的にnullに設定
        setUser(null)
      }
    } catch (error) {
      console.error("Auth check failed:", error)
      await window.electronAPI.clearAuthToken()
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  const quickLogin = async (selectedUser: User) => {
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
