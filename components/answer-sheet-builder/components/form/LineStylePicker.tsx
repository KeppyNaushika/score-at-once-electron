"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BorderConfig, LineStyle } from "@/types/answerSheetBuilder.types"

interface LineStylePickerProps {
  borderConfig: BorderConfig
  onUpdate: (config: Partial<BorderConfig>) => void
}

const LINE_STYLE_OPTIONS: { value: LineStyle; label: string }[] = [
  { value: "solid", label: "実線" },
  { value: "dashed", label: "破線" },
  { value: "dotted", label: "点線" },
]

const BORDER_FIELDS: { key: keyof BorderConfig; label: string }[] = [
  { key: "outerBorder", label: "外枠" },
  { key: "majorDivider", label: "大問区切" },
  { key: "subDivider", label: "小問区切" },
  { key: "branchDivider", label: "枝問区切" },
  { key: "numberColumnDivider", label: "番号列" },
]

export function LineStylePicker({
  borderConfig,
  onUpdate,
}: LineStylePickerProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-muted-foreground text-sm font-semibold">
        罫線スタイル
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {BORDER_FIELDS.map((field) => (
          <div key={field.key}>
            <Label className="text-muted-foreground text-[10px]">
              {field.label}
            </Label>
            <Select
              value={borderConfig[field.key]}
              onValueChange={(v) => onUpdate({ [field.key]: v as LineStyle })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINE_STYLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  )
}
