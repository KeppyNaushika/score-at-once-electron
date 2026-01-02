"use client"

import { cn } from "@/lib/utils"
import type { OutputPage } from "@/types/pdfTools.types"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"

interface OutputPreviewProps {
  pages: OutputPage[]
  onPagesChange: (pages: OutputPage[]) => void
  disabled: boolean
}

export default function OutputPreview({
  pages,
  onPagesChange,
  disabled,
}: OutputPreviewProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = pages.findIndex((p) => p.id === active.id)
    const newIndex = pages.findIndex((p) => p.id === over.id)

    if (oldIndex !== -1 && newIndex !== -1) {
      onPagesChange(arrayMove(pages, oldIndex, newIndex))
    }
  }

  if (pages.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        ページを選択してください
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {pages.map((page, index) => (
            <SortablePageItem
              key={page.id}
              page={page}
              index={index}
              disabled={disabled}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

interface SortablePageItemProps {
  page: OutputPage
  index: number
  disabled: boolean
}

function SortablePageItem({ page, index, disabled }: SortablePageItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id, disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // ファイル名の短縮表示
  const shortFileName = page.sourceFileName.length > 8
    ? page.sourceFileName.slice(0, 6) + "…"
    : page.sourceFileName

  // 回転スタイル
  const rotationStyle = {
    transform: `rotate(${page.rotation}deg)`,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative aspect-[3/4] cursor-grab overflow-hidden rounded-lg border-2 bg-white shadow-sm transition-all",
        isDragging ? "z-50 opacity-50 shadow-lg" : "hover:border-primary/50",
        disabled && "cursor-not-allowed opacity-50"
      )}
      {...attributes}
      {...listeners}
    >
      {/* サムネイル */}
      <div className="h-full w-full overflow-hidden">
        {page.thumbnail ? (
          <img
            src={page.thumbnail}
            alt={`Page ${index + 1}`}
            className="h-full w-full object-cover"
            style={page.rotation !== 0 ? rotationStyle : undefined}
          />
        ) : (
          <div className="bg-muted flex h-full w-full items-center justify-center">
            <span className="text-muted-foreground text-xs">
              {page.sourcePageNumber}
            </span>
          </div>
        )}
      </div>

      {/* ドラッグハンドル */}
      <div className="absolute top-1 left-1 rounded bg-black/40 p-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <GripVertical className="h-3 w-3 text-white" />
      </div>

      {/* ページ情報 */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
        <div className="flex items-center justify-between">
          <span className="truncate text-[10px] text-white">{shortFileName}</span>
          <span className="text-[10px] text-white/80">
            {page.isNUpCombined && page.combinedPages
              ? page.combinedPages.join("+")
              : page.sourcePageNumber}
          </span>
        </div>
      </div>

      {/* 出力順番号 */}
      <div className="bg-primary text-primary-foreground absolute top-1 right-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
        {index + 1}
      </div>
    </div>
  )
}
