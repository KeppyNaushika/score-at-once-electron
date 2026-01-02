"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import type {
  ExportMode,
  ImportedFile,
  InterleaveConfig,
  OutputPage,
} from "@/types/pdfTools.types"
import ExportModeSelector from "./ExportModeSelector"
import InterleaveSettings from "./InterleaveSettings"
import OutputPreview from "./OutputPreview"
import ExportActions from "./ExportActions"
import { useEffect } from "react"

interface ExportPanelProps {
  importedFiles: ImportedFile[]
  outputPages: OutputPage[]
  exportMode: ExportMode
  interleaveConfig: InterleaveConfig
  isProcessing: boolean
  onExportModeChange: (mode: ExportMode) => void
  onInterleaveConfigChange: (config: InterleaveConfig) => void
  onOutputPagesChange: (pages: OutputPage[]) => void
  onProcessingChange: (processing: boolean) => void
}

export default function ExportPanel({
  importedFiles,
  outputPages,
  exportMode,
  interleaveConfig,
  isProcessing,
  onExportModeChange,
  onInterleaveConfigChange,
  onOutputPagesChange,
  onProcessingChange,
}: ExportPanelProps) {
  // インポートファイルが変更されたら出力ページを更新
  useEffect(() => {
    const pages = generateOutputPages(
      importedFiles,
      exportMode,
      interleaveConfig
    )
    onOutputPagesChange(pages)
  }, [importedFiles, exportMode, interleaveConfig])

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">エクスポート</h2>
        <p className="text-muted-foreground text-sm">出力設定とプレビュー</p>
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
            disabled={isProcessing}
          />
        </div>
      )}

      <div className="flex-1 overflow-hidden p-4">
        <h3 className="mb-2 text-sm font-medium">出力プレビュー</h3>
        <ScrollArea className="bg-muted/30 h-full rounded-lg border p-2">
          <OutputPreview
            pages={outputPages}
            onPagesChange={onOutputPagesChange}
            disabled={isProcessing}
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

function generateOutputPages(
  files: ImportedFile[],
  mode: ExportMode,
  interleaveConfig: InterleaveConfig
): OutputPage[] {
  const pages: OutputPage[] = []

  if (mode === "merge" || mode === "split") {
    // 結合・分割モード: 選択されたページを順番に追加
    for (const file of files) {
      const sortedPages = Array.from(file.selectedPages).sort((a, b) => a - b)

      if (file.nUp.enabled) {
        // 2-in-1モード: 2ページずつ結合
        for (let i = 0; i < sortedPages.length; i += 2) {
          const page1 = sortedPages[i]
          const page2 = sortedPages[i + 1]
          const combinedPages = page2 ? [page1, page2] : [page1]

          pages.push({
            id: crypto.randomUUID(),
            sourceFileId: file.id,
            sourceFileName: file.name,
            sourcePageNumber: page1,
            thumbnail: file.thumbnails[page1 - 1] || "",
            rotation: file.rotation,
            isNUpCombined: true,
            combinedPages,
            nUpLayout: file.nUp.layout,
          })
        }
      } else {
        // 通常モード
        for (const pageNum of sortedPages) {
          pages.push({
            id: crypto.randomUUID(),
            sourceFileId: file.id,
            sourceFileName: file.name,
            sourcePageNumber: pageNum,
            thumbnail: file.thumbnails[pageNum - 1] || "",
            rotation: file.rotation,
            isNUpCombined: false,
          })
        }
      }
    }
  } else if (mode === "interleave" && interleaveConfig.enabled) {
    // インターリーブモード: 交互に配置
    const filePageGroups: OutputPage[][] = []

    for (const transform of interleaveConfig.transforms) {
      const file = files.find((f) => f.id === transform.fileId)
      if (!file) continue

      const sortedPages = Array.from(file.selectedPages).sort((a, b) => a - b)
      const group: OutputPage[] = []

      if (transform.nUp.enabled) {
        for (let i = 0; i < sortedPages.length; i += 2) {
          const page1 = sortedPages[i]
          const page2 = sortedPages[i + 1]
          group.push({
            id: crypto.randomUUID(),
            sourceFileId: file.id,
            sourceFileName: file.name,
            sourcePageNumber: page1,
            thumbnail: file.thumbnails[page1 - 1] || "",
            rotation: transform.rotation,
            isNUpCombined: true,
            combinedPages: page2 ? [page1, page2] : [page1],
            nUpLayout: transform.nUp.layout,
          })
        }
      } else {
        for (const pageNum of sortedPages) {
          group.push({
            id: crypto.randomUUID(),
            sourceFileId: file.id,
            sourceFileName: file.name,
            sourcePageNumber: pageNum,
            thumbnail: file.thumbnails[pageNum - 1] || "",
            rotation: transform.rotation,
            isNUpCombined: false,
          })
        }
      }

      filePageGroups.push(group)
    }

    // インターリーブ
    const maxLength = Math.max(...filePageGroups.map((g) => g.length), 0)
    for (let i = 0; i < maxLength; i++) {
      for (const group of filePageGroups) {
        if (group[i]) {
          pages.push(group[i])
        }
      }
    }
  } else {
    // インターリーブ無効時はmergeと同じ
    return generateOutputPages(files, "merge", interleaveConfig)
  }

  return pages
}
