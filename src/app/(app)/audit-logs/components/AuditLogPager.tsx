"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import type { MouseEvent } from "react"

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination"
import { cn } from "@/lib/utils"

interface PageSlot {
  /** 描き分けの鍵。省略記号は次に出すページ番号から作るので重複しない */
  key: string
  /** null は省略記号 */
  pageNumber: number | null
}

/**
 * 端と現在地の前後だけを残し、間を省略記号へ畳んだページ番号の並び。
 *
 * 保持365日ぶんの行はページ数が3桁になりうるので、全部並べると操作できない。
 */
const buildPageSlots = (pageNumber: number, pageCount: number): PageSlot[] => {
  const shown = [
    ...new Set([1, pageNumber - 1, pageNumber, pageNumber + 1, pageCount]),
  ]
    .filter((candidate) => candidate >= 1 && candidate <= pageCount)
    .sort((left, right) => left - right)

  return shown.flatMap((candidate, i) => {
    const slot: PageSlot = { key: `page-${candidate}`, pageNumber: candidate }
    return i > 0 && candidate - shown[i - 1] > 1
      ? [{ key: `gap-before-${candidate}`, pageNumber: null }, slot]
      : [slot]
  })
}

interface AuditLogPagerProps {
  /** 1始まり */
  pageNumber: number
  pageCount: number
  onPageChange: (pageNumber: number) => void
}

/**
 * 監査ログのページ送り。
 *
 * 行き先は URL ではなく画面の状態なので、`<a>` の既定の遷移は止める
 * （未保存の確認を挟む `GuardedLink` の経路にも乗せない）。
 */
export function AuditLogPager({
  pageNumber,
  pageCount,
  onPageChange,
}: AuditLogPagerProps) {
  const goTo = (target: number) => (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    if (target < 1 || target > pageCount || target === pageNumber) return
    onPageChange(target)
  }

  const isFirst = pageNumber <= 1
  const isLast = pageNumber >= pageCount

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationLink
            href="#"
            aria-label="前のページ"
            aria-disabled={isFirst}
            size="default"
            className={cn("gap-1 px-2.5", isFirst && "opacity-50")}
            onClick={goTo(pageNumber - 1)}
          >
            <ChevronLeft />
            <span>前へ</span>
          </PaginationLink>
        </PaginationItem>

        {buildPageSlots(pageNumber, pageCount).map((slot) =>
          slot.pageNumber === null ? (
            <PaginationItem key={slot.key}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={slot.key}>
              <PaginationLink
                href="#"
                aria-label={`${slot.pageNumber}ページ目`}
                isActive={slot.pageNumber === pageNumber}
                onClick={goTo(slot.pageNumber)}
              >
                {slot.pageNumber}
              </PaginationLink>
            </PaginationItem>
          )
        )}

        <PaginationItem>
          <PaginationLink
            href="#"
            aria-label="次のページ"
            aria-disabled={isLast}
            size="default"
            className={cn("gap-1 px-2.5", isLast && "opacity-50")}
            onClick={goTo(pageNumber + 1)}
          >
            <span>次へ</span>
            <ChevronRight />
          </PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
