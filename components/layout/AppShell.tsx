"use client"

import { ToastProvider } from "@/components/common/ToastProvider"
import Navigation from "@/components/layout/Navigation"
import { cn } from "@/lib/utils"
import { usePathname } from "next/navigation"
import React, { useEffect, useState } from "react"

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false)
  const pathname = usePathname()

  const toggleSidebar = () => {
    setIsSidebarMinimized((prev) => !prev)
  }

  useEffect(() => {
    if (!pathname.includes("/score")) {
      return
    }

    const frame = requestAnimationFrame(() => {
      setIsSidebarMinimized(true)
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
    </div>
  )
}
