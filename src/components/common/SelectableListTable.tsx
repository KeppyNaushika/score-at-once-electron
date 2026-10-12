"use client"

import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { ListPaginationFooter } from "@/components/common/ListPaginationFooter"
import {
  type ColumnHeadDefinition,
  SortableColumnHeads,
} from "@/components/common/SortableColumnHeads"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useListPagination } from "@/hooks/useListPagination"
import type { SortDirection } from "@/hooks/useTableSort"

/** 1行の高さの見積もり（px）。「自動」の件数はこれで割る。はみ出すより余らせる */
const SELECTABLE_LIST_ROW_HEIGHT = 60

/** 行の上に居座る見出し行の高さ（`h-12`） */
const SELECTABLE_LIST_HEADER_HEIGHT = 48

interface SelectableListTableProps<
  Row extends { id: string },
  SortKey extends string,
> {
  /** 絞り込み・並べ替え済みの行（ページ分けはこの部品の中でやる） */
  rows: Row[]
  /** 1行を描く。`key` は呼び手が付ける */
  renderRow: (row: Row) => ReactNode
  /** 先頭のチェックボックス列より後ろの見出し */
  columns: ColumnHeadDefinition<SortKey>[]
  currentSortKey: string | null
  currentDirection: SortDirection
  onSort: (key: SortKey) => void
  /** 表示中の行が全部選ばれているか */
  allSelected: boolean
  /** 表示中の行の一部だけが選ばれているか（全選択の箱を「一部」の表示にする） */
  someSelected: boolean
  onToggleSelectAll: (checked: boolean) => void
  /** 条件か並び順が変わったら先頭のページへ戻すための鍵 */
  paginationResetKey: string
  /** 0件のときのアイコンと文言 */
  emptyIcon: LucideIcon
  emptyMessage: string
}

/**
 * 学級管理・生徒管理の一覧の表（全選択の箱・並べ替えの見出し・空の表示・ページ送り）。
 *
 * 2画面は同じ枠を手で組んでいた。行の中身（`ClassroomManagementRow` /
 * `StudentTableRow`）と見出しの列だけが画面ごとに違う。
 */
export function SelectableListTable<
  Row extends { id: string },
  SortKey extends string,
>({
  rows,
  renderRow,
  columns,
  currentSortKey,
  currentDirection,
  onSort,
  allSelected,
  someSelected,
  onToggleSelectAll,
  paginationResetKey,
  emptyIcon: EmptyIcon,
  emptyMessage,
}: SelectableListTableProps<Row, SortKey>) {
  const {
    pageRows,
    pageNumber,
    pageSize,
    pageSizeChoice,
    setPageSizeChoice,
    pageCount,
    setPageNumber,
    firstRowNumber,
    lastRowNumber,
    viewportRef,
  } = useListPagination(rows, {
    rowHeight: SELECTABLE_LIST_ROW_HEIGHT,
    reservedHeight: SELECTABLE_LIST_HEADER_HEIGHT,
    resetKey: paginationResetKey,
  })

  return (
    <div className="min-h-0 flex-1 p-4">
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/50 shadow-sm">
        {/* 「自動」はこの箱の高さを1行の高さで割る。縦に流すのは中の Table の側 */}
        <div ref={viewportRef} className="min-h-0 flex-1">
          <Table wrapperClassName="h-full">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      allSelected
                        ? true
                        : someSelected
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={(checked) =>
                      onToggleSelectAll(checked === true)
                    }
                    aria-label="全選択"
                  />
                </TableHead>
                <SortableColumnHeads
                  columns={columns}
                  currentSortKey={currentSortKey}
                  currentDirection={currentDirection}
                  onSort={onSort}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((row) => renderRow(row))}
              {rows.length === 0 && (
                <TableRow>
                  {/* 先頭のチェックボックス列の分を足す */}
                  <TableCell colSpan={columns.length + 1}>
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <EmptyIcon />
                        </EmptyMedia>
                        <EmptyTitle>{emptyMessage}</EmptyTitle>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <ListPaginationFooter
          total={rows.length}
          firstRowNumber={firstRowNumber}
          lastRowNumber={lastRowNumber}
          pageSize={pageSize}
          pageSizeChoice={pageSizeChoice}
          onPageSizeChoiceChange={setPageSizeChoice}
          pageNumber={pageNumber}
          pageCount={pageCount}
          onPageChange={setPageNumber}
        />
      </div>
    </div>
  )
}
