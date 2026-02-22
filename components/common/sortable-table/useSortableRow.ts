import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

/**
 * ソート可能なテーブル行のためのフック
 *
 * useSortable をラップし、transform/transition/opacity のスタイルと
 * DragHandle に渡す dragHandleProps をまとめて返す。
 *
 * @param id - 行を一意に識別するID（SortableContext の items と一致させる）
 * @returns setNodeRef, style, isDragging, dragHandleProps
 */
export function useSortableRow(id: string) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return {
    setNodeRef,
    style,
    isDragging,
    dragHandleProps: { ...attributes, ...listeners },
  }
}
