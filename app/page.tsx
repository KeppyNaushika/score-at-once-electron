"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { useAuth } from "@/contexts/AuthContext"

const Page = () => {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.push("/exams")
      } else {
        router.push("/login")
      }
    }
  }, [user, isLoading, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100">
      <div className="space-y-4 text-center">
        <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
        <div className="space-y-2">
          <p className="text-lg font-medium text-gray-700">自動ログイン中...</p>
          <p className="text-sm text-gray-500">
            保存されたユーザー情報を確認しています
          </p>
        </div>
        <div className="flex items-center justify-center space-x-1">
          <div className="h-2 w-2 animate-bounce rounded-full bg-blue-500"></div>
          <div
            className="h-2 w-2 animate-bounce rounded-full bg-blue-500"
            style={{ animationDelay: "0.1s" }}
          ></div>
          <div
            className="h-2 w-2 animate-bounce rounded-full bg-blue-500"
            style={{ animationDelay: "0.2s" }}
          ></div>
        </div>
      </div>
    </div>
  )
}

export default Page
