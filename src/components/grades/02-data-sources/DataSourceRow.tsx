"use client"

import { useMutation } from "@tanstack/react-query"
import { Check, ExternalLink, Pencil, Trash2, X } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import ConfirmationModal from "@/components/common/ConfirmationModal"
import { DragHandle, useSortableRow } from "@/components/common/sortable-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  courseworkWorkflowSteps,
  workflowStepHref,
} from "@/lib/shared/workflowSteps"
import {
  deleteDataSourceMutation,
  renameDataSourceMutation,
} from "@/queries/grade"
import type { GradeDataSourceWithRelations } from "@/types/grade.types"

import { EstimationSettingsPopover } from "./EstimationSettingsPopover"

const TYPE_LABELS: Record<string, string> = {
  exam_total: "合計",
  subtotal: "小計",
  crop_region: "設問",
  coursework: "資料",
  coursework_total: "資料合計",
}

interface DataSourceRowProps {
  gradeId: string
  dataSource: GradeDataSourceWithRelations
  /** 同じGrade内の全DataSource（推定ソース選択用） */
  allDataSources: GradeDataSourceWithRelations[]
  /** このソースのモデル適合度 R（手法選択popoverの判断材料） */
  sourceFit?: { correlation: number; sampleSize: number } | null
  /**
   * 資料の評価項目を指すときの点数の入り具合（成績の対象者で数える）。
   * 点数の入力は資料のページでするので、ここは数えて見せて行き先を示すだけ
   */
  courseworkInput: { enteredCount: number; studentCount: number } | null
  /** 欠測一括設定モード中はチェックボックスを表示する */
  batchMode: boolean
  /** 一括設定の選択状態 */
  selected: boolean
  /** チェックボックスの選択トグル */
  onToggleSelect: (id: string) => void
}

export function DataSourceRow({
  gradeId,
  dataSource,
  allDataSources,
  sourceFit,
  courseworkInput,
  batchMode,
  selected,
  onToggleSelect,
}: DataSourceRowProps) {
  const renameDataSource = useMutation(renameDataSourceMutation(gradeId))
  const deleteDataSource = useMutation(deleteDataSourceMutation(gradeId))
  const { setNodeRef, style, dragHandleProps } = useSortableRow(dataSource.id)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(dataSource.name)
  const [weight, setWeight] = useState(String(dataSource.weight))
  // 押しただけでは消さない。欠測の推定元に使っている他のソースにも響くため
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)

  const isCoursework =
    dataSource.type === "coursework" || dataSource.type === "coursework_total"
  // 満点は元データ（設問配点 / 評価項目満点）からライブ算出した値をバックエンドが
  // 全型で dataSource.maxScore に載せて返す。ここでは表示のみで編集不可。
  const displayMaxScore = dataSource.maxScore

  const handleSave = async () => {
    await renameDataSource.mutateAsync({
      id: dataSource.id,
      name,
      weight: Number(weight),
    })
    setEditing(false)
  }

  const typeLabel = TYPE_LABELS[dataSource.type] ?? dataSource.type

  if (editing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="space-y-2 rounded border p-2"
      >
        <div className="flex items-center gap-2">
          {batchMode && (
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggleSelect(dataSource.id)}
            />
          )}
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 flex-1"
            placeholder="名前"
          />
          {/* 満点は元データ追従のため編集不可（表示のみ） */}
          <span className="text-xs text-muted-foreground">
            満点: {displayMaxScore}
          </span>
          <Input
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="h-8 w-20"
            type="text"
            placeholder="換算満点"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="保存"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleSave}
              >
                <Check className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>保存</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="キャンセル"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setEditing(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>キャンセル</TooltipContent>
          </Tooltip>
        </div>
      </div>
    )
  }

  // ソース参照先の表示テキスト
  const sourceRef = (() => {
    if (dataSource.exam) {
      const parts = [dataSource.exam.examName]
      if (dataSource.subtotal) parts.push(dataSource.subtotal.name)
      if (dataSource.cropRegion) parts.push(dataSource.cropRegion.label)
      return parts.join(" > ")
    }
    if (dataSource.courseworkItem) {
      return `${dataSource.courseworkItem.coursework.name} > ${dataSource.courseworkItem.name}`
    }
    if (dataSource.coursework) {
      return `${dataSource.coursework.name} > 全項目`
    }
    return null
  })()

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between rounded border bg-background p-2"
    >
      <div className="flex items-center gap-3">
        <DragHandle dragHandleProps={dragHandleProps} />
        {batchMode && (
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect(dataSource.id)}
          />
        )}
        <Badge variant={isCoursework ? "secondary" : "default"}>
          {typeLabel}
        </Badge>
        <span className="text-sm font-medium">{dataSource.name}</span>
        {sourceRef && (
          <span className="text-xs text-muted-foreground">({sourceRef})</span>
        )}
        {isCoursework && dataSource.courseworkItem?.inputMode === "letter" && (
          <Badge variant="outline" className="text-xs font-normal">
            文字評価:{" "}
            {dataSource.courseworkItem.letterScales
              .map((letterScale) => `${letterScale.label}=${letterScale.score}`)
              .join(", ") || "未設定"}
          </Badge>
        )}
        <EstimationSettingsPopover
          gradeId={gradeId}
          dataSource={dataSource}
          allDataSources={allDataSources}
          sourceFit={sourceFit}
        />
      </div>
      <div className="flex items-center gap-3">
        {courseworkInput && dataSource.courseworkItem && (
          <>
            <span className="text-xs text-muted-foreground">
              入力済み: {courseworkInput.enteredCount}/
              {courseworkInput.studentCount}名
            </span>
            <Button asChild variant="ghost" size="sm" className="h-7">
              <Link
                href={workflowStepHref(
                  `/coursework/${dataSource.courseworkItem.coursework.id}`,
                  courseworkWorkflowSteps,
                  "04-scores"
                )}
              >
                <ExternalLink className="mr-1 h-3 w-3" />
                資料を開く
              </Link>
            </Button>
          </>
        )}
        <span className="text-xs text-muted-foreground">
          満点: {displayMaxScore} / 換算満点: {dataSource.weight}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label="データソースを編集"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>データソースを編集</TooltipContent>
        </Tooltip>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive"
          onClick={() => setIsDeleteConfirmOpen(true)}
          aria-label={`データソース「${dataSource.name}」を削除`}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <ConfirmationModal
        open={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        title="データソースを削除しますか？"
        description={`「${dataSource.name}」をこの評価項目から外します。元の試験や資料の点数は消えませんが、欠測の推定元にこのデータソースを選んでいた設定からは外れます。`}
        confirmText="削除"
        variant="destructive"
        icon="trash"
        onConfirm={() => {
          setIsDeleteConfirmOpen(false)
          deleteDataSource.mutate(dataSource.id)
        }}
      />
    </div>
  )
}
