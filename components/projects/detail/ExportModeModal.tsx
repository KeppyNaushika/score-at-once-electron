"use client"

import { useState } from "react"

import BaseModal from "@/components/common/BaseModal"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { ExportMode } from "@/types/projectArchive.types"

interface ExportModeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onExport: (mode: ExportMode) => void
  isExporting: boolean
}

const EXPORT_MODES: Array<{
  value: ExportMode
  label: string
  description: string
}> = [
  {
    value: "full",
    label: "すべてのデータ",
    description: "生徒・採点・答案を含む完全データ",
  },
  {
    value: "template",
    label: "模範解答＋領域情報",
    description: "採点テンプレートのみ（生徒・採点・答案・小計を除外）",
  },
  {
    value: "template_with_subtotals",
    label: "模範解答＋領域情報＋小計",
    description: "テンプレートと小計設定（生徒・採点・答案を除外）",
  },
]

export default function ExportModeModal({
  open,
  onOpenChange,
  onExport,
  isExporting,
}: ExportModeModalProps) {
  const [selectedMode, setSelectedMode] = useState<ExportMode>("full")

  return (
    <BaseModal
      open={open}
      onOpenChange={onOpenChange}
      title="エクスポート"
      description="エクスポートするデータの範囲を選択してください。"
      variant="default"
      size="md"
      actions={{
        cancel: { label: "キャンセル" },
        primary: {
          label: "エクスポート",
          onClick: () => onExport(selectedMode),
          loading: isExporting,
          disabled: isExporting,
        },
      }}
    >
      <RadioGroup
        value={selectedMode}
        onValueChange={(value) => setSelectedMode(value as ExportMode)}
        className="space-y-3"
      >
        {EXPORT_MODES.map((mode) => (
          <div
            key={mode.value}
            className="flex items-start space-x-3 rounded-md border p-3"
          >
            <RadioGroupItem
              value={mode.value}
              id={`export-mode-${mode.value}`}
              className="mt-0.5"
            />
            <Label
              htmlFor={`export-mode-${mode.value}`}
              className="flex cursor-pointer flex-col gap-1"
            >
              <span className="font-medium">{mode.label}</span>
              <span className="text-muted-foreground text-sm">
                {mode.description}
              </span>
            </Label>
          </div>
        ))}
      </RadioGroup>
    </BaseModal>
  )
}
