"use client"

import { usePathname } from "next/navigation"
import React, { useEffect, useState } from "react"

import { ScreenBlackout } from "@/components/common/ScreenBlackout"
import { ToastProvider } from "@/components/common/ToastProvider"
import Navigation from "@/components/layout/Navigation"
import { cn } from "@/lib/utils"

export const SIDEBAR_BEHAVIOR_KEY = "sidebarBehaviorOnWorkPage"
export type SidebarBehavior = "collapse" | "expand" | "none"

function getSidebarBehavior(): SidebarBehavior {
  try {
    const stored = localStorage.getItem(SIDEBAR_BEHAVIOR_KEY)
    if (stored === "collapse" || stored === "expand" || stored === "none") {
      return stored
    }
  } catch {
    // ignore
  }
  return "collapse"
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false)
  const pathname = usePathname()

  const toggleSidebar = () => {
    setIsSidebarMinimized((prev) => !prev)
  }

  useEffect(() => {
    if (
      !pathname.includes("/score") &&
      !pathname.includes("/answer-sheet-builder")
    ) {
      return
    }

    const behavior = getSidebarBehavior()
    if (behavior === "none") return

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
