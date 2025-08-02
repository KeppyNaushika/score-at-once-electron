"use client"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"

export type ScoringBehavior = "next-student" | "next-question"

interface ScoringBehaviorSelectorProps {
  behavior: ScoringBehavior
  onBehaviorChange: (behavior: ScoringBehavior) => void
}

export function ScoringBehaviorSelector({
  behavior,
  onBehaviorChange,
}: ScoringBehaviorSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <div className="border rounded-lg bg-white">
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="font-medium">採点時の動作</h3>
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </div>
      
      {isExpanded && (
        <div className="p-3 border-t">
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
      )}
    </div>
  )
}