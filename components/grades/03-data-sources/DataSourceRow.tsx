"use client"

import { Check, Pencil, Trash2, X } from "lucide-react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { GradeDataSourceWithDetails } from "@/types/grade.types"

import { EstimationSettingsPopover } from "./EstimationSettingsPopover"

const TYPE_LABELS: Record<string, string> = {
  project_total: "合計",
  subtotal: "小計",
  crop_region: "設問",
  manual: "外部",
}

interface DataSourceRowProps {
  dataSource: GradeDataSourceWithDetails
  /** 同じGrade内の全DataSource（推定ソース選択用） */
  allDataSources: GradeDataSourceWithDetails[]
  onUpdate: (
    id: string,
    data: {
      name?: string
      maxScore?: number
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
  onUpdate,
  onDelete,
}: DataSourceRowProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(dataSource.name)
  const [maxScore, setMaxScore] = useState(String(dataSource.maxScore))
  const [weight, setWeight] = useState(String(dataSource.weight))

  const handleSave = async () => {
    await onUpdate(dataSource.id, {
      name,
      maxScore: Number(maxScore),
      weight: Number(weight),
    })
    setEditing(false)
  }

  const typeLabel = TYPE_LABELS[dataSource.type] ?? dataSource.type

  if (editing) {
    return (
      <div className="space-y-2 rounded border p-2">
        <div className="flex items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 flex-1"
            placeholder="名前"
          />
          <Input
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
            className="h-8 w-20"
            type="number"
            placeholder="満点"
          />
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
    return null
  })()

  return (
    <div className="flex items-center justify-between rounded border p-2">
      <div className="flex items-center gap-3">
        <Badge variant={dataSource.type === "manual" ? "secondary" : "default"}>
          {typeLabel}
        </Badge>
        <span className="text-sm font-medium">{dataSource.name}</span>
        {sourceRef && (
          <span className="text-muted-foreground text-xs">({sourceRef})</span>
        )}
        <EstimationSettingsPopover
          dataSource={dataSource}
          allDataSources={allDataSources}
          onUpdate={onUpdate}
        />
      </div>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground text-xs">
          満点: {dataSource.maxScore} / 換算満点: {dataSource.weight}
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
