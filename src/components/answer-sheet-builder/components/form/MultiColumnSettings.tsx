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
  BorderLineStyle,
  GlobalSettings,
  MultiColumnConfig,
} from "@/types/answerSheetDefinition.types"

import { SliderWithInput } from "./SliderWithInput"

interface MultiColumnSettingsProps {
  settings: GlobalSettings
  onUpdate: (settings: Partial<GlobalSettings>) => void
  /** 縦組みレイアウトか（段が上下方向に分割される旨を案内する） */
  vertical?: boolean
}

export function MultiColumnSettings({
  settings,
  onUpdate,
  vertical = false,
}: MultiColumnSettingsProps) {
  const multiColumn = settings.multiColumn

  const update = (partial: Partial<MultiColumnConfig>) => {
    onUpdate({ multiColumn: { ...multiColumn, ...partial } })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">段組み</Label>
        <Switch
          checked={multiColumn.enabled}
          onCheckedChange={(enabled) => update({ enabled })}
        />
      </div>

      {multiColumn.enabled && (
        <div className="space-y-2 pl-1">
          {vertical && (
            <p className="text-muted-foreground text-[10px] leading-snug">
              縦組みでは段が上下方向に分割されます（例: 2段＝上下2段）。
            </p>
          )}
          <div>
            <Label className="text-xs">段数</Label>
            <Select
              value={String(multiColumn.columnCount)}
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
            value={multiColumn.columnGapMm}
            min={0}
            max={30}
            step={1}
            onChange={(v) => update({ columnGapMm: v })}
          />

          <div>
            <Label className="text-xs">仕切り線</Label>
            <Select
              value={multiColumn.dividerLine ?? "none"}
              onValueChange={(v) =>
                update({
                  dividerLine: v === "none" ? null : (v as BorderLineStyle),
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
