"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface OffsetSettingsSectionProps {
  markOffsetX: number
  markOffsetY: number
  scoreOffsetX: number
  scoreOffsetY: number
  onMarkOffsetXChange: (value: number) => void
  onMarkOffsetYChange: (value: number) => void
  onScoreOffsetXChange: (value: number) => void
  onScoreOffsetYChange: (value: number) => void
}

export function OffsetSettingsSection({
  markOffsetX,
  markOffsetY,
  scoreOffsetX,
  scoreOffsetY,
  onMarkOffsetXChange,
  onMarkOffsetYChange,
  onScoreOffsetXChange,
  onScoreOffsetYChange,
}: OffsetSettingsSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* 左側：採点マークオフセット設定 */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">📌 採点マークオフセット</Label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label className="text-xs">左右: {markOffsetX}px</Label>
            <Input
              type="range"
              value={markOffsetX}
              onChange={(e) => onMarkOffsetXChange(parseInt(e.target.value))}
              min={-100}
              max={100}
              step={1}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">上下: {markOffsetY}px</Label>
            <Input
              type="range"
              value={markOffsetY}
              onChange={(e) => onMarkOffsetYChange(parseInt(e.target.value))}
              min={-100}
              max={100}
              step={1}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* 右側：点数テキストオフセット設定 */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          🔢 点数テキストオフセット
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label className="text-xs">左右: {scoreOffsetX}px</Label>
            <Input
              type="range"
              value={scoreOffsetX}
              onChange={(e) => onScoreOffsetXChange(parseInt(e.target.value))}
              min={-100}
              max={100}
              step={1}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">上下: {scoreOffsetY}px</Label>
            <Input
              type="range"
              value={scoreOffsetY}
              onChange={(e) => onScoreOffsetYChange(parseInt(e.target.value))}
              min={-100}
              max={100}
              step={1}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
