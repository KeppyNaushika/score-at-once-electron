"use client"

import { SidePanelSection } from "@/components/projects/07-score-at-once/ScoringSidePanel/components/SidePanelSection"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Settings } from "lucide-react"

export type ScoringBehavior = "next-student" | "next-question" | "stay"

interface ScoringBehaviorSelectorProps {
  behavior: ScoringBehavior
  onBehaviorChange: (behavior: ScoringBehavior) => void
}

export function ScoringBehaviorSelector({
  behavior,
  onBehaviorChange,
}: ScoringBehaviorSelectorProps) {
  return (
    <SidePanelSection icon={Settings} title="採点時の動作">
      {/* ラジオボタングループ */}
      <div className="space-y-2">
        <RadioGroup value={behavior} onValueChange={onBehaviorChange}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="next-student" id="next-student" />
            <Label htmlFor="next-student" className="text-sm">
              次の生徒の同じ設問
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="next-question" id="next-question" />
            <Label htmlFor="next-question" className="text-sm">
              同じ生徒の次の設問
            </Label>
          </div>
        </RadioGroup>
      </div>
    </SidePanelSection>
  )
}
