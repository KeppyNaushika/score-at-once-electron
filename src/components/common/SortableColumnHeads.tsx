"use client"

import { SortableTableHead } from "@/components/ui/SortableTableHead"
import { TableHead } from "@/components/ui/table"
import type { SortDirection } from "@/hooks/useTableSort"

/** 見出し行の1列。`sortKey` を持つ列だけが押して並べ替えられる */
export interface ColumnHeadDefinition<SortKey extends string> {
  /** 見出しの語。1つの見出し行の中で重ならないので React の key も兼ねる */
  label: string
  /** 並べ替えに使う列名。無ければ並べ替えない素の見出し */
  sortKey?: SortKey
  className?: string
}

interface SortableColumnHeadsProps<SortKey extends string> {
  columns: ColumnHeadDefinition<SortKey>[]
  currentSortKey: string | null
  currentDirection: SortDirection
  onSort: (key: SortKey) => void
}

/**
 * 見出し行のうち、並べ替えのできる列と素の列を定義の順に並べる。
 *
 * 学級管理・生徒管理・学級の所属一覧が同じ `SortableTableHead` を列の数だけ
 * 書き並べていたのを1つにした。行の先頭のチェックボックスは画面ごとに違うので
 * 呼び手が置く。
 */
export function SortableColumnHeads<SortKey extends string>({
  columns,
  currentSortKey,
  currentDirection,
  onSort,
}: SortableColumnHeadsProps<SortKey>) {
  return columns.map((column) =>
    column.sortKey === undefined ? (
      <TableHead key={column.label} className={column.className}>
        {column.label}
      </TableHead>
    ) : (
      <SortableTableHead
        key={column.label}
        sortKey={column.sortKey}
        currentSortKey={currentSortKey}
        currentDirection={currentDirection}
        onSort={onSort}
        className={column.className}
      >
        {column.label}
      </SortableTableHead>
    )
  )
}
