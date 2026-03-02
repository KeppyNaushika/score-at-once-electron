"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface SizeSettingsSectionProps {
  markSize: number
  scoreSize: number
  onMarkSizeChange: (size: number) => void
  onScoreSizeChange: (size: number) => void
  showMarkOnly?: boolean
}

export function SizeSettingsSection({
  markSize,
  scoreSize,
  onMarkSizeChange,
  onScoreSizeChange,
  showMarkOnly = false,
}: SizeSettingsSectionProps) {
  if (showMarkOnly) {
    return (
      <div className="space-y-2">
        <Label className="text-xs">サイズ (px)</Label>
        <Input
          type="number"
          value={markSize}
          onChange={(e) => onMarkSizeChange(parseInt(e.target.value) || 50)}
          min={20}
          max={200}
        />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-2">
        <Label className="text-xs">マークサイズ (px)</Label>
        <Input
          type="number"
          value={markSize}
          onChange={(e) => onMarkSizeChange(parseInt(e.target.value) || 50)}
          min={20}
          max={200}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">点数サイズ (px)</Label>
        <Input
          type="number"
          value={scoreSize}
          onChange={(e) => onScoreSizeChange(parseInt(e.target.value) || 14)}
          min={8}
          max={48}
        />
      </div>
    </div>
  )
}
