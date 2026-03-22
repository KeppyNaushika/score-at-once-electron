"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type {
  GlobalSettings,
  LineStyle,
  MultiColumnConfig,
} from "@/types/answerSheetDefinition.types"

import { SliderWithInput } from "./SliderWithInput"

interface MultiColumnSettingsProps {
  settings: GlobalSettings
  onUpdate: (settings: Partial<GlobalSettings>) => void
}

export function MultiColumnSettings({
  settings,
  onUpdate,
}: MultiColumnSettingsProps) {
  const mc = settings.multiColumn

  const update = (partial: Partial<MultiColumnConfig>) => {
    onUpdate({ multiColumn: { ...mc, ...partial } })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">段組み</Label>
        <Switch
          checked={mc.enabled}
          onCheckedChange={(enabled) => update({ enabled })}
        />
      </div>

      {mc.enabled && (
        <div className="space-y-2 pl-1">
          <div>
            <Label className="text-xs">段数</Label>
            <Select
              value={String(mc.columnCount)}
              onValueChange={(v) => update({ columnCount: Number(v) as 2 | 3 })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2段</SelectItem>
                <SelectItem value="3">3段</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <SliderWithInput
            label="段間余白"
            value={mc.columnGapMm}
            min={0}
            max={30}
            step={1}
            onChange={(v) => update({ columnGapMm: v })}
          />

          <div>
            <Label className="text-xs">仕切り線</Label>
            <Select
              value={mc.dividerLine ?? "none"}
              onValueChange={(v) =>
                update({
                  dividerLine: v === "none" ? null : (v as LineStyle),
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">なし</SelectItem>
                <SelectItem value="solid">実線</SelectItem>
                <SelectItem value="dashed">破線</SelectItem>
                <SelectItem value="dotted">点線</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  )
}
