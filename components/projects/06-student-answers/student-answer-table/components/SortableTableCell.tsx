"use client"

import { DeleteConfirmationModal } from "@/components/projects/06-answer-sheets/answer-sheet-table/components/DeleteConfirmationModal"
import type { SortableTableCellProps } from "@/components/projects/06-answer-sheets/answer-sheet-table/types"
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
import { Ban, Trash2, Upload, X } from "lucide-react"
import { useEffect, useState } from "react"

export function SortableTableCell({
  id,
  hasFile,
  isPositionDisabled,
  isFileDisabled,
  onTogglePosition,
  onToggleFileDisabled,
  onUploadToCell,
  fileId,
  observerRef,
  children,
  mode = "upload",
  onDeleteFileWithScoring,
  studentName,
  pageNumber,
  hasScoreData = false,
}: SortableTableCellProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false)

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

  const handleDeleteClick = () => {
    setShowDeleteModal(true)
  }

  const handleDeleteConfirm = () => {
    if (onDeleteFileWithScoring) {
      onDeleteFileWithScoring()
    }
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
          {hasFile && mode === "upload" && (
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
          {mode === "upload" && (
            <>
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
              {!isPositionDisabled && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onClick={onUploadToCell}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    このセルに答案画像をアップロード
                  </ContextMenuItem>
                </>
              )}
            </>
          )}
          {mode === "view" && hasFile && onDeleteFileWithScoring && (
            <>
              <ContextMenuItem
                onClick={handleDeleteClick}
                className="flex items-center gap-2 text-red-600"
              >
                <Trash2 className="h-4 w-4" />
                答案画像を削除
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        studentName={studentName}
        pageNumber={pageNumber}
        hasScoreData={hasScoreData}
      />
    </TableCell>
  )
}
