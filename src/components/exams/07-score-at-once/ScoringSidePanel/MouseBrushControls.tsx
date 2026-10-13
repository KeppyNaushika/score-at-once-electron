"use client"

import { TriangleAlert } from "lucide-react"

import type { ScaleQuestionState } from "@/components/exams/07-score-at-once/ScaleLevel/hooks/useScaleScoringGate"
import { scaleLevelColorsAt } from "@/components/exams/07-score-at-once/ScaleLevel/utils/scaleLevelAppearance"
import { isMouseBrushCompatibleWithScale } from "@/components/exams/07-score-at-once/ScaleLevel/utils/scaleMouseBrush"
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

/** ブラシのボタンの見た目（採点状態のブラシと類型のブラシで揃える） */
// 選んでいるかは aria-checked で引く。ブラシを包むツールチップの trigger が data-state を
// 自分の状態（closed など）で上書きするので、data-[state=on] では選んだブラシに印が付かない
const BRUSH_ITEM_CLASS_NAME =
  "flex h-12 flex-col gap-1 rounded-md border-2 shadow-xs aria-[checked=false]:opacity-60 aria-[checked=false]:hover:opacity-80 aria-checked:ring-2 aria-checked:ring-blue-500 aria-checked:ring-offset-1"

/** 類型方式でない設問の類型（毎回作り直さない） */
const NO_SCALE_LEVELS: ScaleQuestionState["scaleLevels"] = []

/**
 * マウスモードの採点ブラシの選択と、表示中の未採点の一括採点。
 *
 * 類型方式の設問では、選択のあとに類型ごとのブラシ（記号・点数を類型の色で）を並べ、
 * 正答・誤答・部分点・部分点入力のブラシは出さない（保留・無答・Wマークは残す。docs/vlm-grading-design.md §4-8-6）
 */
export function MouseBrushControls({
  mouseBrush,
  onMouseBrushChange,
  mouseScaleLevelId,
  onMouseScaleLevelSelect,
  scaleQuestion,
  visibleUnscoredCount,
  hiddenUnscoredCount,
  onBatchScoreVisibleUnscored,
}: {
  /** 今の設問で効くブラシ（効かないブラシは「選択」に読み替え済み） */
  mouseBrush: MouseBrushAction
  onMouseBrushChange?: (brush: MouseBrushAction) => void
  /** 類型のブラシが付ける類型（類型のブラシのときだけ値を持つ） */
  mouseScaleLevelId: string | null
  onMouseScaleLevelSelect?: (scaleLevelId: string) => void
  scaleQuestion?: ScaleQuestionState
  visibleUnscoredCount: number
  hiddenUnscoredCount: number
  onBatchScoreVisibleUnscored?: (status: MouseBrushAction) => void
}) {
  const scoringColors = useScoringStatusColors()
  const isScaleQuestion = scaleQuestion?.isScaleQuestion ?? false
  const scaleLevels = scaleQuestion?.isScaleQuestion
    ? scaleQuestion.scaleLevels
    : NO_SCALE_LEVELS
  const brushButtons = isScaleQuestion
    ? MOUSE_BRUSH_BUTTONS.filter((button) =>
        isMouseBrushCompatibleWithScale(button.status)
      )
    : MOUSE_BRUSH_BUTTONS
  // 選択を先頭に、類型のブラシをそのすぐ後に並べる
  const selectButtons = brushButtons.filter(
    (button) => button.status === "select"
  )
  const statusButtons = brushButtons.filter(
    (button) => button.status !== "select"
  )
  const selectedScaleLevel =
    mouseBrush === "scale_level"
      ? scaleLevels.find((scaleLevel) => scaleLevel.id === mouseScaleLevelId)
      : undefined
  // 類型のブラシは類型の id を値にする（状態は「類型のブラシ」と「どの類型か」を分けて持つ）
  const toggleValue =
    mouseBrush === "scale_level" ? (selectedScaleLevel?.id ?? "") : mouseBrush
  const selectBrush = ignoreDeselect(MOUSE_BRUSH_ACTIONS, (brush) =>
    onMouseBrushChange?.(brush)
  )
  const batchLabel =
    mouseBrush === "scale_level"
      ? selectedScaleLevel?.label
      : mouseBrush === "select" || mouseBrush === "partial_modal"
        ? undefined
        : (BRUSH_BUTTONS.find((button) => button.status === mouseBrush)
            ?.label ?? mouseBrush)

  const renderBrushButton = (button: (typeof MOUSE_BRUSH_BUTTONS)[number]) => {
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
            className={BRUSH_ITEM_CLASS_NAME}
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
  }

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
          value={toggleValue}
          aria-label="クリック時の採点ブラシ"
          className="grid w-full grid-cols-4 gap-2"
          onValueChange={(value) => {
            const scaleLevel = scaleLevels.find(
              (candidate) => candidate.id === value
            )
            if (scaleLevel) {
              onMouseScaleLevelSelect?.(scaleLevel.id)
              return
            }
            selectBrush(value)
          }}
        >
          {selectButtons.map(renderBrushButton)}
          {scaleLevels.map((scaleLevel, order) => {
            const colors = scaleLevelColorsAt(order)
            return (
              <Tooltip key={scaleLevel.id}>
                <TooltipTrigger asChild>
                  <ToggleGroupItem
                    value={scaleLevel.id}
                    aria-label={`類型 ${scaleLevel.label}（${scaleLevel.score}点）`}
                    className={BRUSH_ITEM_CLASS_NAME}
                    style={{
                      backgroundColor: colors.bg,
                      color: colors.text,
                      borderColor: colors.bg,
                    }}
                  >
                    <div className="text-sm font-bold">{scaleLevel.label}</div>
                    <div className="text-xs">{scaleLevel.score}点</div>
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-center">
                    <div className="font-medium">
                      {scaleLevel.description || scaleLevel.label}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}
          {statusButtons.map(renderBrushButton)}
        </ToggleGroup>
      </div>

      {/* 一括採点ボタン（付けられるブラシの選択時のみ） */}
      {onBatchScoreVisibleUnscored &&
        visibleUnscoredCount > 0 &&
        batchLabel !== undefined && (
          <div className="space-y-1">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => onBatchScoreVisibleUnscored(mouseBrush)}
            >
              表示中の未採点{visibleUnscoredCount}件を{batchLabel}にする
            </Button>
            {hiddenUnscoredCount > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-amber-600">
                <TriangleAlert className="h-3 w-3" />
                非表示の未採点が{hiddenUnscoredCount}件あります
              </div>
            )}
          </div>
        )}
    </>
  )
}
