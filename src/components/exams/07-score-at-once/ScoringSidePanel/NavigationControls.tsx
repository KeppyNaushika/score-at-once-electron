"use client"

import type {
  AnswerSortOrder,
  LayoutDirection,
} from "@/components/exams/07-score-at-once/types"
import { Kbd } from "@/components/ui/kbd"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useSlidingValue } from "@/hooks/useSlidingValue"
import { ignoreDeselect } from "@/lib/toggleSelection"
import { ANSWER_SORT_ORDERS } from "@/lib/userPreferences"

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
  /** 白さの算出が完了しているか（未完了なら白さ順・黒さ順を選べない） */
  isWhitenessReady?: boolean
}

const LAYOUT_OPTIONS = [
  { value: "right-down", label: "右→下", description: "右に進んでから下へ" },
  { value: "left-down", label: "左→下", description: "左に進んでから下へ" },
  { value: "down-right", label: "下→右", description: "下に進んでから右へ" },
  { value: "down-left", label: "下→左", description: "下に進んでから左へ" },
]

const SORT_ORDER_LABELS: Record<AnswerSortOrder, string> = {
  custom: "生徒順",
  whiteness: "白さ順",
  darkness: "黒さ順",
}

/** 白さ・黒さで並べる順は、白さの算出が済むまで選べない */
const NEEDS_WHITENESS: Record<AnswerSortOrder, boolean> = {
  custom: false,
  whiteness: true,
  darkness: true,
}

const SORT_ORDER_LABEL_ID = "answer-sort-order-label"

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

  // つまみを動かしている間は書かず、離したときに1回だけ書く
  const itemsPerRowSlider = useSlidingValue(itemsPerRow?.[0] ?? 1, (value) =>
    onItemsPerRowChange?.([value])
  )
  const expandMarginSlider = useSlidingValue(expandMargin ?? 0, (value) =>
    onExpandMarginChange?.(value)
  )

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
              <Kbd variant="tiny">=</Kbd> 増 / <Kbd variant="tiny">-</Kbd> 減
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Slider
              {...itemsPerRowSlider.sliderProps}
              max={10}
              min={1}
              step={1}
              className="flex-1"
            />
            <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">
              {itemsPerRowSlider.shown}件
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
              {...expandMarginSlider.sliderProps}
              max={50}
              min={0}
              step={5}
              className="flex-1"
            />
            <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">
              {expandMarginSlider.shown}%
            </span>
          </div>
        </div>
      )}

      {/* 並び順（単一選択の切り替え。選んでいるものをもう一度押しても外れない） */}
      {answerSortOrder && onAnswerSortOrderChange && (
        <div className="space-y-1">
          <span id={SORT_ORDER_LABEL_ID} className="text-xs text-gray-500">
            並び順
          </span>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={answerSortOrder}
            aria-labelledby={SORT_ORDER_LABEL_ID}
            onValueChange={ignoreDeselect(
              ANSWER_SORT_ORDERS,
              onAnswerSortOrderChange
            )}
            className="w-full"
          >
            {ANSWER_SORT_ORDERS.map((sortOrder) => (
              <ToggleGroupItem
                key={sortOrder}
                value={sortOrder}
                disabled={NEEDS_WHITENESS[sortOrder] && !isWhitenessReady}
                className="text-xs"
              >
                {SORT_ORDER_LABELS[sortOrder]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {!isWhitenessReady && (
            <p className="text-[10px] text-muted-foreground">
              白さを解析中のため、白さ順・黒さ順はまだ選べません
            </p>
          )}
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
