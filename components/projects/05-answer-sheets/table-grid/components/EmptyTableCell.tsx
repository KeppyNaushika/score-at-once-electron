"use client"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { TableCell } from "@/components/ui/table"
import { Ban, Upload } from "lucide-react"
import type { EmptyTableCellProps } from "../types"

export function EmptyTableCell({
  position,
  student,
  pageNumber,
  isPositionDisabled,
  onTogglePosition,
  onUploadToCell,
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
              <div className="text-center">
                <Ban className="mx-auto h-6 w-6 text-gray-400" />
                <div className="mt-1 text-xs text-gray-500">無効</div>
              </div>
            ) : (
              <div className="text-center">
                <Upload className="mx-auto h-6 w-6 text-gray-300" />
                <div className="mt-1 text-xs text-gray-400">空き</div>
                {student && (
                  <div className="mt-1 text-xs text-gray-400">
                    P{pageNumber}
                  </div>
                )}
              </div>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onClick={onTogglePosition}
            className="flex items-center gap-2"
          >
            <Ban className="h-4 w-4" />
            {isPositionDisabled ? "セルを有効化" : "セルを無効化"}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={onUploadToCell}
            className="flex items-center gap-2"
            disabled={isPositionDisabled}
          >
            <Upload className="h-4 w-4" />
            このセルに答案画像をアップロード
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </TableCell>
  )
}
