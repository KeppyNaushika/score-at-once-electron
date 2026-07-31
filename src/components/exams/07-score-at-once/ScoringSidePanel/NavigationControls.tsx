"use client"

import type {
  AnswerSortOrder,
  LayoutDirection,
} from "@/components/exams/07-score-at-once/types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"

interface NavigationControlsProps {
  layoutDirection: LayoutDirection
  onLayoutDirectionChange: (direction: LayoutDirection) => void
  itemsPerRow?: number[]
  onItemsPerRowChange?: (value: number[]) => void
  gradingMode?: "grid" | "individual"
  expandMargin?: number
  onExpandMarginChange?: (value: number) => void
  answerSortOrder?: AnswerSortOrder
  onAnswerSortOrderChange?: (order: AnswerSortOrder) => void
  /** 白さの算出が完了しているか（未完了なら白さ順を選べない） */
  isWhitenessReady?: boolean
}

const LAYOUT_OPTIONS = [
  { value: "right-down", label: "右→下", description: "右に進んでから下へ" },
  { value: "left-down", label: "左→下", description: "左に進んでから下へ" },
  { value: "down-right", label: "下→右", description: "下に進んでから右へ" },
  { value: "down-left", label: "下→左", description: "下に進んでから左へ" },
]

const SORT_OPTIONS = [
  { value: "custom", label: "表示順", needsWhiteness: false },
  { value: "whiteness", label: "白さ順", needsWhiteness: true },
  { value: "darkness", label: "濃さ順", needsWhiteness: true },
]

export default function NavigationControls({
  layoutDirection,
  onLayoutDirectionChange,
  itemsPerRow,
  onItemsPerRowChange,
  gradingMode = "grid",
  expandMargin,
  onExpandMarginChange,
  answerSortOrder,
  onAnswerSortOrderChange,
  isWhitenessReady = false,
}: NavigationControlsProps) {
  const isColumnLayout =
    layoutDirection === "down-right" || layoutDirection === "down-left"

  if (gradingMode === "individual") return null

  return (
    <div className="space-y-2.5">
      {/* 1行あたりの表示答案 */}
      {itemsPerRow && onItemsPerRowChange && (
        <div className="py-2">
          <div className="flex items-center justify-between">
            <span className="shrink-0 text-xs text-gray-500">
              1{isColumnLayout ? "列" : "行"}あたりの表示答案
            </span>
            <span className="text-[10px] text-gray-400">
              <kbd className="rounded bg-gray-100 px-1 py-0.5">=</kbd> 増 /{" "}
              <kbd className="rounded bg-gray-100 px-1 py-0.5">-</kbd> 減
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Slider
              value={itemsPerRow}
              onValueChange={onItemsPerRowChange}
              max={10}
              min={1}
              step={1}
              className="flex-1"
            />
            <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">
              {itemsPerRow[0]}件
            </span>
          </div>
        </div>
      )}

      {/* 表示領域拡張 */}
      {expandMargin !== undefined && onExpandMarginChange && (
        <div className="py-2">
          <span className="text-xs text-gray-500">表示領域の拡張</span>
          <div className="mt-1 flex items-center gap-2">
            <Slider
              value={[expandMargin]}
              onValueChange={(value) => onExpandMarginChange(value[0])}
              max={50}
              min={0}
              step={5}
              className="flex-1"
            />
            <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">
              {expandMargin}%
            </span>
          </div>
        </div>
      )}

      {/* 並び順 */}
      {answerSortOrder && onAnswerSortOrderChange && (
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-gray-500">並び順</span>
          <Select
            value={answerSortOrder}
            onValueChange={(value) =>
              onAnswerSortOrderChange(value as AnswerSortOrder)
            }
          >
            <SelectTrigger className="h-7 flex-1 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => {
                const isPending = option.needsWhiteness && !isWhitenessReady
                return (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    disabled={isPending}
                  >
                    {isPending ? `${option.label}（解析中…）` : option.label}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 配置方向 */}
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-xs text-gray-500">配置方向</span>
        <Select
          value={layoutDirection}
          onValueChange={(value) =>
            onLayoutDirectionChange(value as LayoutDirection)
          }
        >
          <SelectTrigger className="h-7 flex-1 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LAYOUT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
