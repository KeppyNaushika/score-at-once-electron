"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { useAuth } from "@/contexts/AuthContext"

/**
 * ログインしていなければ中身を描かない関門。
 *
 * 置き場所は `app/(app)/layout.tsx` の1箇所だけで、**守る範囲はファイルの置き場所が
 * 決める**。以前はページごとに置いていたため 40ページ中16ページにしか付いておらず、
 * 守られていないページでは保存の門番が「利用者が居ない」と判断して**黙って書き込みを
 * 捨てていた**。
 *
 * 実際に踏むのは未ログインより「**認証ストアからの復元がまだ終わっていない窓**」で、
 * これはログイン済みの利用者でもページを開くたびに通る。`isLoading` の間は中身を
 * 描かないことで、その窓で操作させない。
 *
 * これは秘匿の境界ではない。DB ファイルは全員の手元にあり、アプリを経由せず読める
 * （`docs/scoring-scope-and-permissions-design.md`）。書き込みを本当に止めるのは
 * main 側の担当者ガードで、ここは導線を整える役だけを負う。
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading || user) return
    router.push("/login")
  }, [isLoading, user, router])

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
