"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { PdfExportMode } from "@/types/pdfTools.types"

interface ExportModeSelectorProps {
  mode: PdfExportMode
  onModeChange: (mode: PdfExportMode) => void
  disabled: boolean
}

export default function ExportModeSelector({
  mode,
  onModeChange,
  disabled,
}: ExportModeSelectorProps) {
  return (
    <div>
      <Label className="mb-2 block text-sm font-medium">出力モード</Label>
      <RadioGroup
        value={mode}
        onValueChange={(value) => onModeChange(value as PdfExportMode)}
        className="flex gap-4"
        disabled={disabled}
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="merge" id="mode-merge" />
          <Label htmlFor="mode-merge" className="cursor-pointer text-sm">
            結合
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="split" id="mode-split" />
          <Label htmlFor="mode-split" className="cursor-pointer text-sm">
            分割
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="interleave" id="mode-interleave" />
          <Label htmlFor="mode-interleave" className="cursor-pointer text-sm">
            交互挿入
          </Label>
        </div>
      </RadioGroup>
    </div>
  )
}
