"use client"

import type { DragEndEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { useMutation } from "@tanstack/react-query"
import { Plus, Trash2 } from "lucide-react"
import { useMemo } from "react"

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
  createGradeItemBoundaryMutation,
  deleteGradeItemBoundaryMutation,
  reorderGradeItemBoundariesMutation,
  updateGradeItemBoundaryMutation,
} from "@/queries/grade"
import type { GradeItemWithDataSources } from "@/types/grade.types"

interface BoundaryEditorProps {
  gradeId: string
  /** 対象の評価項目。境界が引かれていなければ boundaries は空配列 */
  gradeItem: GradeItemWithDataSources
}

/** 境界の行 */
type Boundary = GradeItemWithDataSources["boundaries"][number]

/**
 * 成績境界の編集コンポーネント
 *
 * ラベルと最低パーセンテージを編集し、**1打鍵ごとに即座に保存する**。DnDで行を
 * 並び替え可能。minPercentage が降順でない場合は赤い枠線で警告する。
 *
 * デバウンスは持たない。以前は500msまとめて全行を置き換えていたが、
 * 「画面には85と出ているが DB は80」という窓を作るうえ、離脱時に保存を捨てて
 * 最後の打鍵が消えていた。行ごとに書けば1回1レコードなので、まとめる理由が無い。
 *
 * 入力中の文字だけは手元に持つ。`""` や `"8."` は数値にできず、打鍵と取り直しの
 * 間に入力欄が元の値へ戻ってしまうため。
 */
export function BoundaryEditor({ gradeId, gradeItem }: BoundaryEditorProps) {
  const createBoundary = useMutation(createGradeItemBoundaryMutation(gradeId))
  const updateBoundary = useMutation(updateGradeItemBoundaryMutation(gradeId))
  const deleteBoundary = useMutation(deleteGradeItemBoundaryMutation(gradeId))
  const reorderBoundaries = useMutation(
    reorderGradeItemBoundariesMutation(gradeId)
  )

  const { textOf: editingTextOf, remember, forget } = useEditingText()

  // 表示順は order。以前は最低%の降順で並べていたため、DnD で並べ替えても
  // 見た目が戻り、並べ替えが効いていなかった。
  const boundaries = useMemo(
    () =>
      [...gradeItem.boundaries].sort(
        (first, second) => first.order - second.order
      ),
    [gradeItem.boundaries]
  )

  /** 表示する文字。入力中ならその文字、そうでなければ DB の値 */
  const textOf = (boundary: Boundary, field: "label" | "minPercentage") =>
    editingTextOf(boundary.id, field, String(boundary[field]))

  const changeLabel = (boundary: Boundary, text: string) => {
    remember(boundary.id, "label", text)
    // 空ラベルは書かない。最下位の境界として全生徒に空の評価が付いてしまう
    if (text.trim() === "") return
    updateBoundary.mutate({ id: boundary.id, label: text })
  }

  const changeMinPercentage = (boundary: Boundary, text: string) => {
    remember(boundary.id, "minPercentage", text)
    const parsed = Number(text)
    // 入力途中（空・`8.` など）は保存しない。次の打鍵で確定する
    if (text.trim() === "" || Number.isNaN(parsed)) return
    updateBoundary.mutate({ id: boundary.id, minPercentage: parsed })
  }

  // 隣り合う行で最低%が降順になっていないものに印を付ける。表示順（order）で
  // 見るので、並べ替えた結果が矛盾していればその場で分かる。
  const invalidBoundaryIds = useMemo(() => {
    const invalid = new Set<string>()
    boundaries.forEach((boundary, index) => {
      const next = boundaries[index + 1]
      if (!next) return
      if (Number(boundary.minPercentage) <= Number(next.minPercentage)) {
        invalid.add(boundary.id)
        invalid.add(next.id)
      }
    })
    return invalid
  }, [boundaries])

  const addRow = () => {
    createBoundary.mutate({
      gradeItemId: gradeItem.id,
      label: "",
      minPercentage: 0,
      order: boundaries.length,
    })
  }

  const removeRow = (boundary: Boundary) => {
    forget(boundary.id)
    deleteBoundary.mutate(boundary.id)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = boundaries.findIndex(
      (boundary) => boundary.id === active.id
    )
    const newIndex = boundaries.findIndex((boundary) => boundary.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    reorderBoundaries.mutate(
      arrayMove(boundaries, oldIndex, newIndex).map((boundary, index) => ({
        id: boundary.id,
        order: index,
      }))
    )
  }

  const boundaryIds = useMemo(
    () => boundaries.map((boundary) => boundary.id),
    [boundaries]
  )

  return (
    <div className="space-y-3">
      {boundaries.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          境界が設定されていません。プリセットを選択するか手動で追加してください。
        </p>
      ) : (
        <SortableTableProvider items={boundaryIds} onDragEnd={handleDragEnd}>
          <div className="space-y-2">
            <div className="grid grid-cols-[28px_1fr_120px_40px] gap-2 text-xs font-medium">
              <span />
              <span>ラベル</span>
              <span>最低 %</span>
              <span />
            </div>
            {boundaries.map((boundary) => (
              <BoundaryRow
                key={boundary.id}
                boundary={boundary}
                label={textOf(boundary, "label")}
                minPercentage={textOf(boundary, "minPercentage")}
                isInvalid={invalidBoundaryIds.has(boundary.id)}
                onChangeLabel={changeLabel}
                onChangeMinPercentage={changeMinPercentage}
                onBlur={(boundary) => forget(boundary.id)}
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
  boundary: Boundary
  label: string
  minPercentage: string
  isInvalid: boolean
  onChangeLabel: (boundary: Boundary, text: string) => void
  onChangeMinPercentage: (boundary: Boundary, text: string) => void
  onBlur: (boundary: Boundary) => void
  onRemove: (boundary: Boundary) => void
}

function BoundaryRow({
  boundary,
  label,
  minPercentage,
  isInvalid,
  onChangeLabel,
  onChangeMinPercentage,
  onBlur,
  onRemove,
}: BoundaryRowProps) {
  const { setNodeRef, style, dragHandleProps } = useSortableRow(boundary.id)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-[28px_1fr_120px_40px] gap-2"
    >
      <DragHandle dragHandleProps={dragHandleProps} />
      <Input
        value={label}
        onChange={(e) => onChangeLabel(boundary, e.target.value)}
        onBlur={() => onBlur(boundary)}
        placeholder="例: A"
        className="h-8"
      />
      <Input
        type="number"
        value={minPercentage}
        onChange={(e) => onChangeMinPercentage(boundary, e.target.value)}
        onBlur={() => onBlur(boundary)}
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
        onClick={() => onRemove(boundary)}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  )
}
