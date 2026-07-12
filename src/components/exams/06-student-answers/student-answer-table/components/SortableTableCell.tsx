"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Ban, X } from "lucide-react"

import type { SortableTableCellProps } from "@/components/exams/06-student-answers/student-answer-table/types"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { TableCell } from "@/components/ui/table"

/**
 * アップロード（方式A）専用の並べ替えセル。sortable による並べ替えと、
 * 答案画像／セルの無効化コンテキストメニューを提供する。
 * 確認モード（方式B）は DraggableAnswerCell を使うため、ここに view 用の分岐は持たない。
 */
export function SortableTableCell({
  id,
  hasFile,
  isPositionDisabled,
  isFileDisabled,
  onTogglePosition,
  onToggleFileDisabled,
  fileId,
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
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="h-full w-full" {...listeners}>
            {children}
          </div>
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
            {isPositionDisabled ? (
              <>
                <X className="h-4 w-4" />
                セルを有効化
              </>
            ) : (
              <>
                <Ban className="h-4 w-4" />
                セルを無効化
              </>
            )}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </TableCell>
  )
}
