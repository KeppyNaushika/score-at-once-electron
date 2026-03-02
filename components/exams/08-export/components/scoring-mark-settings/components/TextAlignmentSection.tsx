"use client"

import { AlignCenter, AlignLeft, AlignRight } from "lucide-react"

import type { TextAlignment } from "@/components/exams/08-export/components/scoring-mark-settings/types/scoringMarkTypes"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

interface TextAlignmentSectionProps {
  scoreAlignment: TextAlignment
  onScoreAlignmentChange: (alignment: TextAlignment) => void
}

export function TextAlignmentSection({
  scoreAlignment,
  onScoreAlignmentChange,
}: TextAlignmentSectionProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">🔢 点数テキスト配置</Label>
      <ToggleGroup
        type="single"
        value={scoreAlignment}
        onValueChange={(value: TextAlignment) => {
          if (value) onScoreAlignmentChange(value)
        }}
        className="justify-start"
      >
        <ToggleGroupItem value="left" aria-label="左揃え">
          <AlignLeft className="h-4 w-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="center" aria-label="中央揃え">
          <AlignCenter className="h-4 w-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="right" aria-label="右揃え">
          <AlignRight className="h-4 w-4" />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}
