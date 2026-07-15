"use client"

import { Check, Pencil, Trash2, X } from "lucide-react"
import { useState } from "react"

import { DragHandle, useSortableRow } from "@/components/common/sortable-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
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
  dataSource: GradeDataSourceWithRelations
  /** 同じGrade内の全DataSource（推定ソース選択用） */
  allDataSources: GradeDataSourceWithRelations[]
  /** このソースのモデル適合度 R（手法選択popoverの判断材料） */
  sourceFit?: { correlation: number; sampleSize: number } | null
  /** 欠測一括設定モード中はチェックボックスを表示する */
  batchMode: boolean
  /** 一括設定の選択状態 */
  selected: boolean
  /** チェックボックスの選択トグル */
  onToggleSelect: (id: string) => void
  onUpdate: (
    id: string,
    data: {
      name?: string
      weight?: number
      absentMethod?: string
      absentRatio?: number
      absentOffset?: number
      treatExpectedAsMissing?: boolean
      estimationMode?: string
      estimationSourceIds?: string[]
    }
  ) => Promise<{ success: boolean }>
  onDelete: (id: string) => Promise<{ success: boolean }>
}

export function DataSourceRow({
  dataSource,
  allDataSources,
  sourceFit,
  batchMode,
  selected,
  onToggleSelect,
  onUpdate,
  onDelete,
}: DataSourceRowProps) {
  const { setNodeRef, style, dragHandleProps } = useSortableRow(dataSource.id)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(dataSource.name)
  const [weight, setWeight] = useState(String(dataSource.weight))

  const isCoursework =
    dataSource.type === "coursework" || dataSource.type === "coursework_total"
  // 満点は元データ（設問配点 / 評価項目満点）からライブ算出した値をバックエンドが
  // 全型で dataSource.maxScore に載せて返す。ここでは表示のみで編集不可。
  const displayMaxScore = dataSource.maxScore

  const handleSave = async () => {
    await onUpdate(dataSource.id, {
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
          <span className="text-muted-foreground text-xs">
            満点: {displayMaxScore}
          </span>
          <Input
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="h-8 w-20"
            type="text"
            placeholder="換算満点"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleSave}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setEditing(false)}
          >
            <X className="h-4 w-4" />
          </Button>
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
      className="bg-background flex items-center justify-between rounded border p-2"
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
          <span className="text-muted-foreground text-xs">({sourceRef})</span>
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
          dataSource={dataSource}
          allDataSources={allDataSources}
          sourceFit={sourceFit}
          onUpdate={onUpdate}
        />
      </div>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground text-xs">
          満点: {displayMaxScore} / 換算満点: {dataSource.weight}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive h-7 w-7"
          onClick={() => onDelete(dataSource.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
