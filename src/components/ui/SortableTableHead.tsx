"use client"

import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react"
import * as React from "react"

import type { SortDirection } from "@/hooks/useTableSort"
import { cn } from "@/lib/utils"

interface SortableTableHeadProps<
  K extends string = string,
> extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortKey: K
  currentSortKey: string | null
  currentDirection: SortDirection
  onSort: (key: K) => void
  children: React.ReactNode
}

/**
 * ソート可能なテーブルヘッダーセル
 * クリックでソート方向を切り替え、矢印アイコンで状態を表示
 */
export function SortableTableHead<K extends string = string>({
  sortKey,
  currentSortKey,
  currentDirection,
  onSort,
  children,
  className,
  ...props
}: SortableTableHeadProps<K>) {
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
        "h-12 px-4 text-left align-middle font-medium whitespace-nowrap text-foreground",
        "bg-card first:rounded-tl-lg last:rounded-tr-lg",
        "cursor-pointer transition-colors select-none hover:bg-muted/60",
        "has-[[role=checkbox]]:pr-0 *:[[role=checkbox]]:translate-y-0.5",
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
      <ChevronsUpDown className="h-4 w-4 text-muted-foreground/50 transition-opacity" />
    )
  }

  if (direction === "asc") {
    return <ChevronUp className="h-4 w-4 text-foreground" />
  }

  return <ChevronDown className="h-4 w-4 text-foreground" />
}

export { SortableTableHead as default }
