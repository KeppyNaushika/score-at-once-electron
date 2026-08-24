"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import type { MouseEvent } from "react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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

/**
 * 畳まれた区間の省略記号。**押すとページ番号を打ち込んで飛べる。**
 *
 * ページ数が3桁になると、端と現在地の前後しかボタンが出ない。間のページへは
 * 「次へ」を何十回も押すか、ここから番号を打つしかない。
 */
function PageJumpEllipsis({
  pageCount,
  onPageChange,
}: {
  pageCount: number
  onPageChange: (pageNumber: number) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [pageText, setPageText] = useState("")

  const target = Number(pageText)
  const canJump =
    pageText !== "" &&
    Number.isInteger(target) &&
    target >= 1 &&
    target <= pageCount

  return (
    <Popover
      open={isOpen}
      onOpenChange={(nextOpen) => {
        setIsOpen(nextOpen)
        // 閉じたら打ちかけを捨てる（次に開いたとき前回の入力が残っていると、
        // そのまま押して意図しないページへ飛ぶ）
        if (!nextOpen) setPageText("")
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="ページ番号を指定して移動"
          className="cursor-pointer rounded hover:bg-accent"
        >
          <PaginationEllipsis />
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-52 p-2">
        <form
          className="flex items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault()
            if (!canJump) return
            onPageChange(target)
            setIsOpen(false)
            setPageText("")
          }}
        >
          <Input
            value={pageText}
            onChange={(event) => setPageText(event.target.value)}
            inputMode="numeric"
            placeholder={`1〜${pageCount}`}
            aria-label={`移動先のページ（1〜${pageCount}）`}
            className="h-8 text-sm"
            autoFocus
          />
          <Button type="submit" size="sm" className="h-8" disabled={!canJump}>
            移動
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}

interface ListPagerProps {
  /** 1始まり */
  pageNumber: number
  pageCount: number
  onPageChange: (pageNumber: number) => void
}

/**
 * ページ送り。監査ログと一覧4画面が同じものを使う。
 *
 * 行き先は URL ではなく画面の状態なので、`<a>` の既定の遷移は止める
 * （未保存の確認を挟む `GuardedLink` の経路にも乗せない）。
 */
export function ListPager({
  pageNumber,
  pageCount,
  onPageChange,
}: ListPagerProps) {
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
              <PageJumpEllipsis
                pageCount={pageCount}
                onPageChange={onPageChange}
              />
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
