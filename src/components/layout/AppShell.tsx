"use client"

import { usePathname } from "next/navigation"
import React, { useEffect, useMemo, useRef, useState } from "react"

import { ToastProvider } from "@/components/common/ToastProvider"
import Navigation from "@/components/layout/Navigation"
import {
  findSidebarSection,
  type SidebarBehavior,
  type SidebarSectionConfig,
  useSidebarBehavior,
} from "@/components/layout/sidebarBehavior"
import { useAuth } from "@/contexts/AuthContext"
import { cn } from "@/lib/utils"

/**
 * 設定をサイドバーの開閉へ押し出す。描くものは無い。
 *
 * **この枠（AppShell）は関門の外にある**ので、利用者が決まっていない窓（ログイン画面・
 * 認証の復元中）がある。設定は利用者に付いているので、決まってから読む——それを
 * 「利用者と区分が揃ったときだけ載せる」という形で表した。詰め物の `userId ?? ""` を
 * 置かずに済み、区分の外へ出れば載らない（＝戻ってきたら押し出し直す）も同じ形で出る。
 */
function SidebarBehaviorApplier({
  userId,
  section,
  setIsSidebarMinimized,
}: {
  userId: string
  section: SidebarSectionConfig
  setIsSidebarMinimized: (isMinimized: boolean) => void
}) {
  const { behavior } = useSidebarBehavior(userId, section)
  const appliedRef = useRef<{
    sectionKey: string
    behavior: SidebarBehavior
  } | null>(null)

  // 区分が変わったときと、設定が変わったときだけ効かせる（設定の取得は非同期なので、
  // 初回は「読めた」時点がここに当たる）。同じ区分の中の遷移では動かさないので、
  // 利用者が手で開き直した状態は保たれる。
  useEffect(() => {
    const sectionKey = section.key
    const applied = appliedRef.current
    if (applied?.sectionKey === sectionKey && applied.behavior === behavior) {
      return
    }
    if (behavior === "none") {
      appliedRef.current = { sectionKey, behavior }
      return
    }

    // 押し出せたときに「押し出した」と記録する（途中で取り消されたら記録も残さない）
    const frame = requestAnimationFrame(() => {
      appliedRef.current = { sectionKey, behavior }
      setIsSidebarMinimized(behavior === "collapse")
    })

    return () => cancelAnimationFrame(frame)
  }, [behavior, section, setIsSidebarMinimized])

  return null
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false)
  const pathname = usePathname()
  const section = useMemo(() => findSidebarSection(pathname), [pathname])
  const { user } = useAuth()

  const toggleSidebar = () => {
    setIsSidebarMinimized((prev) => !prev)
  }

  return (
    <div className="flex h-screen">
      {user !== null && section !== null && (
        <SidebarBehaviorApplier
          userId={user.id}
          section={section}
          setIsSidebarMinimized={setIsSidebarMinimized}
        />
      )}
      <Navigation
        isSidebarMinimized={isSidebarMinimized}
        toggleSidebar={toggleSidebar}
        setIsSidebarMinimized={setIsSidebarMinimized}
      />
      <main
        className={cn(
          "flex-1 overflow-auto pt-0 transition-[padding-left] duration-300 ease-in-out",
          isSidebarMinimized ? "pl-16" : "pl-64"
        )}
      >
        {children}
      </main>
      <ToastProvider />
    </div>
  )
}
