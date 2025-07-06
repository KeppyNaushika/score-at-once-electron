"use client"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { TableCell } from "@/components/ui/table"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Ban, Upload, X } from "lucide-react"
import { useEffect } from "react"
import type { SortableTableCellProps } from "../types"

export function SortableTableCell({
  id,
  position,
  hasFile,
  isPositionDisabled,
  isFileDisabled,
  onTogglePosition,
  onToggleFileDisabled,
  onUploadToCell,
  fileId,
  observerRef,
  children,
}: SortableTableCellProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: !hasFile || isFileDisabled || isPositionDisabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // Intersection Observer用のdata属性設定
  useEffect(() => {
    if (fileId && observerRef?.current) {
      const element = document.querySelector(`[data-file-id="${fileId}"]`)
      if (element && observerRef.current) {
        observerRef.current.observe(element)
      }
    }
  }, [fileId, observerRef])

  return (
    <TableCell
      ref={setNodeRef}
      style={style}
      className={`relative h-32 w-32 border p-1 transition-all ${
        hasFile && !isFileDisabled && !isPositionDisabled
          ? "cursor-grab active:cursor-grabbing"
          : ""
      } ${isPositionDisabled ? "bg-gray-100" : "bg-white"} ${
        isFileDisabled ? "bg-red-50" : ""
      }`}
      data-file-id={fileId}
      {...attributes}
      {...listeners}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="h-full w-full">{children}</div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {hasFile && (
            <>
              <ContextMenuItem
                onClick={onToggleFileDisabled}
                className="flex items-center gap-2"
              >
                {isFileDisabled ? (
                  <>
                    <X className="h-4 w-4" />
                    答案画像を有効化
                  </>
                ) : (
                  <>
                    <Ban className="h-4 w-4" />
                    答案画像を無効化
                  </>
                )}
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
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
          >
            <Upload className="h-4 w-4" />
            このセルに答案画像をアップロード
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </TableCell>
  )
}
