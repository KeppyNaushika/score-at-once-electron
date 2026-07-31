"use client"

import type { DragEndEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { Plus, Trash2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  DragHandle,
  SortableTableProvider,
  useSortableRow,
} from "@/components/common/sortable-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { GradeBoundaryData } from "@/types/grade.types"

interface BoundaryEditorProps {
  boundaries: GradeBoundaryData[]
  onSave: (
    boundaries: { label: string; minPercentage: number; order: number }[]
  ) => Promise<void>
}

interface EditableBoundary {
  id: string
  label: string
  minPercentage: string
}

let nextId = 1

/**
 * 成績境界の編集コンポーネント
 *
 * ラベルと最低パーセンテージの組み合わせを編集し、変更を500msデバウンスで自動保存する。
 * DnDで行を並び替え可能。minPercentageが降順でない場合は赤い枠線で警告する。
 */
export function BoundaryEditor({ boundaries, onSave }: BoundaryEditorProps) {
  const [items, setItems] = useState<EditableBoundary[]>([])
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (boundaries.length > 0) {
      const sorted = [...boundaries].sort(
        (firstBoundary, secondBoundary) =>
          secondBoundary.minPercentage - firstBoundary.minPercentage
      )
      setItems(
        sorted.map((boundary) => ({
          id: `boundary-${nextId++}`,
          label: boundary.label,
          minPercentage: String(boundary.minPercentage),
        }))
      )
    }
  }, [boundaries])

  const debouncedSave = useCallback(
    (updatedItems: EditableBoundary[]) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(async () => {
        const validItems = updatedItems
          .filter((item) => item.label.trim())
          .map((item, index) => ({
            label: item.label.trim(),
            minPercentage: Number(item.minPercentage) || 0,
            order: index,
          }))
        await onSave(validItems)
      }, 500)
    },
    [onSave]
  )

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const invalidRows = useMemo(() => {
    const invalid = new Set<number>()
    for (let i = 0; i < items.length - 1; i++) {
      const current = Number(items[i].minPercentage) || 0
      const next = Number(items[i + 1].minPercentage) || 0
      if (current <= next) {
        invalid.add(i)
        invalid.add(i + 1)
      }
    }
    return invalid
  }, [items])

  const addRow = () => {
    const newItems = [
      ...items,
      { id: `boundary-${nextId++}`, label: "", minPercentage: "0" },
    ]
    setItems(newItems)
  }

  const removeRow = (index: number) => {
    const newItems = items.filter((_, i) => i !== index)
    setItems(newItems)
    debouncedSave(newItems)
  }

  const updateRow = (
    index: number,
    field: "label" | "minPercentage",
    value: string
  ) => {
    const newItems = items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    )
    setItems(newItems)
    debouncedSave(newItems)
  }

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = items.findIndex((item) => item.id === active.id)
      const newIndex = items.findIndex((item) => item.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return
      const newItems = arrayMove(items, oldIndex, newIndex)
      setItems(newItems)
      debouncedSave(newItems)
    },
    [items, debouncedSave]
  )

  const itemIds = useMemo(() => items.map((item) => item.id), [items])

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          境界が設定されていません。プリセットを選択するか手動で追加してください。
        </p>
      ) : (
        <SortableTableProvider items={itemIds} onDragEnd={handleDragEnd}>
          <div className="space-y-2">
            <div className="grid grid-cols-[28px_1fr_120px_40px] gap-2 text-xs font-medium">
              <span />
              <span>ラベル</span>
              <span>最低 %</span>
              <span />
            </div>
            {items.map((item, index) => (
              <BoundaryRow
                key={item.id}
                item={item}
                index={index}
                isInvalid={invalidRows.has(index)}
                onUpdate={updateRow}
                onRemove={removeRow}
              />
            ))}
          </div>
        </SortableTableProvider>
      )}

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={addRow}>
          <Plus className="mr-1 h-3 w-3" />
          行を追加
        </Button>
        <span className="text-xs text-muted-foreground">
          変更は自動保存されます
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BoundaryRow — DnD対応の個別行
// ---------------------------------------------------------------------------

interface BoundaryRowProps {
  item: EditableBoundary
  index: number
  isInvalid: boolean
  onUpdate: (
    index: number,
    field: "label" | "minPercentage",
    value: string
  ) => void
  onRemove: (index: number) => void
}

function BoundaryRow({
  item,
  index,
  isInvalid,
  onUpdate,
  onRemove,
}: BoundaryRowProps) {
  const { setNodeRef, style, dragHandleProps } = useSortableRow(item.id)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-[28px_1fr_120px_40px] gap-2"
    >
      <DragHandle dragHandleProps={dragHandleProps} />
      <Input
        value={item.label}
        onChange={(e) => onUpdate(index, "label", e.target.value)}
        placeholder="例: A"
        className="h-8"
      />
      <Input
        type="number"
        value={item.minPercentage}
        onChange={(e) => onUpdate(index, "minPercentage", e.target.value)}
        min={0}
        max={100}
        className={cn(
          "h-8",
          isInvalid && "border-red-500 focus-visible:ring-red-500"
        )}
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive"
        onClick={() => onRemove(index)}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  )
}
