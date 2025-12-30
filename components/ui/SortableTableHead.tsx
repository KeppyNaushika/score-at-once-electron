"use client"

import * as React from "react"
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import type { SortDirection } from "@/hooks/useTableSort"

interface SortableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortKey: string
  currentSortKey: string | null
  currentDirection: SortDirection
  onSort: (key: string) => void
  children: React.ReactNode
}

/**
 * ソート可能なテーブルヘッダーセル
 * クリックでソート方向を切り替え、矢印アイコンで状態を表示
 */
export function SortableTableHead({
  sortKey,
  currentSortKey,
  currentDirection,
  onSort,
  children,
  className,
  ...props
}: SortableTableHeadProps) {
  const isActive = currentSortKey === sortKey
  const direction = isActive ? currentDirection : null

  const handleClick = () => {
    onSort(sortKey)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onSort(sortKey)
    }
  }

  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground h-12 px-4 text-left align-middle font-medium whitespace-nowrap",
        "bg-card first:rounded-tl-lg last:rounded-tr-lg",
        "hover:bg-muted/60 cursor-pointer transition-colors select-none",
        "[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="columnheader"
      aria-sort={
        direction === "asc"
          ? "ascending"
          : direction === "desc"
            ? "descending"
            : "none"
      }
      {...props}
    >
      <div className="flex items-center gap-1.5">
        <span>{children}</span>
        <SortIndicator direction={direction} isActive={isActive} />
      </div>
    </th>
  )
}

interface SortIndicatorProps {
  direction: SortDirection
  isActive: boolean
}

function SortIndicator({ direction, isActive }: SortIndicatorProps) {
  if (!isActive || direction === null) {
    return (
      <ChevronsUpDown className="text-muted-foreground/50 h-4 w-4 transition-opacity" />
    )
  }

  if (direction === "asc") {
    return <ChevronUp className="text-foreground h-4 w-4" />
  }

  return <ChevronDown className="text-foreground h-4 w-4" />
}

export { SortableTableHead as default }
