"use client"

import {
  ChevronDown,
  ChevronRight,
  Ellipsis,
  FileText,
  GripVertical,
  Hash,
  ListOrdered,
  MessageSquare,
  Pencil,
  ScanLine,
  Trash2,
  Trophy,
  User,
} from "lucide-react"
import type { ComponentType } from "react"
import { useState } from "react"

import { OmrConfigInlineForm } from "@/components/exams/03-region-info/components/OmrConfigInlineForm"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { CropRegionWithSubtotals } from "@/electron-src/lib/prisma/cropRegion"
import {
  CROP_REGION_AREA_TYPES,
  CropRegionAreaType,
} from "@/types/cropRegionAreaType.types"
import type { CropRegionOmrConfigWithOptions } from "@/types/omr.types"

// AreaTypeの日本語表示マッピング
const areaTypeToJapanese: Record<string, string> = {
  STUDENT_NAME: "氏名",
  STUDENT_ID: "生徒番号",
  QUESTION_ANSWER: "設問解答",
  TOTAL_SCORE: "合計点",
  SUBTOTAL_SCORE: "小計",
  MARK: "マーク",
  COMMENT: "コメント",
  OTHER: "その他",
}

type IconType = ComponentType<{ className?: string }>

const typeIcons: Record<CropRegionAreaType, IconType> = {
  ["QUESTION_ANSWER"]: FileText,
  ["STUDENT_NAME"]: User,
  ["STUDENT_ID"]: Hash,
  ["TOTAL_SCORE"]: Trophy,
  ["SUBTOTAL_SCORE"]: ListOrdered,
  ["MARK"]: Pencil,
  ["COMMENT"]: MessageSquare,
  ["OTHER"]: Ellipsis,
}

type RegionTableRowProps = {
  region: CropRegionWithSubtotals
  globalIndex: number
  isSelected: boolean
  isDragged: boolean
  isDraggedOver: boolean
  disabled: boolean
  omrConfig: CropRegionOmrConfigWithOptions | null
  onOmrSave: (data: {
    cropRegionId: string
    type: "choice"
    numChoices?: number | null
    choiceLayout?: string | null
    choiceOptions?: Array<{
      choiceIndex: number
      label: string
      isCorrect: boolean
    }>
  }) => Promise<boolean>
  onOmrDelete: (cropRegionId: string) => Promise<boolean>
  onRegionChange: (
    globalIndex: number,
    field: string,
    value: string | number | null
  ) => void
  onKeyDown: (
    e: React.KeyboardEvent,
    rowIndex: number,
    fieldName: string
  ) => void
  onCompositionStart: () => void
  onCompositionEnd: () => void
  onDelete: (globalIndex: number) => void
  onSelect: (globalIndex: number | null) => void
  onDragStart: (index: number) => void
  onDragOver: (e: React.DragEvent, index: number) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent, index: number) => void
  onDragEnd: () => void
}

export const RegionTableRow = ({
  region,
  globalIndex,
  isSelected,
  isDragged,
  isDraggedOver,
  disabled,
  omrConfig,
  onOmrSave,
  onOmrDelete,
  onRegionChange,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
  onDelete,
  onSelect,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: RegionTableRowProps) => {
  const [omrExpanded, setOmrExpanded] = useState(false)
  const regionType = region.type
  const isQuestionAnswer = regionType === "QUESTION_ANSWER"
  const hasOmrConfig = omrConfig !== null

  const isValidType = (type: string): type is CropRegionAreaType =>
    CROP_REGION_AREA_TYPES.includes(type as CropRegionAreaType)

  const IconComponent = isValidType(regionType)
    ? typeIcons[regionType]
    : typeIcons["OTHER"]

  const ensureSelected = () => {
    if (!isSelected) {
      onSelect(globalIndex)
    }
  }

  return (
    <>
      <tr
        key={region.id || `region-${globalIndex}`}
        draggable={!disabled}
        onDragStart={() => onDragStart(globalIndex)}
        onDragOver={(e) => onDragOver(e, globalIndex)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, globalIndex)}
        onDragEnd={onDragEnd}
        className={`hover:bg-accent/50 cursor-pointer transition-colors ${
          isSelected ? "bg-primary/10 border-primary" : ""
        } ${isDragged ? "opacity-50" : ""} ${
          isDraggedOver ? "border-t-4 border-t-blue-500" : ""
        }`}
        onClick={() => onSelect(isSelected ? null : globalIndex)}
      >
        <td className="border-border border px-2 py-1">
          <div className="flex items-center justify-center">
            <GripVertical className="text-muted-foreground h-4 w-4 cursor-grab" />
          </div>
        </td>
        <td className="border-border border px-2 py-1">
          <div className="flex items-center space-x-2">
            <IconComponent
              className={`h-4 w-4 shrink-0 ${
                isSelected ? "text-primary" : "text-muted-foreground"
              }`}
            />
            <span className="text-sm font-medium">{globalIndex + 1}</span>
          </div>
        </td>
        <td className="border-border border px-2 py-1 text-center">
          <div className="text-muted-foreground text-sm">
            {region.examPage ? region.examPage.pageNumber : "?"}
          </div>
        </td>
        <td className="border-border border px-2 py-1">
          <Select
            value={region.type}
            onValueChange={(value) =>
              onRegionChange(globalIndex, "type", value)
            }
            disabled={disabled}
          >
            <SelectTrigger className="w-full" onFocus={ensureSelected}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(CROP_REGION_AREA_TYPES).map((type) => (
                <SelectItem key={type} value={type}>
                  {areaTypeToJapanese[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
        <td className="border-border border px-2 py-1">
          <Input
            data-row={globalIndex}
            data-field="label"
            value={region.label || ""}
            onChange={(e) =>
              onRegionChange(globalIndex, "label", e.target.value)
            }
            onKeyDown={(e) => onKeyDown(e, globalIndex, "label")}
            onCompositionStart={onCompositionStart}
            onCompositionEnd={onCompositionEnd}
            onFocus={ensureSelected}
            disabled={disabled}
            placeholder="領域名を入力"
            className="h-8 w-full min-w-20"
          />
        </td>
        <td className="border-border border px-2 py-1">
          {region.type === "QUESTION_ANSWER" ? (
            <Input
              data-row={globalIndex}
              data-field="points"
              type="number"
              value={region.points ?? ""}
              onChange={(e) =>
                onRegionChange(globalIndex, "points", e.target.value)
              }
              onKeyDown={(e) => onKeyDown(e, globalIndex, "points")}
              onCompositionStart={onCompositionStart}
              onCompositionEnd={onCompositionEnd}
              onFocus={ensureSelected}
              disabled={disabled}
              placeholder="10"
              className="h-8 w-full min-w-20"
            />
          ) : (
            <span className="text-muted-foreground text-sm">-</span>
          )}
        </td>
        {/* OMR */}
        <td className="border-border border px-2 py-1 text-center">
          {isQuestionAnswer && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setOmrExpanded((prev) => !prev)
              }}
              className={`h-7 gap-1 ${hasOmrConfig ? "text-blue-600" : "text-muted-foreground"}`}
            >
              <ScanLine className="h-3.5 w-3.5" />
              {omrExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
          )}
        </td>
        <td className="border-border border px-2 py-1 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(globalIndex)
            }}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </td>
      </tr>
      {/* OMR設定アコーディオン展開行 */}
      {omrExpanded && isQuestionAnswer && (
        <tr>
          <td colSpan={8} className="border-border border px-4 py-2">
            <OmrConfigInlineForm
              cropRegionId={region.id}
              existingConfig={omrConfig}
              onSave={onOmrSave}
              onDelete={onOmrDelete}
            />
          </td>
        </tr>
      )}
    </>
  )
}
