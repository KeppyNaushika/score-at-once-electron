"use client"

import { useMemo } from "react"

import { ScrollArea } from "@/components/ui/scroll-area"
import type {
  ImportedFile,
  InterleaveConfig,
  OutputPage,
  PdfExportMode,
  RotationDegree,
} from "@/types/pdfTools.types"

import ExportActions from "./ExportActions"
import ExportModeSelector from "./ExportModeSelector"
import { deriveOutputPages, pageOrderAfterMove } from "./generateOutputPages"
import InterleaveSettings from "./InterleaveSettings"
import type { PageOrder } from "./outputPageOrder"
import OutputPreview from "./OutputPreview"

interface ExportPanelProps {
  importedFiles: ImportedFile[]
  excludedPages: Set<string>
  pageRotations: Map<string, RotationDegree>
  exportMode: PdfExportMode
  interleaveConfig: InterleaveConfig
  /** ページの並び順（全ページ）。並べ替えていなければ null */
  pageOrder: PageOrder
  isProcessing: boolean
  onExportModeChange: (mode: PdfExportMode) => void
  onInterleaveConfigChange: (config: InterleaveConfig) => void
  onFileUpdated: (file: ImportedFile) => void
  onPageOrderChange: (pageOrder: string[]) => void
  onPageExcluded: (page: OutputPage) => void
  onPageRotated: (page: OutputPage, rotation: RotationDegree) => void
  onProcessingChange: (processing: boolean) => void
  previewColumns: number
}

/**
 * PDFエクスポートパネルコンポーネント
 *
 * エクスポートモード選択、交互挿入設定、出力プレビュー、エクスポート実行を管理する。
 *
 * 出力ページは state に持たず、描画のたびに導く: 設定から作る → ページの並び順に
 * 並べる → 除外したページを外す。利用者の操作として持つのは並び順・除外・回転だけ。
 */
export default function ExportPanel({
  importedFiles,
  excludedPages,
  pageRotations,
  exportMode,
  interleaveConfig,
  pageOrder,
  isProcessing,
  onExportModeChange,
  onInterleaveConfigChange,
  onFileUpdated,
  onPageOrderChange,
  onPageExcluded,
  onPageRotated,
  onProcessingChange,
  previewColumns,
}: ExportPanelProps) {
  const outputPageSettings = useMemo(
    () => ({
      files: importedFiles,
      mode: exportMode,
      interleaveConfig,
      pageRotations,
      pageOrder,
      excludedPages,
    }),
    [
      importedFiles,
      exportMode,
      interleaveConfig,
      pageRotations,
      pageOrder,
      excludedPages,
    ]
  )
  const outputPages = useMemo(
    () => deriveOutputPages(outputPageSettings),
    [outputPageSettings]
  )

  /** プレビューでドラッグして並べ替えた（全ページの並び順に写す） */
  const handlePageMoved = (
    movedPage: OutputPage,
    targetPage: OutputPage,
    placement: "before" | "after"
  ) => {
    onPageOrderChange(
      pageOrderAfterMove(outputPageSettings, movedPage, targetPage, placement)
    )
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">エクスポート</h2>
        <p className="text-sm text-muted-foreground">出力設定とプレビュー</p>
      </div>

      <div className="border-b p-4">
        <ExportModeSelector
          mode={exportMode}
          onModeChange={onExportModeChange}
          disabled={isProcessing}
        />
      </div>

      {exportMode === "interleave" && (
        <div className="border-b p-4">
          <InterleaveSettings
            files={importedFiles}
            config={interleaveConfig}
            onConfigChange={onInterleaveConfigChange}
            onFileUpdated={onFileUpdated}
            disabled={isProcessing}
          />
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
        <h3 className="mb-2 text-sm font-medium">出力プレビュー</h3>
        <ScrollArea className="min-h-0 flex-1 rounded-lg border bg-muted/30 p-2">
          <OutputPreview
            pages={outputPages}
            onPageMoved={handlePageMoved}
            onDeletePage={onPageExcluded}
            onRotatePage={onPageRotated}
            disabled={isProcessing}
            columns={previewColumns}
          />
        </ScrollArea>
      </div>

      <div className="border-t p-4">
        <ExportActions
          outputPages={outputPages}
          importedFiles={importedFiles}
          isProcessing={isProcessing}
          onProcessingChange={onProcessingChange}
        />
      </div>
    </div>
  )
}
