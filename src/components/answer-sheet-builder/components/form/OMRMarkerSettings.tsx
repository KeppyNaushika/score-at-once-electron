"use client"

import { TriangleAlert } from "lucide-react"

import { Switch } from "@/components/ui/switch"
import type { OMRMarkerConfig } from "@/types/answerSheetDefinition.types"

import { SliderWithInput } from "./SliderWithInput"

interface OMRMarkerSettingsProps {
  config: OMRMarkerConfig
  onUpdate: (config: Partial<OMRMarkerConfig>) => void
  /** 版面との干渉の警告（checkOMRMarkerPlacement の結果） */
  warnings: string[]
}

export function OMRMarkerSettings({
  config,
  onUpdate,
  warnings,
}: OMRMarkerSettingsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">
          OMRマーカー
        </h3>
        <Switch
          checked={config.enabled}
          onCheckedChange={(enabled) => onUpdate({ enabled })}
        />
      </div>

      {config.enabled && (
        <div className="space-y-1.5">
          {/* 入力欄の下限はスライダーより低い（スライダーで届かない値も打てる） */}
          <SliderWithInput
            label="サイズ"
            labelWidthClassName="w-8"
            value={config.sizeMm}
            min={1.5}
            max={15}
            step={0.5}
            inputMin={0.5}
            onChange={(sizeMm) => onUpdate({ sizeMm })}
          />
          <SliderWithInput
            label="余白"
            labelWidthClassName="w-8"
            value={config.offsetMm}
            min={5}
            max={20}
            step={0.5}
            inputMin={0}
            onChange={(offsetMm) => onUpdate({ offsetMm })}
          />
        </div>
      )}

      {warnings.length > 0 && (
        <ul className="space-y-1.5">
          {warnings.map((warning) => (
            <li
              key={warning}
              className="flex items-start gap-1.5 rounded-md border border-orange-200 bg-orange-50 p-2 text-xs text-orange-700"
            >
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {warning}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
