"use client"

import {
  BookA,
  Bot,
  ChartColumn,
  ClipboardList,
  FileArchive,
  FilePen,
  FileStack,
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
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useAuth } from "@/contexts/AuthContext"
import { useIsWebRuntime } from "@/hooks/useIsWebRuntime"
import { cn } from "@/lib/utils"

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  /** 研究・実験のための機能。名前の横に「実験的」の印を置く（AI 採点。設計 §10-1） */
  isExperimental?: boolean
  /**
   * web 版では出さない（デスクトップ版でだけ動く機能）。AI 採点は API キーを暗号化して
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
    { href: "/exams", label: "試験一覧", icon: PencilSparkles },
    { href: "/coursework", label: "試験外成績資料", icon: ClipboardList },
    { href: "/grades", label: "成績算出", icon: ChartColumn },
  ],
  [{ href: "/pdf-tools", label: "PDF加工", icon: FileStack }],
  [
    { href: "/students", label: "生徒管理", icon: Users },
    { href: "/classrooms", label: "学級管理", icon: School },
    { href: "/subtotal-groups", label: "小計点管理", icon: ListTree },
    { href: "/score-scales", label: "類型評価管理", icon: Layers },
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
  ],
]

interface NavigationProps {
  isSidebarMinimized: boolean
  toggleSidebar: () => void
  setIsSidebarMinimized: (isMinimized: boolean) => void
}

/**
 * サイドバーの行のボタン。アイコンは開いていても畳んでいても左端から同じ位置に置く。
 *
 * 畳んだ幅（`w-16` = 64px）から帯の余白（`px-2`）とボタンの外余白（`mx-1.5`）を引くと、
 * 左端から 14px。そこに 36px（`w-9`）のボタンを置き、内余白 10px（`px-2.5`）で 16px の
 * アイコンを入れると、アイコンは畳んだ幅のちょうど中央に来る（アイコンの大きさは Button が
 * `size-4` に揃えるので、ここで `h-5 w-5` などを付けても効かない）。開いたときはボタンを
 * 行いっぱいに伸ばすだけで、左余白は変えないので、幅が動いている間もアイコンは動かない。
 * 畳んだときにボタンを正方形まで縮めるのは、ホバーや今いるページの色をアイコンの周りに
 * だけ付けるため（行いっぱいのままだと、細い帯に横長の色が付く）。
 *
 * 以前は開閉で「中央寄せのアイコンだけのボタン」と「左寄せの文字付きボタン」を
 * 差し替えていたため、切り替わった瞬間にアイコンが中央へ飛んでいた。
 */
function sidebarRowClassName(isSidebarMinimized: boolean): string {
  return cn(
    "mx-1.5 justify-start overflow-hidden has-[>svg]:px-2.5",
    isSidebarMinimized ? "w-9" : "w-[calc(100%-0.75rem)]"
  )
}

/** 名前は畳むと薄れて消える（幅の変化と同じ時間で）。読み上げには残る */
function SidebarLabel({
  isSidebarMinimized,
  className,
  children,
}: {
  isSidebarMinimized: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "transition-opacity duration-300 ease-in-out",
        isSidebarMinimized && "opacity-0",
        className
      )}
    >
      {children}
    </span>
  )
}

/**
 * 畳んでいる間だけ名前をツールチップで出す。
 *
 * 開閉で Tooltip を付け外しすると中のボタンが作り直されるので、Tooltip は常に
 * 置いて中身だけ出し分ける（`open` を開閉で切り替えると Radix が制御／非制御の
 * 切り替えを警告する）。
 */
function CollapsedTooltip({
  isSidebarMinimized,
  label,
  children,
}: {
  isSidebarMinimized: boolean
  label: string
  children: React.ReactElement
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      {isSidebarMinimized && (
        <TooltipContent side="right" sideOffset={5}>
          {label}
        </TooltipContent>
      )}
    </Tooltip>
  )
}

export default function Navigation({
  isSidebarMinimized,
  toggleSidebar,
}: NavigationProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const isWebRuntime = useIsWebRuntime()

  return (
    // 右の境界線は border でなく内側の影で引く。border だと 64px のうち 1px を取って中身が
    // 63px になり、アイコンのボタンの左右の余白が 14px と 13px に食い違う
    <aside
      className={cn(
        "fixed top-0 left-0 z-40 flex h-screen flex-col bg-background shadow-[inset_-1px_0_0_var(--color-border)] transition-[width] duration-300 ease-in-out",
        isSidebarMinimized ? "w-16" : "w-64"
      )}
    >
      {/* 開閉ボタンは右端から 14px に置く。畳んだ幅 64px ではそれがちょうど中央になる */}
      <div className="flex h-16 items-center border-b px-3.5">
        {/* 戻る/進むはここに置いていたが、詳細画面のヘッダー（WorkflowTabHeader）の
            クイックアクセスツールバーへ移した。同じ導線を2か所から出さない */}
        <SidebarLabel
          isSidebarMinimized={isSidebarMinimized}
          className="min-w-0 flex-1 truncate"
        >
          <span inert={isSidebarMinimized}>
            <GuardedLink href="/exams" className="text-lg font-semibold">
              一括採点
            </GuardedLink>
          </span>
        </SidebarLabel>
        <Button variant="ghost" size="icon" onClick={toggleSidebar}>
          {isSidebarMinimized ? <PanelLeftOpen /> : <PanelLeftClose />}
          <span className="sr-only">
            {isSidebarMinimized ? "サイドバーを開く" : "サイドバーを閉じる"}
          </span>
        </Button>
      </div>
      {/* 窓が低いとメニューが溢れるので、この帯だけ縦に流す。min-h-0 が無いと flex の子は
          中身の高さまで伸びて溢れ、流れない。横は流さない（開閉の途中は名前が帯より長く、
          横にスクロールできてしまう）。スクロールバーは globals.css の共通の細い見た目を使う */}
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto py-4">
        <TooltipProvider delayDuration={0}>
          <nav className="grid items-start gap-1 px-2">
            {navGroups.map((group, groupIndex) => (
              <Fragment key={groupIndex}>
                {groupIndex > 0 && <Separator className="my-1" />}
                {group
                  .filter((navItem) => !(isWebRuntime && navItem.isDesktopOnly))
                  .map((navItem) => (
                    <CollapsedTooltip
                      key={navItem.label}
                      isSidebarMinimized={isSidebarMinimized}
                      label={navItemAccessibleName(navItem)}
                    >
                      <GuardedLink href={navItem.href} passHref>
                        <Button
                          variant={
                            pathname === navItem.href ? "secondary" : "ghost"
                          }
                          className={sidebarRowClassName(isSidebarMinimized)}
                          aria-label={
                            navItem.isExperimental
                              ? navItemAccessibleName(navItem)
                              : undefined
                          }
                        >
                          <navItem.icon className="mr-3" />
                          <SidebarLabel isSidebarMinimized={isSidebarMinimized}>
                            {navItem.label}
                          </SidebarLabel>
                          {navItem.isExperimental && (
                            <ExperimentalBadge
                              label="実験的"
                              tone={
                                pathname === navItem.href ? "default" : "muted"
                              }
                              className={cn(
                                "ml-auto px-1.5 py-0 text-[10px] transition-opacity duration-300 ease-in-out",
                                isSidebarMinimized && "opacity-0"
                              )}
                            />
                          )}
                        </Button>
                      </GuardedLink>
                    </CollapsedTooltip>
                  ))}
              </Fragment>
            ))}
          </nav>
        </TooltipProvider>
      </div>
      <div className="mt-auto border-t p-2">
        {user ? (
          <div className="space-y-2">
            {/* 名前は畳んでも消さずに薄めるだけ。消すと行の高さが変わり、下のボタンが跳ねる */}
            <CollapsedTooltip
              isSidebarMinimized={isSidebarMinimized}
              label={`${user.name} (${user.username})`}
            >
              {/* ボタンではないので、アイコンの大きさと余白はボタンの行に手で合わせる */}
              <div className="flex items-center overflow-hidden px-4 py-1">
                <User className="mr-3 size-4 shrink-0 text-muted-foreground" />
                <SidebarLabel
                  isSidebarMinimized={isSidebarMinimized}
                  className="min-w-0 flex-1 truncate text-sm"
                >
                  <span className="block truncate font-medium">
                    {user.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {user.username}
                  </span>
                </SidebarLabel>
              </div>
            </CollapsedTooltip>
            <CollapsedTooltip
              isSidebarMinimized={isSidebarMinimized}
              label="ログアウト"
            >
              <Button
                variant="ghost"
                className={sidebarRowClassName(isSidebarMinimized)}
                onClick={logout}
              >
                <LogOut className="mr-3" />
                <SidebarLabel isSidebarMinimized={isSidebarMinimized}>
                  ログアウト
                </SidebarLabel>
              </Button>
            </CollapsedTooltip>
          </div>
        ) : (
          <CollapsedTooltip
            isSidebarMinimized={isSidebarMinimized}
            label="ログイン"
          >
            <GuardedLink href="/" passHref>
              <Button
                variant={pathname === "/" ? "secondary" : "ghost"}
                className={sidebarRowClassName(isSidebarMinimized)}
              >
                <LogIn className="mr-3" />
                <SidebarLabel isSidebarMinimized={isSidebarMinimized}>
                  ログイン
                </SidebarLabel>
              </Button>
            </GuardedLink>
          </CollapsedTooltip>
        )}
      </div>
    </aside>
  )
}
