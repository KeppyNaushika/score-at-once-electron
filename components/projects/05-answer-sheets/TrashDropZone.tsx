"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { useDroppable } from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Trash2, X } from "lucide-react"
import type { UnifiedFile } from "@/types/answer-sheet.types"

// ============================================================================
// ソート可能なファイルアイテム（ゴミ箱用）
// ============================================================================

function SortableFileItem({
  id,
  children,
}: {
  id: string
  children: React.ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || "transform 150ms ease",
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="mb-2 cursor-grab rounded-lg border border-gray-200 bg-white p-4 transition-all duration-300 ease-in-out hover:scale-[1.01] hover:border-gray-300 hover:shadow-md active:scale-[0.98] active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  )
}

// ============================================================================
// ドロップ可能なゴミ箱ボタン
// ============================================================================

function DroppableTrashButton({
  trashCount,
  onClick,
  droppableId = "trash-popover-trigger",
}: {
  trashCount: number
  onClick?: () => void
  droppableId?: string
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { type: "trash" },
  })

  return (
    <Button
      ref={setNodeRef}
      variant="outline"
      className={`h-12 w-48 cursor-pointer transition-all duration-300 ease-in-out ${
        isOver
          ? "ring-opacity-50 scale-105 border-blue-400 shadow-lg ring-2 ring-blue-200"
          : "hover:bg-gray-50"
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 text-xs">
        <Trash2 className="h-4 w-4" />
        <span className="text-center leading-tight">
          ここにドラッグして
          <br />
          ファイルを無効化
        </span>
        <span className="text-xs text-gray-500">({trashCount}件)</span>
      </div>
    </Button>
  )
}

// ============================================================================
// ドロップエリア
// ============================================================================

function TrashArea({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "trash-area",
    data: { type: "trash" },
  })

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border-2 border-dashed p-4 transition-all duration-300 ease-in-out ${
        isOver
          ? "ring-opacity-50 scale-[1.02] border-red-400 bg-red-50 shadow-lg ring-2 ring-red-200"
          : "border-red-300 bg-red-50/50 hover:bg-red-100/50"
      }`}
    >
      {children}
    </div>
  )
}

// ============================================================================
// メインゴミ箱コンポーネント
// ============================================================================

interface TrashDropZoneProps {
  trashFiles: UnifiedFile[]
  onFileRestore: (fileId: string) => void
  className?: string
}

export default function TrashDropZone({
  trashFiles,
  onFileRestore,
  className = "",
}: TrashDropZoneProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)

  return (
    <div className={className}>
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <div>
            <DroppableTrashButton
              trashCount={trashFiles.length}
              onClick={() => setIsPopoverOpen(!isPopoverOpen)}
            />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-4" side="bottom" align="end">
          <TrashArea>
            <div className="max-h-64 min-h-48 overflow-y-auto">
              <SortableContext
                items={trashFiles.map((file) => file.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {trashFiles.map((file) => (
                    <SortableFileItem key={file.id} id={file.id}>
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-red-600 line-through">
                              {file.name}
                            </span>
                            <span className="text-sm text-red-400">
                              ID: {file.id.slice(0, 8)}
                            </span>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem
                            onClick={() => onFileRestore(file.id)}
                            className="flex items-center gap-2"
                          >
                            <X className="h-4 w-4" />
                            答案画像を有効化
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </SortableFileItem>
                  ))}

                  {trashFiles.length === 0 && (
                    <div className="py-6 text-center text-gray-500">
                      <Trash2 className="mx-auto mb-2 h-6 w-6 opacity-50" />
                      <div className="text-sm">アイテムをここにドラッグ</div>
                    </div>
                  )}
                </div>
              </SortableContext>
            </div>
          </TrashArea>
        </PopoverContent>
      </Popover>
    </div>
  )
}

// 個別コンポーネントもエクスポート（必要に応じて使用）
export { DroppableTrashButton, TrashArea, SortableFileItem }