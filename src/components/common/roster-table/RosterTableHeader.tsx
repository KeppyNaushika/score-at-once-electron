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
  return (
    <TableHeader className="bg-background sticky top-0 z-10">
      <TableRow>
        <TableHead className="w-25">
          <div className="flex items-center gap-2">
            <GripVertical className="text-muted-foreground h-4 w-4" />
            <Checkbox
              checked={
                sortedRows.length > 0 &&
                sortedRows.every((row) => selectedIds.has(row.id))
              }
              onCheckedChange={onSelectAll}
            />
          </div>
        </TableHead>
        <TableHead className="w-20">出席番号</TableHead>
        <TableHead className="w-25">学籍番号</TableHead>
        <TableHead>氏名</TableHead>
        <TableHead>ふりがな</TableHead>
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
