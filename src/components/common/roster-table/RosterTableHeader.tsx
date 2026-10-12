"use client"

import { GripVertical } from "lucide-react"

import type {
  RosterColumn,
  RosterRow,
  RosterTableSlots,
} from "@/components/common/roster-table/types"
import { Checkbox } from "@/components/ui/checkbox"
import { TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface RosterTableHeaderProps {
  sortedRows: RosterRow[]
  selectedIds: Set<string>
  onSelectAll: (checked: boolean) => void
  additionalColumns: RosterColumn[]
  rowActionButtons?: RosterTableSlots["rowActionButtons"]
}

export function RosterTableHeader({
  sortedRows,
  selectedIds,
  onSelectAll,
  additionalColumns,
  rowActionButtons,
}: RosterTableHeaderProps) {
  // 全部・一部・なしの3状態（学級管理・生徒管理の `SelectableListTable` と同じ表し方）
  const selectedRowCount = sortedRows.filter((row) =>
    selectedIds.has(row.id)
  ).length
  const allSelected =
    sortedRows.length > 0 && selectedRowCount === sortedRows.length
  const someSelected = selectedRowCount > 0 && !allSelected

  return (
    <TableHeader className="sticky top-0 z-10 bg-background">
      <TableRow>
        <TableHead className="w-25">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <Checkbox
              checked={
                allSelected ? true : someSelected ? "indeterminate" : false
              }
              onCheckedChange={(checked) => onSelectAll(checked === true)}
              aria-label="全選択"
            />
          </div>
        </TableHead>
        <TableHead className="w-20">出席番号</TableHead>
        <TableHead className="w-25">学籍番号</TableHead>
        <TableHead>氏名</TableHead>
        <TableHead>カナ</TableHead>
        <TableHead>学級</TableHead>
        {additionalColumns.map((column) => (
          <TableHead key={column.key} className={column.headerClassName}>
            {column.header}
          </TableHead>
        ))}
        {rowActionButtons && (
          <TableHead className={rowActionButtons.headerClassName}>
            {rowActionButtons.header}
          </TableHead>
        )}
      </TableRow>
    </TableHeader>
  )
}
