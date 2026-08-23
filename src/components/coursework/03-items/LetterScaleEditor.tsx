"use client"

import type { DragEndEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { useMutation } from "@tanstack/react-query"
import { Plus, X } from "lucide-react"

import {
  DragHandle,
  SortableTableProvider,
  useSortableRow,
} from "@/components/common/sortable-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useEditingText } from "@/hooks/useEditingText"
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

  const {
    textOf: editingTextOf,
    remember,
    forgetField,
    forget,
  } = useEditingText()

  const letterScales = [...item.letterScales].sort(
    (first, second) => first.order - second.order
  )

  const textOf = (letterScale: LetterScale, field: "label" | "score") =>
    editingTextOf(letterScale.id, field, String(letterScale[field]))

  /** 他の行が既に使っているラベルか（一意制約に触れる状態か） */
  const isDuplicateLabel = (letterScale: LetterScale, label: string) =>
    letterScales.some(
      (other) => other.id !== letterScale.id && other.label === label.trim()
    )

  const changeLabel = (letterScale: LetterScale, text: string) => {
    remember(letterScale.id, "label", text)
    const label = text.trim()
    // 空・重複のままでは書かない。次の打鍵で確定する。
    //
    // **DB が止めるからではない**（`(courseworkItemId, label)` の `@@unique` は
    // 2026-08-23 に外した）。同じ評語が2行あると換算に使われるのは片方だけで、
    // もう一方は何もしない幽霊になるので、自分の手では作らせない。
    // **他の端末から降ってくる重複は止められない**ので、そちらは赤で知らせる。
    if (label === "" || isDuplicateLabel(letterScale, label)) return
    updateLetterScale.mutate({ id: letterScale.id, label })
  }

  const changeScore = (letterScale: LetterScale, text: string) => {
    remember(letterScale.id, "score", text)
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
    forget(letterScale.id)
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
                labelIssue={
                  label.trim() === ""
                    ? "empty"
                    : isDuplicateLabel(letterScale, label)
                      ? "duplicate"
                      : null
                }
                onChangeLabel={changeLabel}
                onChangeScore={changeScore}
                onBlur={forgetField}
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

/**
 * 評語の欄が赤いときの理由。
 *
 * **2つを分けるのは、直し方が違うから。** 空欄は打てば済むが、重複は
 * 「どちらかを消す」しかない。しかも重複は**自分が作ったとは限らない**
 * （別の端末が同じ評語を作ると同期で2行そろう）ので、何が起きているかを
 * 言わないと消してよいのか判断できない。
 */
type LabelIssue = "empty" | "duplicate"

const LABEL_ISSUE_MESSAGE: Record<LabelIssue, string> = {
  empty: "記号を入れてください",
  duplicate:
    "同じ記号が2つあります。換算に使われるのは片方だけなので、要らない行を消してください",
}

interface ScaleRowProps {
  letterScale: LetterScale
  label: string
  score: string
  labelIssue: LabelIssue | null
  onChangeLabel: (letterScale: LetterScale, text: string) => void
  onChangeScore: (letterScale: LetterScale, text: string) => void
  /** 入力を離れた欄の覚えだけ捨てる（隣の欄はまだ入力中でありうる） */
  onBlur: (letterScaleId: string, field: "label" | "score") => void
  onRemove: (letterScale: LetterScale) => void
}

/** ドラッグ&ドロップで並べ替え可能な変換表の1行 */
function ScaleRow({
  letterScale,
  label,
  score,
  labelIssue,
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
        onBlur={() => onBlur(letterScale.id, "label")}
        className={cn(
          "h-7 w-20 text-xs",
          labelIssue && "border-red-500 focus-visible:ring-red-500"
        )}
        placeholder="記号"
        title={labelIssue ? LABEL_ISSUE_MESSAGE[labelIssue] : undefined}
      />
      <span className="text-xs text-muted-foreground">=</span>
      <Input
        value={score}
        onChange={(e) => onChangeScore(letterScale, e.target.value)}
        onBlur={() => onBlur(letterScale.id, "score")}
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
