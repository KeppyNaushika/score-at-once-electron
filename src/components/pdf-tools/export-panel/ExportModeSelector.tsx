"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { PdfExportMode } from "@/types/pdfTools.types"

/** 出力モードの選択肢（並びは Select に出す順） */
const EXPORT_MODE_OPTIONS: { mode: PdfExportMode; label: string }[] = [
  { mode: "merge", label: "結合" },
  { mode: "interleave", label: "交互挿入" },
]

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
    <div className="flex items-center gap-2">
      <Label
        htmlFor="export-mode"
        className="text-sm font-medium whitespace-nowrap"
      >
        出力モード
      </Label>
      <Select
        value={mode}
        onValueChange={(value) => {
          const option = EXPORT_MODE_OPTIONS.find(
            (candidateOption) => candidateOption.mode === value
          )
          if (option === undefined) return
          onModeChange(option.mode)
        }}
        disabled={disabled}
      >
        <SelectTrigger id="export-mode" className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {EXPORT_MODE_OPTIONS.map((option) => (
            <SelectItem key={option.mode} value={option.mode}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
