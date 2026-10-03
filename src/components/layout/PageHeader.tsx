"use client"

import { List } from "lucide-react"
import type { ReactNode } from "react"

import { GuardedLink } from "@/components/common/GuardedLink"
import {
  OverflowToolbar,
  type ToolbarAction,
} from "@/components/common/OverflowToolbar"
import { TooltipButton } from "@/components/common/TooltipButton"
import { usePageHelp } from "@/components/help/usePageHelp"
import { HistoryNavButtons } from "@/components/layout/HistoryNavButtons"

interface PageHeaderProps {
  title: string
  /** 題のすぐ右に小さく添える（件数・学級番号・学籍番号など）。畳まない */
  subtitle?: ReactNode
  /** 詳細画面のとき、親の一覧。「一覧へ戻る」を出す */
  listHref?: string
  /** 右に並べる操作。幅が足りなければ優先度の低いものから「…」へ畳む */
  actions?: ToolbarAction[]
}

/**
 * 段の無いページのヘッダー。一覧（`EntityListPage`）もこれを被る。
 *
 * **1行で、左から「どこへ行けるか（戻る／進む・一覧）→ いま何を見ているか → 操作
 * → 使い方」と並ぶ。** 段のある詳細画面の `WorkflowTabHeader` の上段と同じ姿。
 * 以前は段の無いページだけ題を大きく2行で出し、操作は本文の上に別の帯で置いて
 * いたので、サイドバーで画面を移るたびにヘッダーの高さと操作の位置が変わっていた。
 *
 * 「使い方」は URL から引く（無いページでは出ない）。呼び手ごとに渡す形だと、
 * 渡し忘れたページだけ使い方が出ない。
 */
export default function PageHeader({
  title,
  subtitle,
  listHref,
  actions = [],
}: PageHeaderProps) {
  const { helpButton } = usePageHelp()

  return (
    <header className="flex shrink-0 items-center gap-2 border-b bg-background px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex shrink-0 items-center gap-0.5">
          <HistoryNavButtons />
          {listHref && (
            <TooltipButton
              label="一覧へ戻る"
              variant="ghost"
              size="icon"
              className="size-7"
              asChild
            >
              <GuardedLink href={listHref}>
                <List />
              </GuardedLink>
            </TooltipButton>
          )}
        </div>
        <h1 className="shrink-0 truncate text-sm font-semibold">{title}</h1>
        {subtitle !== undefined && (
          <div className="flex min-w-0 items-center gap-2 overflow-hidden text-xs whitespace-nowrap text-muted-foreground">
            {subtitle}
          </div>
        )}
      </div>
      {actions.length > 0 ? (
        <OverflowToolbar actions={actions} />
      ) : (
        <div className="flex-1" />
      )}
      {/* 「使い方」は畳まない。読み方が分からないときに真っ先に隠れると詰む */}
      {helpButton !== null && <div className="shrink-0">{helpButton}</div>}
    </header>
  )
}
