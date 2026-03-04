"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { OMRMarkerConfig } from "@/types/answerSheetDefinition.types"

interface OMRMarkerSettingsProps {
  config: OMRMarkerConfig
  onUpdate: (config: Partial<OMRMarkerConfig>) => void
}

export function OMRMarkerSettings({
  config,
  onUpdate,
}: OMRMarkerSettingsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-muted-foreground text-sm font-semibold">
          OMRマーカー
        </h3>
        <Switch
          checked={config.enabled}
          onCheckedChange={(v) => onUpdate({ enabled: v })}
        />
      </div>

      {config.enabled && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-muted-foreground text-[10px]">
              サイズ (mm)
            </Label>
            <Input
              type="number"
              className="h-7 text-xs"
              value={config.sizeMm}
              min={1}
              max={15}
              step={0.5}
              onChange={(e) => onUpdate({ sizeMm: Number(e.target.value) })}
              onBlur={(e) => {
                e.target.value = String(Number(e.target.value))
              }}
            />
          </div>
          <div>
            <Label className="text-muted-foreground text-[10px]">
              オフセット (mm)
            </Label>
            <Input
              type="number"
              className="h-7 text-xs"
              value={config.offsetMm}
              min={0}
              max={20}
              step={0.5}
              onChange={(e) => onUpdate({ offsetMm: Number(e.target.value) })}
              onBlur={(e) => {
                e.target.value = String(Number(e.target.value))
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
