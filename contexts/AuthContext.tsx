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
  login: (username: string, password: string) => Promise<boolean>
  quickLogin: (user: User) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const userId = localStorage.getItem("authToken")
      if (userId) {
        // userIdから直接ユーザー情報を取得
        const users = await window.electronAPI.fetchUsers()
        const user = users.find((u: User) => u.id === userId)
        if (user) {
          setUser(user)
        } else {
          localStorage.removeItem("authToken")
          setUser(null)
        }
      }
    } catch (error) {
      console.error("Auth check failed:", error)
      localStorage.removeItem("authToken")
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (
    username: string,
    password: string,
  ): Promise<boolean> => {
    try {
      const result = await window.electronAPI.loginUser(username, password)

      if (result.success && result.user && result.token) {
        localStorage.setItem("authToken", result.token)
        setUser(result.user)
        toast.success("ログインしました")
        router.push("/dashboard")
        return true
      } else {
        toast.error(result.error || "ログインに失敗しました")
        return false
      }
    } catch (error) {
      console.error("Login failed:", error)
      toast.error("ログインに失敗しました")
      return false
    }
  }

  const quickLogin = async (selectedUser: User) => {
    try {
      // パスワード不要のクイックログイン
      setUser(selectedUser)
      // 簡易トークンとして user.id を保存
      localStorage.setItem("authToken", selectedUser.id)
      toast.success(`${selectedUser.name}さん、おかえりなさい！`)
      router.push("/dashboard")
    } catch (error) {
      console.error("Quick login failed:", error)
      toast.error("ログインに失敗しました")
    }
  }

  const logout = () => {
    localStorage.removeItem("authToken")
    setUser(null)
    toast.success("ログアウトしました")
    router.push("/")
  }

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, quickLogin, logout, checkAuth }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
