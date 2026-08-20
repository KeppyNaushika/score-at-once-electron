"use client"

import { useState } from "react"

import BaseModal from "@/components/common/BaseModal"
import {
  type ExportOutcome,
  ExportResultSummary,
} from "@/components/common/ExportResultSummary"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { ArchiveExportMode } from "@/types/examArchive.types"
import { defineStringUnion } from "@/types/stringUnion"

interface ExamArchiveExportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onExport: (exportMode: ArchiveExportMode) => void
  isExporting: boolean
  /**
   * 書き出しの結果。渡している間は**結果の段**を見せる（選択の段へは戻らない）。
   * まだ書き出していない・閉じて開き直したときは null。
   */
  exportOutcome: ExportOutcome | null
}

const EXPORT_MODES: Array<{
  value: ArchiveExportMode
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

/** 選択肢そのものから union へ絞り込む（RadioGroup が渡す string を `as` で名乗らない） */
const { to: toArchiveExportMode } = defineStringUnion(
  EXPORT_MODES.map((exportMode) => exportMode.value),
  "full"
)

/**
 * 試験アーカイブ（`.score`）の書き出しモーダル。
 *
 * 範囲を選ぶ段と、書き出した結果を見せる段の2段を持つ。単体（試験の詳細）と
 * 一括（試験一覧）の両方がこのモーダルを共有するので、見せ方はここで揃う。
 */
export default function ExamArchiveExportModal({
  open,
  onOpenChange,
  onExport,
  isExporting,
  exportOutcome,
}: ExamArchiveExportModalProps) {
  const [selectedMode, setSelectedMode] = useState<ArchiveExportMode>("full")

  if (exportOutcome) {
    const hasProblem =
      exportOutcome.failures.length > 0 ||
      exportOutcome.archives.some((archive) => archive.missingFiles.length > 0)

    return (
      <BaseModal
        open={open}
        onOpenChange={onOpenChange}
        title=".score 書き出し"
        variant={hasProblem ? "warning" : "success"}
        size="lg"
        actions={{ cancel: { label: "閉じる" } }}
      >
        <ExportResultSummary outcome={exportOutcome} />
      </BaseModal>
    )
  }

  return (
    <BaseModal
      open={open}
      onOpenChange={onOpenChange}
      title=".score 書き出し"
      description="書き出すデータの範囲を選択してください。"
      variant="default"
      size="md"
      actions={{
        cancel: { label: "キャンセル" },
        primary: {
          label: "書き出し",
          onClick: () => onExport(selectedMode),
          loading: isExporting,
          disabled: isExporting,
        },
      }}
    >
      <RadioGroup
        value={selectedMode}
        onValueChange={(value) => setSelectedMode(toArchiveExportMode(value))}
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
              <span className="text-sm text-muted-foreground">
                {mode.description}
              </span>
            </Label>
          </div>
        ))}
      </RadioGroup>
    </BaseModal>
  )
}
