"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import {
  CLICK_SCORING_ACTIONS,
  type ClickScoringAction,
  type ClickScoringConfig,
} from "@/types/clickScoring.types"
import { isOneOf } from "@/types/stringUnion"

import { CLICK_ACTION_OPTIONS } from "./scoringToolbarButtons"

/**
 * クリックで採点（ダブル以上）の割り当て。`onClickScoringDebounceMsChange` を
 * 渡したときだけ、クリックの最長間隔の欄も出す
 */
export function ClickScoringSettings({
  clickScoringConfig,
  onClickActionChange,
  clickScoringDebounceMs = 300,
  onClickScoringDebounceMsChange,
}: {
  clickScoringConfig: ClickScoringConfig
  onClickActionChange: (
    clickCount: 2 | 3 | 4,
    action: ClickScoringAction
  ) => void
  clickScoringDebounceMs?: number
  onClickScoringDebounceMsChange?: (value: number) => void
}) {
  return (
    <div className="space-y-1.5">
      {([2, 3, 4] as const).map((clickCount) => {
        const labels = {
          2: "ダブルクリック:",
          3: "トリプルクリック:",
          4: "クアトロクリック:",
        }
        return (
          <div
            key={clickCount}
            className="flex items-center justify-between text-xs"
          >
            <span className="text-gray-600">{labels[clickCount]}</span>
            <Select
              value={clickScoringConfig[clickCount]}
              onValueChange={(value) => {
                if (isOneOf(CLICK_SCORING_ACTIONS, value)) {
                  onClickActionChange(clickCount, value)
                }
              }}
            >
              <SelectTrigger className="h-7 w-60 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLICK_ACTION_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-xs"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )
      })}

      {onClickScoringDebounceMsChange && (
        <div className="space-y-0.5">
          <span className="text-[10px] text-gray-500">クリックの最長間隔</span>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span className="shrink-0 text-base" title="速い">
              🐇
            </span>
            <Slider
              className="flex-1"
              value={[clickScoringDebounceMs]}
              min={100}
              max={800}
              step={50}
              onValueChange={([debounceMs]) =>
                onClickScoringDebounceMsChange(debounceMs)
              }
            />
            <span className="shrink-0 text-base" title="遅い">
              🐢
            </span>
            <span className="w-10 shrink-0 text-right text-[10px] text-gray-400">
              {clickScoringDebounceMs}ms
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
