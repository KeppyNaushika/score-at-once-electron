"use client"

import type { EmptyTableCellProps } from "@/components/projects/06-answer-sheets/answer-sheet-table/types"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { TableCell } from "@/components/ui/table"
import { Ban } from "lucide-react"

export function EmptyTableCell({
  position,
  student,
  pageNumber,
  isPositionDisabled,
  isPendingChange = false,
}: EmptyTableCellProps) {
  return (
    <TableCell
      className={`relative h-32 w-32 border p-1 ${
        isPositionDisabled ? "bg-gray-100" : "bg-white"
      }`}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex h-full w-full items-center justify-center">
            {isPositionDisabled ? (
              <Ban className="h-6 w-6 text-gray-400" />
            ) : (
              <div className="text-xs text-gray-400">
                空セル
                {student && (
                  <div className="mt-1">
                    {student.lastName} {student.firstName}
                  </div>
                )}
                {pageNumber && <div>P{pageNumber}</div>}
              </div>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem disabled className="flex items-center gap-2 text-gray-400">
            <Ban className="h-4 w-4" />
            空のセル
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* 変更予定オーバーレイ */}
      {isPendingChange && (
        <div className="pointer-events-none absolute inset-0 bg-red-500/30 border-4 border-red-500 animate-pulse z-40" />
      )}
    </TableCell>
  )
}
