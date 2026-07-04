"use client"

import { usePathname } from "next/navigation"
import React, { useEffect, useRef, useState } from "react"

import { ScreenBlackout } from "@/components/common/ScreenBlackout"
import { ToastProvider } from "@/components/common/ToastProvider"
import Navigation from "@/components/layout/Navigation"
import { cn } from "@/lib/utils"

export type SidebarBehavior = "collapse" | "expand" | "none"

export interface SidebarSectionConfig {
  key: string
  label: string
  storageKey: string
  pathMatch: (pathname: string) => boolean
}

export const SIDEBAR_SECTIONS: SidebarSectionConfig[] = [
  {
    key: "exams",
    label: "試験一覧",
    storageKey: "sidebarBehavior_exams",
    pathMatch: (path) => path.startsWith("/exams"),
  },
  {
    key: "answerSheetBuilder",
    label: "解答用紙作成",
    storageKey: "sidebarBehavior_answerSheetBuilder",
    pathMatch: (path) => path.startsWith("/answer-sheet-builder"),
  },
  {
    key: "pdfTools",
    label: "PDF加工",
    storageKey: "sidebarBehavior_pdfTools",
    pathMatch: (path) => path.startsWith("/pdf-tools"),
  },
  {
    key: "grades",
    label: "成績算出",
    storageKey: "sidebarBehavior_grades",
    pathMatch: (path) => path.startsWith("/grades"),
  },
]

// 旧キーからの移行用
const LEGACY_SIDEBAR_BEHAVIOR_KEY = "sidebarBehaviorOnWorkPage"

function getSidebarBehaviorForPath(pathname: string): SidebarBehavior | null {
  const section = SIDEBAR_SECTIONS.find((sidebarSection) =>
    sidebarSection.pathMatch(pathname)
  )
  if (!section) return null

  try {
    const stored = localStorage.getItem(section.storageKey)
    if (stored === "collapse" || stored === "expand" || stored === "none") {
      return stored
    }
    // 旧設定からの移行: セクション別設定がなければ旧設定を参照
    const legacy = localStorage.getItem(LEGACY_SIDEBAR_BEHAVIOR_KEY)
    if (legacy === "collapse" || legacy === "expand" || legacy === "none") {
      return legacy
    }
  } catch {
    // ignore
  }
  return "none"
}

function getCurrentSectionKey(pathname: string): string | null {
  const section = SIDEBAR_SECTIONS.find((sidebarSection) =>
    sidebarSection.pathMatch(pathname)
  )
  return section?.key ?? null
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false)
  const pathname = usePathname()
  const prevSectionRef = useRef<string | null>(null)

  const toggleSidebar = () => {
    setIsSidebarMinimized((prev) => !prev)
  }

  useEffect(() => {
    const currentSection = getCurrentSectionKey(pathname)

    // 同じセクション内の遷移では何もしない
    if (currentSection === prevSectionRef.current) return
    prevSectionRef.current = currentSection

    const behavior = getSidebarBehaviorForPath(pathname)
    if (behavior === null || behavior === "none") return

    const frame = requestAnimationFrame(() => {
      setIsSidebarMinimized(behavior === "collapse")
    })

    return () => cancelAnimationFrame(frame)
  }, [pathname])

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
      <ScreenBlackout />
    </div>
  )
}
