'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

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
  logout: () => void
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // Check authentication on mount
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('authToken')
      if (token) {
        const result = await window.electronAPI.getUserByToken(token)
        if (result.success && result.user) {
          setUser(result.user)
        } else {
          localStorage.removeItem('authToken')
          setUser(null)
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      localStorage.removeItem('authToken')
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const result = await window.electronAPI.loginUser(username, password)
      
      if (result.success && result.user && result.token) {
        localStorage.setItem('authToken', result.token)
        setUser(result.user)
        toast.success('ログインしました')
        router.push('/dashboard')
        return true
      } else {
        toast.error(result.error || 'ログインに失敗しました')
        return false
      }
    } catch (error) {
      console.error('Login failed:', error)
      toast.error('ログインに失敗しました')
      return false
    }
  }

  const logout = () => {
    localStorage.removeItem('authToken')
    setUser(null)
    toast.success('ログアウトしました')
    router.push('/login')
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}