"use client"

import { usePathname } from "next/navigation"
import React, { useEffect, useMemo, useRef, useState } from "react"

import { ToastProvider } from "@/components/common/ToastProvider"
import Navigation from "@/components/layout/Navigation"
import {
  findSidebarSection,
  type SidebarBehavior,
  useSidebarBehavior,
} from "@/components/layout/sidebarBehavior"
import { cn } from "@/lib/utils"

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false)
  const pathname = usePathname()
  const section = useMemo(() => findSidebarSection(pathname), [pathname])
  const { behavior } = useSidebarBehavior(section)
  const appliedRef = useRef<{
    sectionKey: string | null
    behavior: SidebarBehavior
  } | null>(null)

  const toggleSidebar = () => {
    setIsSidebarMinimized((prev) => !prev)
  }

  // 設定をサイドバーの開閉へ押し出す。区分が変わったときと、設定が変わったときだけ効かせる
  // （事前描画では設定を読めないので、初回は「読めた」時点がここに当たる）。
  // 同じ区分の中の遷移では動かさないので、利用者が手で開き直した状態は保たれる。
  useEffect(() => {
    const sectionKey = section?.key ?? null
    const applied = appliedRef.current
    if (applied?.sectionKey === sectionKey && applied.behavior === behavior) {
      return
    }
    if (sectionKey === null || behavior === "none") {
      appliedRef.current = { sectionKey, behavior }
      return
    }

    // 押し出せたときに「押し出した」と記録する（途中で取り消されたら記録も残さない）
    const frame = requestAnimationFrame(() => {
      appliedRef.current = { sectionKey, behavior }
      setIsSidebarMinimized(behavior === "collapse")
    })

    return () => cancelAnimationFrame(frame)
  }, [behavior, section])

  return (
    <div className="flex h-screen">
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
