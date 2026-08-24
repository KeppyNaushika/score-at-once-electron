"use client"

import { ListPager } from "@/components/common/ListPager"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AUTO_PAGE_SIZE,
  LIST_PAGE_SIZES,
  type PageSizeChoice,
} from "@/lib/listPagination"

interface ListPaginationFooterProps {
  /** 絞り込みに一致する総件数 */
  total: number
  /** いま見ている先頭の行番号（1始まり。0件なら 0） */
  firstRowNumber: number
  /** いま見ている末尾の行番号 */
  lastRowNumber: number
  /** 実際に並べている件数（「自動」なら測って決まった値） */
  pageSize: number
  pageSizeChoice: PageSizeChoice
  onPageSizeChoiceChange: (choice: PageSizeChoice) => void
  /** 1始まり */
  pageNumber: number
  pageCount: number
  onPageChange: (pageNumber: number) => void
}

/**
 * 一覧の下端。左に「何件中どこを見ているか」、真ん中に1ページの件数、右にページ送り。
 *
 * 1ページに収まるときもページ送りだけ消して**フッターは出したままにする**。出したり
 * 消したりすると、絞り込むたびに一覧の高さが変わって行の位置が飛ぶ。
 */
export function ListPaginationFooter({
  total,
  firstRowNumber,
  lastRowNumber,
  pageSize,
  pageSizeChoice,
  onPageSizeChoiceChange,
  pageNumber,
  pageCount,
  onPageChange,
}: ListPaginationFooterProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 border-t px-6 py-3">
      <span className="text-sm text-muted-foreground">
        {total} 件中 {firstRowNumber}〜{lastRowNumber} 件
      </span>
      <Select
        value={
          pageSizeChoice === AUTO_PAGE_SIZE
            ? AUTO_PAGE_SIZE
            : String(pageSizeChoice)
        }
        onValueChange={(value) =>
          onPageSizeChoiceChange(
            value === AUTO_PAGE_SIZE ? AUTO_PAGE_SIZE : Number(value)
          )
        }
      >
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={AUTO_PAGE_SIZE}>自動（{pageSize} 件）</SelectItem>
          {LIST_PAGE_SIZES.map((size) => (
            <SelectItem key={size} value={String(size)}>
              {size} 件ずつ
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pageCount > 1 && (
        <div className="ml-auto">
          <ListPager
            pageNumber={pageNumber}
            pageCount={pageCount}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  )
}
