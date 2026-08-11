"use client"

import type { DragEndEvent } from "@dnd-kit/core"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, RotateCcw, RotateCw, Trash2 } from "lucide-react"
import Image from "next/image"

import { cn } from "@/lib/utils"
import type { OutputPage, RotationDegree } from "@/types/pdfTools.types"

/** 回転角の並び。左右の回転はこの並びを1つずらす */
const ROTATION_CYCLE: RotationDegree[] = [0, 90, 180, 270]

interface OutputPreviewProps {
  pages: OutputPage[]
  onPagesChange: (pages: OutputPage[]) => void
  onDeletePage: (page: OutputPage) => void
  onRotatePage: (page: OutputPage, rotation: RotationDegree) => void
  disabled: boolean
}

export default function OutputPreview({
  pages,
  onPagesChange,
  onDeletePage,
  onRotatePage,
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

    const oldIndex = pages.findIndex((page) => page.id === active.id)
    const newIndex = pages.findIndex((page) => page.id === over.id)

    if (oldIndex !== -1 && newIndex !== -1) {
      onPagesChange(arrayMove(pages, oldIndex, newIndex))
    }
  }

  const handleDeletePage = (page: OutputPage) => {
    // 即座に表示から除去（ドラッグ並び替えの順序を維持）
    onPagesChange(pages.filter((otherPage) => otherPage.id !== page.id))
    // 永続的に除外（設定変更による再生成時も反映）
    onDeletePage(page)
  }

  /** ページを 90° 単位で回す（step: -1 = 左, 1 = 右） */
  const handleRotatePage = (page: OutputPage, step: -1 | 1) => {
    const currentIndex = ROTATION_CYCLE.indexOf(page.rotation)
    const rotation =
      ROTATION_CYCLE[
        (currentIndex + step + ROTATION_CYCLE.length) % ROTATION_CYCLE.length
      ]
    // 即座に表示へ反映（ドラッグ並び替えの順序を維持）
    onPagesChange(
      pages.map((otherPage) =>
        otherPage.id === page.id ? { ...otherPage, rotation } : otherPage
      )
    )
    // 永続化（設定変更による再生成時も反映）
    onRotatePage(page, rotation)
  }

  if (pages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
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
      <SortableContext
        items={pages.map((page) => page.id)}
        strategy={rectSortingStrategy}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {pages.map((page, index) => (
            <SortablePageItem
              key={page.id}
              page={page}
              index={index}
              disabled={disabled}
              onDelete={() => handleDeletePage(page)}
              onRotateLeft={() => handleRotatePage(page, -1)}
              onRotateRight={() => handleRotatePage(page, 1)}
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
  onDelete: () => void
  onRotateLeft: () => void
  onRotateRight: () => void
}

function SortablePageItem({
  page,
  index,
  disabled,
  onDelete,
  onRotateLeft,
  onRotateRight,
}: SortablePageItemProps) {
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
  const shortFileName =
    page.sourceFileName.length > 8
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
        "group relative aspect-3/4 cursor-grab overflow-hidden rounded-lg border-2 bg-white shadow-sm transition-all",
        isDragging ? "z-50 opacity-50 shadow-lg" : "hover:border-primary/50",
        disabled && "cursor-not-allowed opacity-50"
      )}
      {...attributes}
      {...listeners}
    >
      {/* サムネイル */}
      <div className="relative h-full w-full overflow-hidden">
        {page.thumbnail ? (
          <Image
            src={page.thumbnail}
            alt={`Page ${index + 1}`}
            fill
            unoptimized
            className="object-cover"
            style={page.rotation !== 0 ? rotationStyle : undefined}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <span className="text-xs text-muted-foreground">
              {page.sourcePageNumber}
            </span>
          </div>
        )}
      </div>

      {/* ホバー時オーバーレイ（回転・削除ボタン） */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 bg-black/40 opacity-0 transition-opacity",
          !disabled && "group-hover:opacity-100"
        )}
      >
        <button
          className="pointer-events-auto rounded-full bg-white/90 p-1.5 text-foreground shadow-md transition-colors hover:bg-white"
          onClick={(e) => {
            e.stopPropagation()
            onRotateLeft()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          title="左に90°回転"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          className="pointer-events-auto rounded-full bg-white/90 p-1.5 text-foreground shadow-md transition-colors hover:bg-white"
          onClick={(e) => {
            e.stopPropagation()
            onRotateRight()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          title="右に90°回転"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
        <button
          className="pointer-events-auto rounded-full bg-red-500 p-1.5 text-white shadow-md transition-colors hover:bg-red-600"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          title="削除"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ドラッグハンドル */}
      <div className="absolute top-1 left-1 rounded bg-black/40 p-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <GripVertical className="h-3 w-3 text-white" />
      </div>

      {/* ページ情報 */}
      <div className="absolute right-0 bottom-0 left-0 bg-black/60 px-1 py-0.5">
        <div className="flex items-center justify-between">
          <span className="truncate text-[10px] text-white">
            {shortFileName}
          </span>
          <span className="text-[10px] whitespace-nowrap text-white/80">
            {page.rotation !== 0 && `${page.rotation}° `}
            {page.isNUpCombined && page.combinedPages
              ? page.combinedPages.join("+")
              : page.sourcePageNumber}
          </span>
        </div>
      </div>

      {/* 出力順番号 */}
      <div className="absolute top-1 right-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
        {index + 1}
      </div>
    </div>
  )
}
