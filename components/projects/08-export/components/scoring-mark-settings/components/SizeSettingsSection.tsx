"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface SizeSettingsSectionProps {
  markSize: number
  scoreSize: number
  onMarkSizeChange: (size: number) => void
  onScoreSizeChange: (size: number) => void
}

export function SizeSettingsSection({
  markSize,
  scoreSize,
  onMarkSizeChange,
  onScoreSizeChange,
}: SizeSettingsSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* 左側：採点マークサイズ */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          📌 マークサイズ: {markSize}px
        </Label>
        <Input
          type="range"
          value={markSize}
          onChange={(e) => onMarkSizeChange(parseInt(e.target.value))}
          min={20}
          max={200}
          step={5}
          className="w-full"
        />
      </div>

      {/* 右側：点数サイズ */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          🔢 点数サイズ: {scoreSize}px
        </Label>
        <Input
          type="range"
          value={scoreSize}
          onChange={(e) => onScoreSizeChange(parseInt(e.target.value))}
          min={8}
          max={48}
          step={1}
          className="w-full"
        />
      </div>
    </div>
  )
}
