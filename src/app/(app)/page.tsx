"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

/**
 * 入口。**行き先は試験一覧の1つだけ。**
 *
 * ここは関門（`AuthGate`）の内側なので、描かれている時点で利用者は居る。
 * 以前は未ログインなら `/login` へ振り分けていたが、その枝は関門が先に
 * 引き受けるので一度も通らない。
 */
const Page = () => {
  const router = useRouter()

  useEffect(() => {
    router.push("/exams")
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100">
      <div className="space-y-4 text-center">
        <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
        <div className="space-y-2">
          <p className="text-lg font-medium text-gray-700">
            試験一覧へ移動しています...
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
