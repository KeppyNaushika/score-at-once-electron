"use client"

import { positionLabels } from "@/components/exams/08-export/components/scoring-mark-settings/constants/scoringMarkConstants"
import type { MarkPosition } from "@/components/exams/08-export/components/scoring-mark-settings/types/scoringMarkTypes"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface PositionSettingsSectionProps {
  markPosition: MarkPosition
  scorePosition: MarkPosition
  onMarkPositionChange: (position: MarkPosition) => void
  onScorePositionChange: (position: MarkPosition) => void
  showMarkOnly?: boolean
}

export function PositionSettingsSection({
  markPosition,
  scorePosition,
  onMarkPositionChange,
  onScorePositionChange,
  showMarkOnly = false,
}: PositionSettingsSectionProps) {
  if (showMarkOnly) {
    return (
      <Select value={markPosition} onValueChange={onMarkPositionChange}>
        <SelectTrigger>
          <SelectValue placeholder="位置を選択" />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(positionLabels) as MarkPosition[]).map((position) => (
            <SelectItem key={position} value={position}>
              {positionLabels[position]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* 左側：採点マーク位置設定 */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">📌 採点マーク位置</Label>
        <Select value={markPosition} onValueChange={onMarkPositionChange}>
          <SelectTrigger>
            <SelectValue placeholder="位置を選択" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(positionLabels) as MarkPosition[]).map((position) => (
              <SelectItem key={position} value={position}>
                {positionLabels[position]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 右側：点数テキスト位置設定 */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">🔢 点数テキスト位置</Label>
        <Select value={scorePosition} onValueChange={onScorePositionChange}>
          <SelectTrigger>
            <SelectValue placeholder="位置を選択" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(positionLabels) as MarkPosition[]).map((position) => (
              <SelectItem key={position} value={position}>
                {positionLabels[position]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
