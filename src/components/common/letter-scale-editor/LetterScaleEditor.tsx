"use client"

import type { DragEndEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { Plus, X } from "lucide-react"

import {
  DragHandle,
  SortableTableProvider,
  useSortableRow,
} from "@/components/common/sortable-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/** 文字評価→点数の変換表エディタの行（入力中は文字列で保持） */
export interface LetterScaleDraft {
  label: string
  score: string
}

interface LetterScaleEditorProps {
  scales: LetterScaleDraft[]
  onChange: (scales: LetterScaleDraft[]) => void
}

/** よく使う3段階プリセット（A=100, B=80, C=60） */
export const DEFAULT_LETTER_SCALES: LetterScaleDraft[] = [
  { label: "A", score: "100" },
  { label: "B", score: "80" },
  { label: "C", score: "60" },
]

interface ScaleRowProps {
  id: string
  scale: LetterScaleDraft
  index: number
  onUpdate: (index: number, patch: Partial<LetterScaleDraft>) => void
  onRemove: (index: number) => void
}

/** ドラッグ&ドロップで並べ替え可能な変換表の1行 */
function ScaleRow({ id, scale, index, onUpdate, onRemove }: ScaleRowProps) {
  const { setNodeRef, style, dragHandleProps } = useSortableRow(id)

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <DragHandle dragHandleProps={dragHandleProps} />
      <Input
        value={scale.label}
        onChange={(e) => onUpdate(index, { label: e.target.value })}
        className="h-7 w-20 text-xs"
        placeholder="記号"
      />
      <span className="text-muted-foreground text-xs">=</span>
      <Input
        value={scale.score}
        onChange={(e) => onUpdate(index, { score: e.target.value })}
        className="h-7 w-24 text-xs"
        type="number"
        step="any"
        placeholder="点数"
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => onRemove(index)}
        title="削除"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}

/**
 * 文字評価（A/B/C 等）→ 点数の変換表エディタ
 * manual型データソース + 文字モード時に使用する。
 * 行はドラッグ&ドロップで並べ替えできる（順番が保存時の order になる）。
 */
export function LetterScaleEditor({
  scales,
  onChange,
}: LetterScaleEditorProps) {
  const updateRow = (index: number, patch: Partial<LetterScaleDraft>) => {
    onChange(scales.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  const removeRow = (index: number) => {
    onChange(scales.filter((_, i) => i !== index))
  }

  const addRow = () => {
    onChange([...scales, { label: "", score: "" }])
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = Number(active.id)
    const newIndex = Number(over.id)
    if (isNaN(oldIndex) || isNaN(newIndex)) return
    onChange(arrayMove(scales, oldIndex, newIndex))
  }

  // 行のID（配列インデックスベース。並べ替えで配列順=order が決まる）
  const rowIds = scales.map((_, i) => String(i))

  return (
    <div className="bg-muted/30 space-y-2 rounded border border-dashed p-2">
      <p className="text-muted-foreground text-xs font-medium">
        評価記号 → 点数の変換表
      </p>
      <div className="space-y-1">
        <SortableTableProvider items={rowIds} onDragEnd={handleDragEnd}>
          {scales.map((scale, index) => (
            <ScaleRow
              key={index}
              id={String(index)}
              scale={scale}
              index={index}
              onUpdate={updateRow}
              onRemove={removeRow}
            />
          ))}
        </SortableTableProvider>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground h-6 text-xs"
        onClick={addRow}
      >
        <Plus className="mr-1 h-3 w-3" />
        評価を追加
      </Button>
    </div>
  )
}

/** 入力中ドラフトを、保存用の {label, score, order} 配列に変換（無効行は除外） */
export function draftsToLetterScales(
  scales: LetterScaleDraft[]
): { label: string; score: number; order: number }[] {
  return scales
    .map((s) => ({
      label: s.label.trim(),
      score: Number(s.score),
    }))
    .filter((s) => s.label !== "" && !isNaN(s.score))
    .map((s, index) => ({ label: s.label, score: s.score, order: index }))
}
