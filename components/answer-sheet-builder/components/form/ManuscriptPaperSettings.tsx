"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { ManuscriptPaperConfig } from "@/types/answerSheetBuilder.types"

interface ManuscriptPaperSettingsProps {
  config: ManuscriptPaperConfig | undefined
  onUpdate: (config: ManuscriptPaperConfig) => void
}

const DEFAULT_CONFIG: ManuscriptPaperConfig = {
  enabled: false,
  columns: 20,
  rows: 10,
}

export function ManuscriptPaperSettings({
  config,
  onUpdate,
}: ManuscriptPaperSettingsProps) {
  const current = config ?? DEFAULT_CONFIG

  const handleToggle = (enabled: boolean) => {
    onUpdate({ ...current, enabled })
  }

  const handleChange = (data: Partial<ManuscriptPaperConfig>) => {
    onUpdate({ ...current, ...data })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">原稿用紙</Label>
        <Switch
          className="scale-75"
          checked={current.enabled}
          onCheckedChange={handleToggle}
        />
      </div>

      {current.enabled && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-muted-foreground text-[10px]">列数</Label>
            <Input
              type="number"
              className="h-7 text-xs"
              value={current.columns}
              min={1}
              max={40}
              onChange={(e) =>
                handleChange({ columns: Number(e.target.value) })
              }
              onBlur={(e) => {
                e.target.value = String(Number(e.target.value))
              }}
            />
          </div>
          <div>
            <Label className="text-muted-foreground text-[10px]">行数</Label>
            <Input
              type="number"
              className="h-7 text-xs"
              value={current.rows}
              min={1}
              max={20}
              onChange={(e) => handleChange({ rows: Number(e.target.value) })}
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
