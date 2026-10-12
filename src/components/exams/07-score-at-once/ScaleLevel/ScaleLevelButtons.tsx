"use client"

import { Layers, TriangleAlert } from "lucide-react"

import { useKeyBindings } from "@/components/exams/07-score-at-once/hooks/useKeyBindings"
import { ShortcutTooltip } from "@/components/exams/07-score-at-once/ScoringSidePanel/ShortcutTooltip"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { formatKeyForDisplay } from "@/lib/shortcutCatalog"

import { SCALE_NOT_SELECTED_NOTICE } from "./scaleLevelMessages"
import {
  type ScaleLevelChoice,
  scaleLevelColorsAt,
} from "./utils/scaleLevelAppearance"

/** 数字キーで選べる類型の数（1〜9） */
const DIGIT_KEY_COUNT = 9

interface ScaleLevelButtonsProps {
  scaleLevels: readonly ScaleLevelChoice[]
  /** 組を読み込み中（読み込み終わるまで「組が選ばれていない」とは言わない） */
  isScaleLevelsLoading: boolean
  selectedAnswersCount: number
  onApplyScaleLevel: (scaleLevelId: string) => void
}

/**
 * 類型評価の設問の採点パネルで、正答・誤答・部分点の代わりに並べる類型のボタン
 * （docs/vlm-grading-design.md §4-8-6）。
 *
 * 並び順に記号・点数・説明を出し、押すと選んでいる答案にその類型を付ける。
 * 数字キー（部分点の入力を始めるキーと同じ割り当て）が並び順に類型を選ぶ（1 が先頭）
 */
export function ScaleLevelButtons({
  scaleLevels,
  isScaleLevelsLoading,
  selectedAnswersCount,
  onApplyScaleLevel,
}: ScaleLevelButtonsProps) {
  const { keyBindings } = useKeyBindings()

  if (!isScaleLevelsLoading && scaleLevels.length === 0) {
    return (
      <div
        role="status"
        className="flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900"
      >
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{SCALE_NOT_SELECTED_NOTICE}</span>
      </div>
    )
  }

  const isDisabled = selectedAnswersCount === 0
  return (
    <div className="space-y-1" role="group" aria-label="類型">
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <Layers className="h-3.5 w-3.5" />
        類型（数字キーで選ぶ）
      </div>
      {scaleLevels.map((scaleLevel, order) => {
        const colors = scaleLevelColorsAt(order)
        const digitKey =
          order < DIGIT_KEY_COUNT
            ? keyBindings[`scoring.openPartialWith${order + 1}`]
            : undefined
        const button = (
          <Button
            variant="outline"
            size="sm"
            className={`h-auto w-full justify-start gap-2 border-2 px-2 py-1.5 text-left ${
              isDisabled ? "cursor-not-allowed opacity-50" : "hover:opacity-80"
            }`}
            style={{
              backgroundColor: colors.bg,
              color: colors.text,
              borderColor: colors.bg,
            }}
            disabled={isDisabled}
            onClick={() => onApplyScaleLevel(scaleLevel.id)}
          >
            <span className="shrink-0 text-sm font-bold">
              {scaleLevel.label}
            </span>
            <span className="shrink-0 text-xs">{scaleLevel.score}点</span>
            <span className="min-w-0 flex-1 truncate text-xs font-normal opacity-80">
              {scaleLevel.description}
            </span>
            {digitKey && (
              <Kbd variant="tinyOutlined">{formatKeyForDisplay(digitKey)}</Kbd>
            )}
          </Button>
        )
        return digitKey ? (
          <ShortcutTooltip
            key={scaleLevel.id}
            description={scaleLevel.description || scaleLevel.label}
            keys={[formatKeyForDisplay(digitKey)]}
          >
            {button}
          </ShortcutTooltip>
        ) : (
          <div key={scaleLevel.id} title={scaleLevel.description}>
            {button}
          </div>
        )
      })}
    </div>
  )
}
