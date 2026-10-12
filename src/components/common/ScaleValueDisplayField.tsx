"use client"

import { OptionField } from "@/components/common/ReportOptionControls"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ignoreDeselect } from "@/lib/toggleSelection"
import type { ScaleValueDisplay } from "@/types/rubric.types"
import { SCALE_VALUE_DISPLAYS } from "@/types/rubric.types"

/** 見せ方ごとの例（類型 A・点数 8 のとき、どう出るか） */
const DISPLAY_EXAMPLES: Record<ScaleValueDisplay, string> = {
  points: "8",
  label_points: "A (8)",
  label: "A",
}

const DISPLAY_DESCRIPTIONS: Record<ScaleValueDisplay, string> = {
  points: "点数だけ",
  label_points: "記号と点数",
  label: "記号だけ",
}

interface ScaleValueDisplayFieldProps {
  display: ScaleValueDisplay
  onDisplayChange: (display: ScaleValueDisplay) => void
}

/**
 * 類型評価の値の見せ方（「8」／「A (8)」／「A」）を選ぶ欄（docs/vlm-grading-design.md §4-8-8）。
 *
 * 試験の個人成績表と、成績算出の個人成績通知書（外部資料の文字評価）で同じ欄を使う。
 */
export function ScaleValueDisplayField({
  display,
  onDisplayChange,
}: ScaleValueDisplayFieldProps) {
  return (
    <OptionField label="類型の見せ方">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        selectedTone="primary"
        value={display}
        aria-label="類型の見せ方"
        onValueChange={ignoreDeselect(SCALE_VALUE_DISPLAYS, onDisplayChange)}
      >
        {SCALE_VALUE_DISPLAYS.map((scaleValueDisplay) => (
          <ToggleGroupItem
            key={scaleValueDisplay}
            value={scaleValueDisplay}
            className="px-2.5 text-xs"
            title={DISPLAY_DESCRIPTIONS[scaleValueDisplay]}
            aria-label={DISPLAY_DESCRIPTIONS[scaleValueDisplay]}
          >
            {DISPLAY_EXAMPLES[scaleValueDisplay]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </OptionField>
  )
}
