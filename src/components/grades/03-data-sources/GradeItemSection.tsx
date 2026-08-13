"use client"

import { useMutation } from "@tanstack/react-query"
import { Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { DragHandle, useSortableRow } from "@/components/common/sortable-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  deleteGradeItemMutation,
  renameGradeItemMutation,
} from "@/queries/grade"
import type { GradeItemWithDataSources } from "@/types/grade.types"

interface GradeItemSectionProps {
  gradeId: string
  gradeItem: GradeItemWithDataSources
  /** 配下のデータソース一覧と追加フォーム */
  children: React.ReactNode
}

/**
 * 評価項目1件の枠。並び替え（ドラッグ）・名称のインライン編集・削除を担う。
 *
 * 配下のデータソース一覧は children として受け取るため、データソース側の DnD は
 * この枠の内側で別の DndContext として完結する（掴む要素が重ならないので競合しない）。
 */
export function GradeItemSection({
  gradeId,
  gradeItem,
  children,
}: GradeItemSectionProps) {
  const renameGradeItem = useMutation(renameGradeItemMutation(gradeId))
  const deleteGradeItem = useMutation(deleteGradeItemMutation(gradeId))
  const { setNodeRef, style, dragHandleProps } = useSortableRow(gradeItem.id)
  // null は非編集中。編集中の名前そのものを状態に持ち、フラグを別に持たない
  const [editingName, setEditingName] = useState<string | null>(null)

  const handleSaveName = async () => {
    const trimmedName = editingName?.trim()
    if (!trimmedName) return
    await renameGradeItem.mutateAsync({
      id: gradeItem.id,
      name: trimmedName,
    })
    setEditingName(null)
  }

  const handleDelete = async () => {
    const result = await deleteGradeItem.mutateAsync(gradeItem.id)
    // 制約ルールの集計対象が変わると判定の意味が変わるため無効化される。
    // 黙って着色が消えるのを避け、その場で知らせる。
    if (result.disabledConstraintNames.length > 0) {
      toast.warning(
        `制約ルール「${result.disabledConstraintNames.join("」「")}」を無効化しました（集計対象が変わったため再設定してください）`
      )
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="mb-8 flex gap-2 rounded-lg border p-4"
    >
      <DragHandle dragHandleProps={dragHandleProps} className="mt-1 h-fit" />
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center justify-between">
          {editingName !== null ? (
            <div className="flex items-center gap-2">
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="h-8 w-48"
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  !e.nativeEvent.isComposing &&
                  handleSaveName()
                }
                autoFocus
              />
              <Button variant="ghost" size="sm" onClick={handleSaveName}>
                保存
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingName(null)}
              >
                取消
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-blue-600">
                {gradeItem.name}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setEditingName(gradeItem.name)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={() => void handleDelete()}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {children}
      </div>
    </div>
  )
}
