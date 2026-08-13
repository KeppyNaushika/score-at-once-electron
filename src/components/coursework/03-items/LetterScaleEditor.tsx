"use client"

import type { DragEndEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { useMutation } from "@tanstack/react-query"
import { Plus, X } from "lucide-react"
import { useState } from "react"

import {
  DragHandle,
  SortableTableProvider,
  useSortableRow,
} from "@/components/common/sortable-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  createCourseworkLetterScaleMutation,
  deleteCourseworkLetterScaleMutation,
  reorderCourseworkLetterScalesMutation,
  updateCourseworkLetterScaleMutation,
} from "@/queries/coursework"
import type { CourseworkItemWithLetterScales } from "@/types/coursework.types"

/** 刻みの行 */
type LetterScale = CourseworkItemWithLetterScales["letterScales"][number]

/** 新しい行に付ける既定のラベル（項目内で未使用のもの） */
const DEFAULT_LABELS = ["A", "B", "C", "D", "E", "F"]

/** 入力中の文字を引くための鍵（DB の鍵ではなく、この画面だけの覚え） */
const editingKey = (letterScaleId: string, field: "label" | "score") =>
  `${letterScaleId}:${field}`

interface LetterScaleEditorProps {
  courseworkId: string
  /** 対象の評価項目。刻みは子として同梱されている */
  item: CourseworkItemWithLetterScales
}

/**
 * 文字評価（A/B/C 等）→ 点数の変換表エディタ。
 *
 * **1行ずつ書く。** かつては配列を `updateItem` へ載せており、項目名を1文字直す
 * だけで全行が delete → create されて id が振り直されていた。
 *
 * ラベルは項目内で一意（DB の `@@unique([courseworkItemId, label])`）。他の行と
 * 重複している間は書かず、赤枠で知らせる。入力中の文字だけを手元に持つのは、
 * 打鍵と取り直しの間に入力欄が元の値へ戻らないようにするため。
 */
export function LetterScaleEditor({
  courseworkId,
  item,
}: LetterScaleEditorProps) {
  const createLetterScale = useMutation(
    createCourseworkLetterScaleMutation(courseworkId)
  )
  const updateLetterScale = useMutation(
    updateCourseworkLetterScaleMutation(courseworkId)
  )
  const deleteLetterScale = useMutation(
    deleteCourseworkLetterScaleMutation(courseworkId)
  )
  const reorderLetterScales = useMutation(
    reorderCourseworkLetterScalesMutation(courseworkId)
  )

  const [editingText, setEditingText] = useState<ReadonlyMap<string, string>>(
    new Map()
  )

  const letterScales = [...item.letterScales].sort(
    (first, second) => first.order - second.order
  )

  const textOf = (letterScale: LetterScale, field: "label" | "score") =>
    editingText.get(editingKey(letterScale.id, field)) ??
    String(letterScale[field])

  const rememberText = (
    letterScale: LetterScale,
    field: "label" | "score",
    text: string
  ) => {
    setEditingText((previous) =>
      new Map(previous).set(editingKey(letterScale.id, field), text)
    )
  }

  const forgetText = (letterScale: LetterScale) => {
    setEditingText((previous) => {
      const next = new Map(previous)
      next.delete(editingKey(letterScale.id, "label"))
      next.delete(editingKey(letterScale.id, "score"))
      return next
    })
  }

  /** 他の行が既に使っているラベルか（一意制約に触れる状態か） */
  const isDuplicateLabel = (letterScale: LetterScale, label: string) =>
    letterScales.some(
      (other) => other.id !== letterScale.id && other.label === label.trim()
    )

  const changeLabel = (letterScale: LetterScale, text: string) => {
    rememberText(letterScale, "label", text)
    const label = text.trim()
    // 空・重複のままでは書かない（DB の一意制約に触れる）。次の打鍵で確定する
    if (label === "" || isDuplicateLabel(letterScale, label)) return
    updateLetterScale.mutate({ id: letterScale.id, label })
  }

  const changeScore = (letterScale: LetterScale, text: string) => {
    rememberText(letterScale, "score", text)
    const score = Number(text)
    if (text.trim() === "" || Number.isNaN(score)) return
    updateLetterScale.mutate({ id: letterScale.id, score })
  }

  const addRow = () => {
    const usedLabels = new Set(
      letterScales.map((letterScale) => letterScale.label)
    )
    const label =
      DEFAULT_LABELS.find((candidate) => !usedLabels.has(candidate)) ??
      `評価${letterScales.length + 1}`
    createLetterScale.mutate({
      courseworkItemId: item.id,
      label,
      score: 0,
      order: letterScales.length,
    })
  }

  const removeRow = (letterScale: LetterScale) => {
    forgetText(letterScale)
    deleteLetterScale.mutate(letterScale.id)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = letterScales.findIndex(
      (letterScale) => letterScale.id === active.id
    )
    const newIndex = letterScales.findIndex(
      (letterScale) => letterScale.id === over.id
    )
    if (oldIndex === -1 || newIndex === -1) return
    reorderLetterScales.mutate(
      arrayMove(letterScales, oldIndex, newIndex).map((letterScale, order) => ({
        id: letterScale.id,
        order,
      }))
    )
  }

  return (
    <div className="space-y-2 rounded border border-dashed bg-muted/30 p-2">
      <p className="text-xs font-medium text-muted-foreground">
        評価記号 → 点数の変換表
      </p>
      <div className="space-y-1">
        <SortableTableProvider
          items={letterScales.map((letterScale) => letterScale.id)}
          onDragEnd={handleDragEnd}
        >
          {letterScales.map((letterScale) => {
            const label = textOf(letterScale, "label")
            return (
              <ScaleRow
                key={letterScale.id}
                letterScale={letterScale}
                label={label}
                score={textOf(letterScale, "score")}
                isLabelInvalid={
                  label.trim() === "" || isDuplicateLabel(letterScale, label)
                }
                onChangeLabel={changeLabel}
                onChangeScore={changeScore}
                onBlur={forgetText}
                onRemove={removeRow}
              />
            )
          })}
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

interface ScaleRowProps {
  letterScale: LetterScale
  label: string
  score: string
  isLabelInvalid: boolean
  onChangeLabel: (letterScale: LetterScale, text: string) => void
  onChangeScore: (letterScale: LetterScale, text: string) => void
  onBlur: (letterScale: LetterScale) => void
  onRemove: (letterScale: LetterScale) => void
}

/** ドラッグ&ドロップで並べ替え可能な変換表の1行 */
function ScaleRow({
  letterScale,
  label,
  score,
  isLabelInvalid,
  onChangeLabel,
  onChangeScore,
  onBlur,
  onRemove,
}: ScaleRowProps) {
  const { setNodeRef, style, dragHandleProps } = useSortableRow(letterScale.id)

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <DragHandle dragHandleProps={dragHandleProps} />
      <Input
        value={label}
        onChange={(e) => onChangeLabel(letterScale, e.target.value)}
        onBlur={() => onBlur(letterScale)}
        className={cn(
          "h-7 w-20 text-xs",
          isLabelInvalid && "border-red-500 focus-visible:ring-red-500"
        )}
        placeholder="記号"
        title={isLabelInvalid ? "記号は項目の中で重複できません" : undefined}
      />
      <span className="text-xs text-muted-foreground">=</span>
      <Input
        value={score}
        onChange={(e) => onChangeScore(letterScale, e.target.value)}
        onBlur={() => onBlur(letterScale)}
        className="h-7 w-24 text-xs"
        type="number"
        step="any"
        placeholder="点数"
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => onRemove(letterScale)}
        title="削除"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}
