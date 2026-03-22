"use client"

import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core"
import type { UniqueIdentifier } from "@dnd-kit/core"
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"

interface SortableTableProviderProps {
  /** SortableContext に渡す ID の配列 */
  items: UniqueIdentifier[]
  /** ドラッグ終了時のコールバック */
  onDragEnd: (event: DragEndEvent) => void
  /** ドラッグ開始時のコールバック（activeId 追跡用） */
  onDragStart?: (event: DragStartEvent) => void
  children: React.ReactNode
  /** DragOverlay の中身。undefined の場合は DragOverlay を描画しない */
  dragOverlay?: React.ReactNode
}

/**
 * ソート可能なテーブル/リストの DnD プロバイダー
 *
 * DndContext + SortableContext + DragOverlay を統一された sensors 設定で提供する。
 * PointerSensor（distance: 5）と KeyboardSensor を標準で使用。
 */
export function SortableTableProvider({
  items,
  onDragEnd,
  onDragStart,
  children,
  dragOverlay,
}: SortableTableProviderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
      {dragOverlay !== undefined && <DragOverlay>{dragOverlay}</DragOverlay>}
    </DndContext>
  )
}
