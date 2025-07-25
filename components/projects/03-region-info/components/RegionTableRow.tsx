"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { GripVertical, Trash2 } from "lucide-react"
import type { LayoutRegionWithDetails } from "@/types/electron"
import {
  LAYOUT_REAGION_AREA_TYPES,
  LayoutRegionAreaType,
} from "@/types/common.types"

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

const typeIcons: Record<LayoutRegionAreaType, string> = {
  ["QUESTION_ANSWER"]: "📋",
  ["STUDENT_NAME"]: "📄",
  ["STUDENT_ID"]: "🔢",
  ["TOTAL_SCORE"]: "🏆",
  ["SUBTOTAL_SCORE"]: "🔢",
  ["MARK"]: "✏️",
  ["COMMENT"]: "💬",
  ["OTHER"]: "📎",
}

type RegionTableRowProps = {
  region: LayoutRegionWithDetails
  globalIndex: number
  isSelected: boolean
  isDragged: boolean
  isDraggedOver: boolean
  disabled: boolean
  onRegionChange: (globalIndex: number, field: string, value: any) => void
  onKeyDown: (e: React.KeyboardEvent, rowIndex: number, fieldName: string) => void
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
  const regionType = region.type

  const isValidType = (type: string): type is LayoutRegionAreaType => 
    LAYOUT_REAGION_AREA_TYPES.includes(type as LayoutRegionAreaType)
  
  const icon = isValidType(regionType)
    ? typeIcons[regionType]
    : typeIcons["OTHER"]

  return (
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
          <span className="text-lg">{icon}</span>
          <span className="text-sm font-medium">
            {globalIndex + 1}
          </span>
        </div>
      </td>
      <td className="border-border border px-2 py-1 text-center">
        <div className="text-sm text-muted-foreground">
          {region.masterImage ? region.masterImage.pageNumber : '?'}
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
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(LAYOUT_REAGION_AREA_TYPES).map(
              (type) => (
                <SelectItem key={type} value={type}>
                  {areaTypeToJapanese[type]}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </td>
      <td className="border-border border px-2 py-1">
        <Input
          data-row={globalIndex}
          data-field="label"
          value={region.label || ""}
          onChange={(e) =>
            onRegionChange(
              globalIndex,
              "label",
              e.target.value,
            )
          }
          onKeyDown={(e) =>
            onKeyDown(e, globalIndex, "label")
          }
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
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
              onRegionChange(
                globalIndex,
                "points",
                e.target.value,
              )
            }
            onKeyDown={(e) =>
              onKeyDown(e, globalIndex, "points")
            }
            onCompositionStart={onCompositionStart}
            onCompositionEnd={onCompositionEnd}
            disabled={disabled}
            placeholder="10"
            className="h-8 w-full min-w-20"
          />
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
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
  )
}