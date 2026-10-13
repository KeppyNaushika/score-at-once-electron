"use client"

import {
  BookA,
  Bot,
  ChartColumn,
  ClipboardList,
  FileArchive,
  FilePen,
  FileStack,
  Info,
  Layers,
  ListTree,
  LogIn,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  PencilSparkles,
  RotateCcwClock,
  School,
  Settings,
  Tag,
  User,
  Users,
} from "lucide-react"
import { usePathname } from "next/navigation"
import { Fragment } from "react"

import { ExperimentalBadge } from "@/components/common/ExperimentalBadge"
import { GuardedLink } from "@/components/common/GuardedLink"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useAuth } from "@/contexts/AuthContext"
import { useIsWebRuntime } from "@/hooks/useIsWebRuntime"

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  /** 研究・実験のための機能。名前の横に「実験的」の印を置く（AI採点。設計 §10-1） */
  isExperimental?: boolean
  /**
   * web 版では出さない（デスクトップ版でだけ動く機能）。AI採点は API キーを暗号化して
   * 保存できず、事業者への通信もブラウザからは通らない（docs/web-version-plan.md の判断待ち）
   */
  isDesktopOnly?: boolean
}

/** 読み上げ・ツールチップの名前（実験的機能なら「（実験的）」を添える） */
function navItemAccessibleName(navItem: NavItem): string {
  return navItem.isExperimental ? `${navItem.label}（実験的）` : navItem.label
}

const navGroups: NavItem[][] = [
  [
    { href: "/answer-sheet-builder", label: "解答用紙作成", icon: FilePen },
    { href: "/exams", label: "試験", icon: PencilSparkles },
    { href: "/coursework", label: "試験外成績資料", icon: ClipboardList },
    { href: "/grades", label: "成績算出", icon: ChartColumn },
  ],
  [{ href: "/pdf-tools", label: "PDF加工", icon: FileStack }],
  [
    { href: "/students", label: "生徒管理", icon: Users },
    { href: "/classrooms", label: "学級管理", icon: School },
    { href: "/subtotal-groups", label: "小計点管理", icon: ListTree },
    { href: "/score-scales", label: "類型表管理", icon: Layers },
    { href: "/tags", label: "タグ管理", icon: Tag },
  ],
  [{ href: "/data-export", label: "データ書き出し", icon: FileArchive }],
  [
    { href: "/settings", label: "設定", icon: Settings },
    {
      href: "/ai-grading",
      label: "AI採点",
      icon: Bot,
      isExperimental: true,
      isDesktopOnly: true,
    },
    { href: "/audit-logs", label: "操作履歴", icon: RotateCcwClock },
    { href: "/glossary", label: "用語集", icon: BookA },
    { href: "/about", label: "一括採点について", icon: Info },
  ],
]

export default function Navigation() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const isWebRuntime = useIsWebRuntime()
  const { state, isMobile, toggleSidebar, setOpenMobile } = useSidebar()
  // 狭い窓の引き出しは、開いていれば常に名前まで見せる（畳んだ状態は無い）
  const isCollapsed = !isMobile && state === "collapsed"

  // 引き出しは、ページを移ったら閉じる（開いたままだと移った先の本文を覆い続ける）
  const closeMobileSidebar = () => setOpenMobile(false)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 flex-row items-center border-b">
        {/* 戻る/進むはここに置いていたが、詳細画面のヘッダー（WorkflowTabHeader）の
            クイックアクセスツールバーへ移した。同じ導線を2か所から出さない */}
        <GuardedLink
          href="/exams"
          onClick={closeMobileSidebar}
          className="min-w-0 flex-1 truncate px-2 text-lg font-semibold group-data-[collapsible=icon]:hidden"
        >
          一括採点
        </GuardedLink>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={toggleSidebar}
        >
          {isCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          <span className="sr-only">
            {isCollapsed ? "サイドバーを開く" : "サイドバーを閉じる"}
          </span>
        </Button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          {navGroups.map((group, groupIndex) => (
            <Fragment key={groupIndex}>
              {groupIndex > 0 && <SidebarSeparator className="mx-0 my-1" />}
              <SidebarMenu>
                {group
                  .filter((navItem) => !(isWebRuntime && navItem.isDesktopOnly))
                  .map((navItem) => {
                    const isActive = pathname === navItem.href
                    return (
                      <SidebarMenuItem key={navItem.label}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={navItemAccessibleName(navItem)}
                          className={
                            navItem.isExperimental ? "pr-16" : undefined
                          }
                        >
                          <GuardedLink
                            href={navItem.href}
                            onClick={closeMobileSidebar}
                            aria-label={
                              navItem.isExperimental
                                ? navItemAccessibleName(navItem)
                                : undefined
                            }
                          >
                            <navItem.icon />
                            <span>{navItem.label}</span>
                          </GuardedLink>
                        </SidebarMenuButton>
                        {navItem.isExperimental && (
                          <SidebarMenuBadge className="top-1.5">
                            <ExperimentalBadge
                              label="実験的"
                              tone={isActive ? "default" : "muted"}
                              className="px-1.5 py-0 text-[10px]"
                            />
                          </SidebarMenuBadge>
                        )}
                      </SidebarMenuItem>
                    )
                  })}
              </SidebarMenu>
            </Fragment>
          ))}
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          {user ? (
            <>
              <SidebarMenuItem>
                {/* ボタンではないので SidebarMenuButton は使わず、ツールチップだけ同じ出し方にする。
                    畳んでも高さは変えない（変えると下のログアウトが跳ねる） */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex h-12 items-center gap-2 overflow-hidden rounded-md p-2 text-sm group-data-[collapsible=icon]:w-8">
                      <User className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {user.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {user.username}
                        </span>
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" hidden={!isCollapsed}>
                    {`${user.name} (${user.username})`}
                  </TooltipContent>
                </Tooltip>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="ログアウト" onClick={logout}>
                  <LogOut />
                  <span>ログアウト</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          ) : (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/"}
                tooltip="ログイン"
              >
                <GuardedLink href="/" onClick={closeMobileSidebar}>
                  <LogIn />
                  <span>ログイン</span>
                </GuardedLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
