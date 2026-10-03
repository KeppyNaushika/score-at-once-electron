"use client"

import { AlertTriangle } from "lucide-react"

import type { MouseBrushAction } from "@/components/exams/07-score-at-once/types"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useScoringStatusColors } from "@/hooks/07-score-at-once/useScoringStatusColors"
import { ignoreDeselect } from "@/lib/toggleSelection"

import {
  BRUSH_BUTTONS,
  MOUSE_BRUSH_ACTIONS,
  MOUSE_BRUSH_BUTTONS,
  STATUS_MAP,
} from "./scoringToolbarButtons"

/** マウスモードの採点ブラシの選択と、表示中の未採点の一括採点 */
export function MouseBrushControls({
  mouseBrush,
  onMouseBrushChange,
  visibleUnscoredCount,
  hiddenUnscoredCount,
  onBatchScoreVisibleUnscored,
}: {
  mouseBrush: MouseBrushAction
  onMouseBrushChange?: (brush: MouseBrushAction) => void
  visibleUnscoredCount: number
  hiddenUnscoredCount: number
  onBatchScoreVisibleUnscored?: (status: MouseBrushAction) => void
}) {
  const scoringColors = useScoringStatusColors()
  return (
    <>
      {/* ブラシ選択 */}
      <div>
        <div className="mb-1 text-xs font-medium text-gray-600">
          クリック時の採点ブラシ
        </div>
        {/* 採点画面はキーボード優先。Tab で1つずつ辿れる並びを保つため、矢印キーでの移動（roving focus）は切る */}
        <ToggleGroup
          type="single"
          rovingFocus={false}
          value={mouseBrush}
          aria-label="クリック時の採点ブラシ"
          className="grid w-full grid-cols-4 gap-2"
          onValueChange={ignoreDeselect(MOUSE_BRUSH_ACTIONS, (brush) =>
            onMouseBrushChange?.(brush)
          )}
        >
          {MOUSE_BRUSH_BUTTONS.map((button) => {
            const Icon = button.icon
            const colors =
              button.status === "select"
                ? { bg: "#e5e7eb", text: "#374151" }
                : button.status === "partial_modal"
                  ? scoringColors[STATUS_MAP.partial]
                  : scoringColors[STATUS_MAP[button.status]]
            return (
              <Tooltip key={button.status}>
                <TooltipTrigger asChild>
                  <ToggleGroupItem
                    value={button.status}
                    className="flex h-12 flex-col gap-1 rounded-md border-2 shadow-xs data-[state=off]:opacity-60 data-[state=off]:hover:opacity-80 data-[state=on]:ring-2 data-[state=on]:ring-blue-500 data-[state=on]:ring-offset-1"
                    style={{
                      backgroundColor: colors.bg,
                      color: colors.text,
                      borderColor: colors.bg,
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    <div className="text-xs">{button.label}</div>
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-center">
                    <div className="font-medium">{button.description}</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </ToggleGroup>
      </div>

      {/* 一括採点ボタン（採点ブラシ選択時のみ） */}
      {onBatchScoreVisibleUnscored &&
        visibleUnscoredCount > 0 &&
        mouseBrush !== "select" &&
        mouseBrush !== "partial_modal" && (
          <div className="space-y-1">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => onBatchScoreVisibleUnscored(mouseBrush)}
            >
              表示中の未採点{visibleUnscoredCount}件を
              {BRUSH_BUTTONS.find((button) => button.status === mouseBrush)
                ?.label ?? mouseBrush}
              にする
            </Button>
            {hiddenUnscoredCount > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                非表示の未採点が{hiddenUnscoredCount}件あります
              </div>
            )}
          </div>
        )}
    </>
  )
}
