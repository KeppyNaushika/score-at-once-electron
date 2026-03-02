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
  showMarkOnly?: boolean
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
  showMarkOnly = false,
}: OffsetSettingsSectionProps) {
  if (showMarkOnly) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label className="text-xs">左右 (px)</Label>
          <Input
            type="number"
            value={markOffsetX}
            onChange={(e) => onMarkOffsetXChange(parseInt(e.target.value) || 0)}
            min={-100}
            max={100}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">上下 (px)</Label>
          <Input
            type="number"
            value={markOffsetY}
            onChange={(e) => onMarkOffsetYChange(parseInt(e.target.value) || 0)}
            min={-100}
            max={100}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-3">
        <Label className="text-sm font-medium">採点マークオフセット</Label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label className="text-xs">左右 (px)</Label>
            <Input
              type="number"
              value={markOffsetX}
              onChange={(e) =>
                onMarkOffsetXChange(parseInt(e.target.value) || 0)
              }
              min={-100}
              max={100}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">上下 (px)</Label>
            <Input
              type="number"
              value={markOffsetY}
              onChange={(e) =>
                onMarkOffsetYChange(parseInt(e.target.value) || 0)
              }
              min={-100}
              max={100}
            />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <Label className="text-sm font-medium">点数テキストオフセット</Label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label className="text-xs">左右 (px)</Label>
            <Input
              type="number"
              value={scoreOffsetX}
              onChange={(e) =>
                onScoreOffsetXChange(parseInt(e.target.value) || 0)
              }
              min={-100}
              max={100}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">上下 (px)</Label>
            <Input
              type="number"
              value={scoreOffsetY}
              onChange={(e) =>
                onScoreOffsetYChange(parseInt(e.target.value) || 0)
              }
              min={-100}
              max={100}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
