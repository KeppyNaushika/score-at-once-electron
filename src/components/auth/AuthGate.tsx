"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"

import { useAuth } from "@/contexts/AuthContext"

/**
 * ログインしていなければ中身を描かない関門。
 *
 * **全ページを1つで包む。** 以前はページごとに置いていたため、40ページ中16ページにしか
 * 付いておらず、試験のワークフローでは 06・07 と試験詳細だけが守られていた。守られて
 * いないページでは、保存の門番が「利用者が居ない」と判断して**黙って書き込みを捨てて
 * いた**。
 *
 * 実際に踏むのは未ログインより「**認証ストアからの復元がまだ終わっていない窓**」で、
 * これはログイン済みの利用者でもページを開くたびに通る。`isLoading` の間は中身を描かない
 * ことで、その窓で操作させない。
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // ログイン画面と、その振り分けをする入口は素通しする（でないと戻り先を失う）
  const isPublic = pathname === "/login" || pathname === "/"

  useEffect(() => {
    if (isPublic || isLoading || user) return
    router.push("/login")
  }, [isPublic, isLoading, user, router])

  if (isPublic) return <>{children}</>

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return <>{children}</>
}
