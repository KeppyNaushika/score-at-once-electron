"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { GRADE_COMPARISON_DISPLAYS } from "@/lib/userPreferences"

import type { ComparisonDisplay } from "./types"

const DISPLAY_LABELS: Record<ComparisonDisplay, string> = {
  none: "なし",
  symbol: "記号",
  highlight: "強調",
}

interface ComparisonDisplayToggleProps {
  display: ComparisonDisplay
  onDisplayChange: (display: ComparisonDisplay) => void
}

/** 変化の表示（比較の記号の出し方）を選ぶボタンの組 */
export function ComparisonDisplayToggle({
  display,
  onDisplayChange,
}: ComparisonDisplayToggleProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium">変化の表示</span>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={display}
        aria-label="変化の表示"
        onValueChange={(value) => {
          // 選択中の段をもう一度押すと空文字が来る。選択は外さない
          const nextDisplay = GRADE_COMPARISON_DISPLAYS.find(
            (candidateDisplay) => candidateDisplay === value
          )
          if (nextDisplay) onDisplayChange(nextDisplay)
        }}
      >
        {GRADE_COMPARISON_DISPLAYS.map((stepDisplay) => (
          <ToggleGroupItem
            key={stepDisplay}
            value={stepDisplay}
            className="px-2.5 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            {DISPLAY_LABELS[stepDisplay]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
