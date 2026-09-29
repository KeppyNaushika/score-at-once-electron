"use client"

import type { DragEndEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { useMutation } from "@tanstack/react-query"
import { Plus, Trash2 } from "lucide-react"
import { useState } from "react"

import {
  DragHandle,
  SortableTableProvider,
  useSortableRow,
} from "@/components/common/sortable-table"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createGradeComparisonMutation,
  deleteGradeComparisonMutation,
  type GradeComparisonRow,
  reorderGradeComparisonsMutation,
} from "@/queries/grade"
import type {
  GradeItemWithDataSources,
  GradeSummary,
} from "@/types/grade.types"

interface GradeItemComparisonsProps {
  gradeId: string
  gradeItem: GradeItemWithDataSources
  /** この評価項目に付いた比較（登録順） */
  comparisons: GradeComparisonRow[]
  /** 相手に選べる成績算出（この成績算出も含む） */
  candidateGrades: GradeSummary[]
}

/** 比較の相手の表示名。この成績算出の項目なら成績算出名を省く */
function comparedLabel(comparison: GradeComparisonRow, gradeId: string) {
  const comparedGradeItem = comparison.comparedGradeItem
  return comparedGradeItem.gradeId === gradeId
    ? `${comparedGradeItem.name}（この成績算出）`
    : `${comparedGradeItem.grade.name} > ${comparedGradeItem.name}`
}

function ComparisonRow({
  gradeId,
  comparison,
  position,
}: {
  gradeId: string
  comparison: GradeComparisonRow
  /** 結果の表で左から何番目の記号になるか（1始まり） */
  position: number
}) {
  const deleteComparison = useMutation(deleteGradeComparisonMutation(gradeId))
  const { setNodeRef, style, dragHandleProps } = useSortableRow(comparison.id)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between rounded border bg-background p-2"
    >
      <div className="flex items-center gap-3">
        <DragHandle dragHandleProps={dragHandleProps} />
        <span className="w-5 text-right text-xs text-muted-foreground tabular-nums">
          {position}
        </span>
        <span className="text-sm">{comparedLabel(comparison, gradeId)}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-destructive"
        onClick={() => deleteComparison.mutate(comparison.id)}
        aria-label={`比較「${comparedLabel(comparison, gradeId)}」を削除`}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  )
}

/**
 * 評価項目1つ分の比較の一覧と追加欄。
 *
 * 並び順は結果の表で記号が並ぶ順そのもの。
 */
export function GradeItemComparisons({
  gradeId,
  gradeItem,
  comparisons,
  candidateGrades,
}: GradeItemComparisonsProps) {
  const createComparison = useMutation(createGradeComparisonMutation(gradeId))
  const reorderComparisons = useMutation(
    reorderGradeComparisonsMutation(gradeId)
  )
  const [selectedGradeId, setSelectedGradeId] = useState<string>("")
  const [selectedGradeItemId, setSelectedGradeItemId] = useState<string>("")

  // 自分自身と、既に比べている項目は選ばせない（同じ組の二重登録は画面で防ぐ）
  const comparedGradeItemIds = new Set(
    comparisons.map((comparison) => comparison.comparedGradeItemId)
  )
  const selectedGrade = candidateGrades.find(
    (candidateGrade) => candidateGrade.id === selectedGradeId
  )
  const selectableGradeItems = (selectedGrade?.gradeItems ?? []).filter(
    (candidateGradeItem) =>
      candidateGradeItem.id !== gradeItem.id &&
      !comparedGradeItemIds.has(candidateGradeItem.id)
  )

  const handleAdd = async () => {
    if (!selectedGradeItemId) return
    await createComparison.mutateAsync({
      gradeItemId: gradeItem.id,
      comparedGradeItemId: selectedGradeItemId,
    })
    setSelectedGradeItemId("")
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = comparisons.findIndex(
      (comparison) => comparison.id === active.id
    )
    const newIndex = comparisons.findIndex(
      (comparison) => comparison.id === over.id
    )
    if (oldIndex === -1 || newIndex === -1) return
    reorderComparisons.mutate(
      arrayMove(comparisons, oldIndex, newIndex).map((comparison, index) => ({
        id: comparison.id,
        order: index,
      }))
    )
  }

  return (
    <Card className="space-y-3 p-4">
      <h3 className="text-base font-semibold">{gradeItem.name}</h3>

      {comparisons.length === 0 ? (
        <p className="text-sm text-muted-foreground">比較はありません</p>
      ) : (
        <SortableTableProvider
          items={comparisons.map((comparison) => comparison.id)}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-2">
            {comparisons.map((comparison, index) => (
              <ComparisonRow
                key={comparison.id}
                gradeId={gradeId}
                comparison={comparison}
                position={index + 1}
              />
            ))}
          </div>
        </SortableTableProvider>
      )}

      <div className="flex items-center gap-2">
        <Select
          value={selectedGradeId}
          onValueChange={(value) => {
            setSelectedGradeId(value)
            setSelectedGradeItemId("")
          }}
        >
          <SelectTrigger className="h-8 w-64">
            <SelectValue placeholder="成績算出を選択" />
          </SelectTrigger>
          <SelectContent>
            {candidateGrades.map((candidateGrade) => (
              <SelectItem key={candidateGrade.id} value={candidateGrade.id}>
                {candidateGrade.id === gradeId
                  ? `${candidateGrade.name}（この成績算出）`
                  : candidateGrade.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={selectedGradeItemId}
          onValueChange={setSelectedGradeItemId}
          disabled={selectableGradeItems.length === 0}
        >
          <SelectTrigger className="h-8 w-56">
            <SelectValue
              placeholder={
                selectedGrade && selectableGradeItems.length === 0
                  ? "選べる評価項目がありません"
                  : "評価項目を選択"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {selectableGradeItems.map((candidateGradeItem) => (
              <SelectItem
                key={candidateGradeItem.id}
                value={candidateGradeItem.id}
              >
                {candidateGradeItem.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          onClick={handleAdd}
          disabled={!selectedGradeItemId || createComparison.isPending}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          追加
        </Button>
      </div>
    </Card>
  )
}
