"use client"

import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  ListFilter,
} from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import type { SortDirection } from "@/hooks/useTableSort"
import { cn } from "@/lib/utils"

/**
 * 列のあいだの区切り線。**見出しの高さいっぱいには引かない**（上下を少し空ける）。
 *
 * 置くのは列と列のあいだで、見出しの語とアイコンのあいだではない。後者に引くと、
 * 語とアイコンが別のものに見えてしまう —— セル全体が1つのボタンなので、実際は
 * どちらを押しても同じことが起きる。
 */
export function ColumnDivider() {
  return (
    <Separator
      orientation="vertical"
      className="my-2 data-[orientation=vertical]:h-8"
    />
  )
}

interface FilterableTableHeadProps<SortKey extends string> {
  /** 見出しの語 */
  label: string
  sortKey: SortKey
  currentSortKey: string | null
  currentDirection: SortDirection
  onSort: (sortKey: SortKey, direction: Exclude<SortDirection, null>) => void
  /** この列で絞り込んでいるか。アイコンの色に出る */
  isFiltered: boolean
  /** popover の下半分（列ごとに違う絞り込み） */
  children: ReactNode
  /** popover の幅。既定は検索欄が入る幅 */
  contentClassName?: string
  /**
   * 左に列の区切り線を引くか。
   *
   * 引かないのは**いちばん左の見出し**のときだけ。選択のチェックボックスと名前の
   * あいだに線があると、チェックが列ではなく行の飾りに見える。
   */
  showDivider?: boolean
  className?: string
}

/**
 * 並べ替えと絞り込みを1つの popover にまとめた列見出し。
 *
 * **セル全体が押せる。** `SortableTableHead` は見出しを押すと並べ替えが回る作りで、
 * 中に絞り込みのボタンを置くと押すたびに並べ替えも走ってしまう。並べ替えを popover の
 * 中へ入れれば、見出しが持つ当たり判定は「popover を開く」1つだけになる。
 *
 * 並べ替えは**回さず名指しする**（「昇順」「降順」を並べて出す）。回す作りだと、
 * いま何順なのかを覚えていないと目当ての向きに合わせられない。
 *
 * 状態は2つとも見出しの**右端の印1つ**で言う。並べ替えているあいだは filter が
 * chevron に置き換わり、絞り込んでいるあいだは色が付く。**後者が無いと、絞ったことを
 * 忘れて「データが消えた」と誤解する。**
 */
export function FilterableTableHead<SortKey extends string>({
  label,
  sortKey,
  currentSortKey,
  currentDirection,
  onSort,
  isFiltered,
  children,
  contentClassName,
  showDivider = true,
  className,
}: FilterableTableHeadProps<SortKey>) {
  const activeDirection = currentSortKey === sortKey ? currentDirection : null
  // 並べ替えを選んだら閉じる（結果が見えないと、押せたのかどうか分からない）。
  // 絞り込みの側は開いたまま —— タグは複数選ぶものなので、1つ選ぶたびに閉じると使えない
  const [isOpen, setIsOpen] = useState(false)

  return (
    <th
      data-slot="table-head"
      className={cn(
        // padding はボタン側が持つ（セル全体を当たり判定にするため）
        "h-12 p-0 align-middle font-medium whitespace-nowrap text-foreground",
        "bg-card first:rounded-tl-lg last:rounded-tr-lg",
        className
      )}
      aria-sort={
        activeDirection === "asc"
          ? "ascending"
          : activeDirection === "desc"
            ? "descending"
            : "none"
      }
    >
      <div className="flex h-12 items-center">
        {showDivider && <ColumnDivider />}
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-12 flex-1 cursor-pointer items-center gap-1.5 px-4 text-left transition-colors select-none hover:bg-muted/60"
            >
              <span className="truncate">{label}</span>
              <StateIcon direction={activeDirection} isFiltered={isFiltered} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className={cn("w-64 p-1", contentClassName)}
          >
            <SortMenuItem
              label="昇順"
              icon={<ArrowUp className="h-3.5 w-3.5" />}
              isActive={activeDirection === "asc"}
              onSelect={() => {
                onSort(sortKey, "asc")
                setIsOpen(false)
              }}
            />
            <SortMenuItem
              label="降順"
              icon={<ArrowDown className="h-3.5 w-3.5" />}
              isActive={activeDirection === "desc"}
              onSelect={() => {
                onSort(sortKey, "desc")
                setIsOpen(false)
              }}
            />
            <Separator className="my-2" />
            <div className="p-1">{children}</div>
          </PopoverContent>
        </Popover>
      </div>
    </th>
  )
}

/**
 * 見出しの右端に出す印。**並べ替えているあいだは chevron が filter を置き換える。**
 *
 * 印は1つだけ置き、絞り込みの有無は色で言う。2つ並べると、幅の狭い列
 * （日付）で語が押し出される。
 */
function StateIcon({
  direction,
  isFiltered,
}: {
  direction: SortDirection
  isFiltered: boolean
}) {
  const className = cn(
    "ml-auto h-4 w-4 shrink-0",
    isFiltered
      ? "text-primary"
      : direction === null
        ? "text-muted-foreground/50"
        : "text-foreground"
  )
  if (direction === "asc") return <ChevronUp className={className} />
  if (direction === "desc") return <ChevronDown className={className} />
  return <ListFilter className={className} />
}

/** popover 上部の「昇順」「降順」。選んでいる向きには ✓ が付く */
function SortMenuItem({
  label,
  icon,
  isActive,
  onSelect,
}: {
  label: string
  icon: ReactNode
  isActive: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span>{label}</span>
      {isActive && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
    </button>
  )
}
