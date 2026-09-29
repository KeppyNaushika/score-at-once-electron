"use client"

import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { GRADE_COMPARISON_EMPHASES } from "@/lib/userPreferences"

import type { ComparisonEmphasis } from "./types"

const EMPHASIS_LABELS: Record<ComparisonEmphasis, string> = {
  off: "表示しない",
  symbol: "記号",
  tint: "淡い背景",
  solid: "濃い背景",
}

/** つまみの直径（px）。`Slider` の `size-4` と揃える */
const THUMB_SIZE_PX = 16

/**
 * 段の位置（トラック上の中心）。
 *
 * Radix はつまみを両端で半径ぶん内側へ寄せて置く（端でトラックからはみ出さないため）。
 * 目盛りも同じだけ寄せないと、両端の段でつまみと点がずれる。
 */
function stepCenter(stepIndex: number, lastIndex: number) {
  const percent = (stepIndex / lastIndex) * 100
  const insetPx = THUMB_SIZE_PX / 2 - (percent / 100) * THUMB_SIZE_PX
  return `calc(${percent}% + ${insetPx}px)`
}

interface ComparisonEmphasisSliderProps {
  emphasis: ComparisonEmphasis
  /** ドラッグ中の段（画面の中だけで追う） */
  onEmphasisChange: (emphasis: ComparisonEmphasis) => void
  /** 離したときの段（ここで保存する） */
  onEmphasisCommit: (emphasis: ComparisonEmphasis) => void
}

/**
 * 変化の強調（比較の記号の強さ）を選ぶ段つきのスライダー。
 *
 * shadcn の Slider は段の目盛りを持たないので、各段の位置に点を重ねて
 * 「○-・-・-・」の形にする。つまみのある段には点を出さない。
 */
export function ComparisonEmphasisSlider({
  emphasis,
  onEmphasisChange,
  onEmphasisCommit,
}: ComparisonEmphasisSliderProps) {
  const lastIndex = GRADE_COMPARISON_EMPHASES.length - 1
  const selectedIndex = GRADE_COMPARISON_EMPHASES.indexOf(emphasis)
  const emphasisAt = (emphasisIndex: number | undefined) =>
    GRADE_COMPARISON_EMPHASES[emphasisIndex ?? 0] ?? "symbol"

  return (
    <div className="flex items-center gap-3">
      <Label htmlFor="comparison-emphasis" className="text-sm">
        変化の強調
      </Label>
      <div className="relative w-32">
        <Slider
          id="comparison-emphasis"
          min={0}
          max={lastIndex}
          step={1}
          value={[selectedIndex]}
          onValueChange={([emphasisIndex]) =>
            onEmphasisChange(emphasisAt(emphasisIndex))
          }
          onValueCommit={([emphasisIndex]) =>
            onEmphasisCommit(emphasisAt(emphasisIndex))
          }
        />
        {GRADE_COMPARISON_EMPHASES.map((stepEmphasis, stepIndex) =>
          stepIndex === selectedIndex ? null : (
            <span
              key={stepEmphasis}
              aria-hidden="true"
              className={`pointer-events-none absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${
                stepIndex < selectedIndex
                  ? "bg-primary-foreground"
                  : "bg-muted-foreground/50"
              }`}
              style={{ left: stepCenter(stepIndex, lastIndex) }}
            />
          )
        )}
      </div>
      <span className="w-16 text-xs text-muted-foreground">
        {EMPHASIS_LABELS[emphasis]}
      </span>
    </div>
  )
}
