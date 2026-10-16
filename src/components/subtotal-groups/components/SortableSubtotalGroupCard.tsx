"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"

import { WithTooltip } from "@/components/common/WithTooltip"
import type { SubtotalGroupRow } from "@/queries/subtotal"

import { SubtotalGroupCard } from "./SubtotalGroupCard"

interface SortableSubtotalGroupCardProps {
  group: SubtotalGroupRow
  onEdit: () => void
  onDelete: () => void
  /** 絞り込み中は並べ替えられない（一部だけの並びから全体の順を決められないため） */
  sortDisabled: boolean
}

/**
 * ドラッグで並べ替えられる小計点グループのカード。
 * 編集・削除のボタンを押せるよう、ドラッグはつまみからだけ始める
 */
export function SortableSubtotalGroupCard({
  group,
  onEdit,
  onDelete,
  sortDisabled,
}: SortableSubtotalGroupCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id, disabled: sortDisabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const dragHandle = sortDisabled ? (
    <WithTooltip content="検索語やタグで絞り込んでいる間は並べ替えられません">
      <span className="cursor-not-allowed">
        <GripVertical className="h-4 w-4 text-muted-foreground/40" />
      </span>
    </WithTooltip>
  ) : (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      className="cursor-grab rounded hover:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      aria-label={`「${group.name}」を並べ替える`}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground" />
    </button>
  )

  return (
    <div ref={setNodeRef} style={style}>
      <SubtotalGroupCard
        group={group}
        onEdit={onEdit}
        onDelete={onDelete}
        dragHandle={dragHandle}
      />
    </div>
  )
}
