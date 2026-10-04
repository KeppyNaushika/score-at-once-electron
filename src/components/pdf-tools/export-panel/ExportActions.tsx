"use client"

import { FileImage, Files, FileText, type LucideIcon } from "lucide-react"

import { WithTooltip } from "@/components/common/WithTooltip"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import type { ImportedFile, OutputSheet } from "@/types/pdfTools.types"

import { useOutputExport } from "./hooks/useOutputExport"

interface ExportActionsProps {
  /** 出力の各ページ（元ページそのままか、N-up の面） */
  outputSheets: OutputSheet[]
  importedFiles: ImportedFile[]
  isProcessing: boolean
  onProcessingChange: (processing: boolean) => void
}

/** 出力ボタン（PDF・PDF 分割・PNG）。書き出しの処理は useOutputExport */
export default function ExportActions({
  outputSheets,
  importedFiles,
  isProcessing,
  onProcessingChange,
}: ExportActionsProps) {
  const { exportKind, exportMergedPdf, exportSplitPdf, exportPng } =
    useOutputExport({ outputSheets, importedFiles, onProcessingChange })

  const pageCount = outputSheets.length

  // 文字は短くし、省いた説明は aria-label（読み上げ）とツールチップに残す
  const exportButtons: {
    isExporting: boolean
    label: string
    accessibleName: string
    description: string
    Icon: LucideIcon
    variant: "default" | "outline"
    onClick: () => Promise<void>
  }[] = [
    {
      isExporting: exportKind === "merged-pdf",
      label: "PDF",
      accessibleName: "PDF（1ファイルにまとめる）",
      description: "全ページを1つのPDFにまとめて保存します",
      Icon: FileText,
      variant: "default",
      onClick: exportMergedPdf,
    },
    {
      isExporting: exportKind === "split-pdf",
      label: "PDF 分割",
      accessibleName: "PDF（ページ別に分割）",
      description:
        "1ページ1ファイルのPDFに分割して、選んだフォルダへ保存します",
      Icon: Files,
      variant: "outline",
      onClick: exportSplitPdf,
    },
    {
      isExporting: exportKind === "png",
      label: "PNG",
      accessibleName: "PNG（ページ別）",
      description: "1ページ1ファイルのPNGとして、選んだフォルダへ保存します",
      Icon: FileImage,
      variant: "outline",
      onClick: exportPng,
    },
  ]

  // 横幅いっぱいを3等分した1行に並べる。3等分の1つにアイコンと文字（いちばん長い
  // 「PDF 分割」）が収まらない幅（行全体が 18rem 未満）では、アイコンだけにする
  return (
    <div className="@container/export-actions w-full">
      <div className="grid grid-cols-3 gap-2">
        {exportButtons.map((exportButton) => (
          <WithTooltip
            key={exportButton.label}
            content={`${exportButton.accessibleName}: ${exportButton.description}`}
          >
            <Button
              variant={exportButton.variant}
              onClick={exportButton.onClick}
              disabled={isProcessing || pageCount === 0}
              aria-label={exportButton.accessibleName}
              className="w-full min-w-0 px-0"
            >
              {exportButton.isExporting ? <Spinner /> : <exportButton.Icon />}
              <span className="hidden @min-[18rem]/export-actions:inline">
                {exportButton.label}
              </span>
            </Button>
          </WithTooltip>
        ))}
      </div>
    </div>
  )
}
