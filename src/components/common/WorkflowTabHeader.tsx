"use client"

import { ArrowLeft } from "lucide-react"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

import { GuardedLink } from "@/components/common/GuardedLink"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * 段のタブ1枚。
 *
 * `path` は実体のURLに継ぐ残りで、先頭の `/` を含む（例: `/01-upload`）。
 * 概要だけは実体そのもののURLなので空文字になる。
 */
export interface WorkflowTab {
  id: string
  label: string
  path: string
}

interface WorkflowTabHeaderProps {
  /** 一覧のURL。パンくずの1つ目と「一覧へ戻る」の行き先を兼ねる */
  listHref: string
  /** 一覧の名前。サイドバーの項目名と揃える */
  listLabel: string
  /** いま開いている実体の名前 */
  entityName: string
  /** 実体のURL。各タブの行き先はこれに `WorkflowTab.path` を継いで作る */
  entityHref: string
  tabs: readonly WorkflowTab[]
  /** 「一覧へ戻る」の左に置く、そのワークフロー固有の操作 */
  actions?: ReactNode
}

/**
 * 段のあるワークフローの詳細画面が共通で被るヘッダー。
 *
 * 上段が `一覧の名前 › 実体の名前` のパンくずと操作、下段が段のタブ。
 * 段はパンくず（`›` で連なる道筋）ではなくタブで並べる。段は上流から下流へ
 * 一本道に見えるが、実際はどの段へも行き来できる**兄弟**であって、
 * いま居る段の親ではないため。
 *
 * タブは必ず `GuardedLink` を通す。書きかけを抱えた画面から段を移ると
 * 黙って捨てることになるので、離脱の確認を挟む口を1つに保つ。
 */
export function WorkflowTabHeader({
  listHref,
  listLabel,
  entityName,
  entityHref,
  tabs,
  actions,
}: WorkflowTabHeaderProps) {
  const pathname = usePathname()

  return (
    <header className="shrink-0 border-b bg-background">
      <div className="flex items-center justify-between gap-4 px-4 pt-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <GuardedLink href={listHref}>{listLabel}</GuardedLink>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{entityName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex items-center gap-2">
          {actions}
          <Button variant="ghost" size="sm" asChild>
            <GuardedLink href={listHref}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              一覧へ戻る
            </GuardedLink>
          </Button>
        </div>
      </div>
      {/* 試験は概要込みで9枚並ぶ。窓が狭いときはタブ列だけを横に流す */}
      <nav
        aria-label="ワークフローの段"
        className="flex gap-1 overflow-x-auto px-4 pt-1"
      >
        {tabs.map((tab) => {
          const tabHref = entityHref + tab.path
          // 現在地はパスの完全一致で決める。部分一致では概要（path が空文字）が
          // どのページにも当たってしまい、段のページでも概要が光る。
          // 段どうしでも、片方の path が他方の先頭に重なれば同じ取り違えが起きる
          const isCurrent = pathname === tabHref
          return (
            <GuardedLink
              key={tab.id}
              href={tabHref}
              aria-current={isCurrent ? "page" : undefined}
              className={cn(
                "border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
                isCurrent
                  ? "border-green-600 font-semibold text-green-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </GuardedLink>
          )
        })}
      </nav>
    </header>
  )
}
