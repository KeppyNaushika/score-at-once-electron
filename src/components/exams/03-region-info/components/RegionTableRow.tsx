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
import type { CropRegionRow } from "@/queries/cropRegion"
import type { CropRegionAreaType } from "@/types/cropRegionAreaType.types"
import { CROP_REGION_AREA_TYPES } from "@/types/cropRegionAreaType.types"
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
  region: CropRegionRow
  /** 表の中での並び（`#` 列の番号と、ドラッグの相手を指すのに使う） */
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
  /** 入力中の文字を優先して出す（打鍵と取り直しが競り合うため） */
  textOf: (rowId: string, field: string, stored: string) => string
  onRegionChange: (
    cropRegionId: string,
    field: string,
    value: string | number | null
  ) => void
  /** 入力を離れたら、**その欄の**手元の文字を捨てる（隣の欄はまだ入力中でありうる） */
  onRegionBlur: (regionId: string, field: string) => void
  onKeyDown: (
    e: React.KeyboardEvent,
    cropRegionId: string,
    fieldName: string
  ) => void
  onCompositionStart: () => void
  onCompositionEnd: () => void
  onDelete: (cropRegionId: string) => void
  onSelect: (cropRegionId: string | null) => void
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
  textOf,
  onRegionChange,
  onRegionBlur,
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
      onSelect(region.id)
    }
  }

  /**
   * 入力欄のあるマスでは行のトグルを止める。
   *
   * 入力欄を押すと `onFocus` で選択が点くが、**同じマウス操作の click が `tr` まで
   * 上がる**ので、点いた直後に「選択済みだから外す」と判断されて消えていた
   * （「ハイライトが反応しない」の正体）。削除・OMR のボタンが既にそうしている
   * のと同じ止め方をする。
   */
  const stopRowToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
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
        className={`cursor-pointer transition-colors hover:bg-accent/50 ${
          isSelected ? "border-primary bg-primary/10" : ""
        } ${isDragged ? "opacity-50" : ""} ${
          isDraggedOver ? "border-t-4 border-t-blue-500" : ""
        }`}
        onClick={() => onSelect(isSelected ? null : region.id)}
      >
        <td className="border border-border px-2 py-1">
          <div className="flex items-center justify-center">
            <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
          </div>
        </td>
        <td className="border border-border px-2 py-1">
          <div className="flex items-center space-x-2">
            <IconComponent
              className={`h-4 w-4 shrink-0 ${
                isSelected ? "text-primary" : "text-muted-foreground"
              }`}
            />
            <span className="text-sm font-medium">{globalIndex + 1}</span>
          </div>
        </td>
        <td className="border border-border px-2 py-1 text-center">
          <div className="text-sm text-muted-foreground">
            {region.examPage ? region.examPage.pageNumber : "?"}
          </div>
        </td>
        <td className="border border-border px-2 py-1" onClick={stopRowToggle}>
          <Select
            value={region.type}
            onValueChange={(value) => onRegionChange(region.id, "type", value)}
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
        <td className="border border-border px-2 py-1" onClick={stopRowToggle}>
          <Input
            data-row={region.id}
            data-field="label"
            value={textOf(region.id, "label", region.label || "")}
            onChange={(e) => onRegionChange(region.id, "label", e.target.value)}
            onKeyDown={(e) => onKeyDown(e, region.id, "label")}
            onCompositionStart={onCompositionStart}
            onCompositionEnd={onCompositionEnd}
            onFocus={ensureSelected}
            onBlur={() => onRegionBlur(region.id, "label")}
            disabled={disabled}
            placeholder="領域名を入力"
            className="h-8 w-full min-w-20"
          />
        </td>
        <td className="border border-border px-2 py-1" onClick={stopRowToggle}>
          {region.type === "QUESTION_ANSWER" ? (
            <Input
              data-row={region.id}
              data-field="points"
              type="number"
              value={textOf(
                region.id,
                "points",
                region.points === null ? "" : String(region.points)
              )}
              onChange={(e) =>
                onRegionChange(region.id, "points", e.target.value)
              }
              onKeyDown={(e) => onKeyDown(e, region.id, "points")}
              onCompositionStart={onCompositionStart}
              onCompositionEnd={onCompositionEnd}
              onFocus={ensureSelected}
              onBlur={() => onRegionBlur(region.id, "points")}
              disabled={disabled}
              placeholder="10"
              className="h-8 w-full min-w-20"
            />
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </td>
        {/* OMR */}
        <td className="border border-border px-2 py-1 text-center">
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
        <td className="border border-border px-2 py-1 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(region.id)
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
          <td colSpan={8} className="border border-border px-4 py-2">
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
