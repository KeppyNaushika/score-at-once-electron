"use client"

import { GripVertical } from "lucide-react"

import { cn } from "@/lib/utils"

interface DragHandleProps {
  /** useSortableRow() から取得した dragHandleProps を渡す */
  dragHandleProps: Record<string, unknown>
  className?: string
}

/**
 * ドラッグ&ドロップ用のグリップハンドル
 *
 * useSortableRow の dragHandleProps を受け取り、統一されたドラッグハンドルUIを提供する。
 */
export function DragHandle({ dragHandleProps, className }: DragHandleProps) {
  return (
    <div
      {...dragHandleProps}
      className={cn(
        "hover:bg-muted cursor-grab rounded p-1 active:cursor-grabbing",
        className
      )}
    >
      <GripVertical className="text-muted-foreground h-4 w-4" />
    </div>
  )
}
