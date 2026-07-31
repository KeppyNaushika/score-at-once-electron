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
  /**
   * UI編集中のみ有効な安定キー（React key / D&D 用）。
   * DBには保存されない ── draftsToLetterScales で {label,score,order} へ変換する際に落ちる。
   */
  id: string
  label: string
  score: string
}

interface LetterScaleEditorProps {
  scales: LetterScaleDraft[]
  onChange: (scales: LetterScaleDraft[]) => void
}

/** 変換表の行を1つ生成（UI編集用の安定 id を付与） */
function createLetterScaleDraft(label = "", score = ""): LetterScaleDraft {
  return { id: crypto.randomUUID(), label, score }
}

/** よく使う3段階プリセット（A=100, B=80, C=60） */
export function createDefaultLetterScales(): LetterScaleDraft[] {
  return [
    createLetterScaleDraft("A", "100"),
    createLetterScaleDraft("B", "80"),
    createLetterScaleDraft("C", "60"),
  ]
}

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
      <span className="text-xs text-muted-foreground">=</span>
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
    onChange(
      scales.map((scale, i) => (i === index ? { ...scale, ...patch } : scale))
    )
  }

  const removeRow = (index: number) => {
    onChange(scales.filter((_, i) => i !== index))
  }

  const addRow = () => {
    onChange([...scales, createLetterScaleDraft()])
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = scales.findIndex((scale) => scale.id === active.id)
    const newIndex = scales.findIndex((scale) => scale.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onChange(arrayMove(scales, oldIndex, newIndex))
  }

  // 行のID（安定 uuid。並べ替え・削除で要素に追従する）
  const rowIds = scales.map((scale) => scale.id)

  return (
    <div className="space-y-2 rounded border border-dashed bg-muted/30 p-2">
      <p className="text-xs font-medium text-muted-foreground">
        評価記号 → 点数の変換表
      </p>
      <div className="space-y-1">
        <SortableTableProvider items={rowIds} onDragEnd={handleDragEnd}>
          {scales.map((scale, index) => (
            <ScaleRow
              key={scale.id}
              id={scale.id}
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
        className="h-6 text-xs text-muted-foreground"
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
    .map((scale) => ({
      label: scale.label.trim(),
      score: Number(scale.score),
    }))
    .filter((scale) => scale.label !== "" && !isNaN(scale.score))
    .map((scale, index) => ({
      label: scale.label,
      score: scale.score,
      order: index,
    }))
}
