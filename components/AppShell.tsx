"use client"

import React, { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import Navigation from "@/components/Navigation"
import { SonnerToaster } from "@/components/SonnerToaster"

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false)
  const pathname = usePathname()

  const toggleSidebar = () => {
    setIsSidebarMinimized(!isSidebarMinimized)
  }

  useEffect(() => {
    if (pathname.includes("/score")) {
      setIsSidebarMinimized(true)
    } else {
      // setIsSidebarMinimized(false); // 必要に応じて
    }
  }, [pathname])

  return (
    <div className="flex min-h-screen">
      <Navigation
        isSidebarMinimized={isSidebarMinimized}
        toggleSidebar={toggleSidebar}
        setIsSidebarMinimized={setIsSidebarMinimized}
      />
      <main
        className={cn(
          "flex-1 overflow-auto pt-0 transition-[padding-left] duration-300 ease-in-out",
          isSidebarMinimized ? "pl-16" : "pl-64",
        )}
      >
        {children}
      </main>
      <SonnerToaster />
    </div>
  )
}
