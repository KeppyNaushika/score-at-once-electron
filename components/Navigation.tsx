"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import {
  Home,
  LayoutDashboard,
  Settings,
  LogIn,
  LogOut,
  Users,
  FileText,
  ChevronsLeft,
  ChevronsRight,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import React from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const navItems = [
  { href: "/", label: "プロジェクト一覧", icon: Home }, // "プロジェクト" から "プロジェクト一覧" へ変更
  { href: "/dashboard", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/students", label: "生徒管理", icon: Users },
  { href: "/settings", label: "設定", icon: Settings },
]

interface NavigationProps {
  isSidebarMinimized: boolean
  toggleSidebar: () => void
  setIsSidebarMinimized: (isMinimized: boolean) => void
}

export default function Navigation({
  isSidebarMinimized,
  toggleSidebar,
}: NavigationProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  return (
    <aside
      className={cn(
        "bg-background fixed top-0 left-0 z-40 flex h-screen flex-col border-r transition-[width] duration-300 ease-in-out",
        isSidebarMinimized ? "w-16" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center border-b px-2",
          isSidebarMinimized ? "justify-center" : "justify-between px-6",
        )}
      >
        {!isSidebarMinimized && (
          <Link href="/" className="text-lg font-semibold">
            一括採点
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={cn(isSidebarMinimized ? "mx-auto" : "")}
        >
          {isSidebarMinimized ? (
            <ChevronsRight className="h-5 w-5" />
          ) : (
            <ChevronsLeft className="h-5 w-5" />
          )}
          <span className="sr-only">
            {isSidebarMinimized ? "サイドバーを開く" : "サイドバーを閉じる"}
          </span>
        </Button>
      </div>
      <ScrollArea className="flex-1 py-4">
        <TooltipProvider delayDuration={0}>
          <nav className="grid items-start gap-1 px-2">
            {navItems.map((item) =>
              isSidebarMinimized ? (
                <Tooltip key={item.label}>
                  <TooltipTrigger asChild>
                    <Link href={item.href} passHref>
                      <Button
                        variant={pathname === item.href ? "secondary" : "ghost"}
                        size="icon"
                        className="w-full justify-center"
                        aria-label={item.label}
                      >
                        <item.icon className="h-5 w-5" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={5}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Link key={item.label} href={item.href} passHref>
                  <Button
                    variant={pathname === item.href ? "secondary" : "ghost"}
                    className="w-full justify-start"
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.label}
                  </Button>
                </Link>
              ),
            )}
          </nav>
        </TooltipProvider>
      </ScrollArea>
      <div
        className={cn("mt-auto border-t p-2", isSidebarMinimized ? "" : "p-4")}
      >
        {user ? (
          <>
            {isSidebarMinimized ? (
              <div className="space-y-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex justify-center">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={5}>
                    {user.name} ({user.username})
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-full justify-center"
                      onClick={logout}
                      aria-label="ログアウト"
                    >
                      <LogOut className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={5}>
                    ログアウト
                  </TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-2 py-1">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 truncate text-sm">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.username}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={logout}
                >
                  <LogOut className="mr-3 h-5 w-5" />
                  ログアウト
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            {isSidebarMinimized ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/login" passHref>
                    <Button
                      variant={pathname === "/login" ? "secondary" : "ghost"}
                      size="icon"
                      className="w-full justify-center"
                      aria-label="ログイン"
                    >
                      <LogIn className="h-5 w-5" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={5}>
                  ログイン
                </TooltipContent>
              </Tooltip>
            ) : (
              <Link href="/login" passHref>
                <Button
                  variant={pathname === "/login" ? "secondary" : "ghost"}
                  className="w-full justify-start"
                >
                  <LogIn className="mr-3 h-5 w-5" />
                  ログイン
                </Button>
              </Link>
            )}
          </>
        )}
      </div>
    </aside>
  )
}
