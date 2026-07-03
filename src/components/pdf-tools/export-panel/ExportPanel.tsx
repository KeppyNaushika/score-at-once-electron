"use client"

import { useEffect, useRef } from "react"

import { ScrollArea } from "@/components/ui/scroll-area"
import type {
  ExportMode,
  ImportedFile,
  InterleaveConfig,
  OutputPage,
} from "@/types/pdfTools.types"

import ExportActions from "./ExportActions"
import ExportModeSelector from "./ExportModeSelector"
import InterleaveSettings from "./InterleaveSettings"
import OutputPreview from "./OutputPreview"

interface ExportPanelProps {
  importedFiles: ImportedFile[]
  outputPages: OutputPage[]
  excludedPages: Set<string>
  exportMode: ExportMode
  interleaveConfig: InterleaveConfig
  isProcessing: boolean
  onExportModeChange: (mode: ExportMode) => void
  onInterleaveConfigChange: (config: InterleaveConfig) => void
  onOutputPagesChange: (pages: OutputPage[]) => void
  onPageExcluded: (page: OutputPage) => void
  onProcessingChange: (processing: boolean) => void
}

/**
 * PDFエクスポートパネルコンポーネント
 *
 * エクスポートモード選択、交互挿入設定、出力プレビュー、エクスポート実行を管理する
 */
export default function ExportPanel({
  importedFiles,
  outputPages,
  excludedPages,
  exportMode,
  interleaveConfig,
  isProcessing,
  onExportModeChange,
  onInterleaveConfigChange,
  onOutputPagesChange,
  onPageExcluded,
  onProcessingChange,
}: ExportPanelProps) {
  // excludedPages の最新値をrefで保持（useEffectの依存配列に入れず、再生成時のみ参照）
  const excludedPagesRef = useRef(excludedPages)
  excludedPagesRef.current = excludedPages

  // インポートファイルが変更されたら出力ページを更新（除外ページを反映）
  useEffect(() => {
    const pages = generateOutputPages(
      importedFiles,
      exportMode,
      interleaveConfig
    )
    const filtered = pages.filter(
      (page) => !isPageExcluded(page, excludedPagesRef.current)
    )
    onOutputPagesChange(filtered)
  }, [importedFiles, exportMode, interleaveConfig, onOutputPagesChange])

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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
        <h3 className="mb-2 text-sm font-medium">出力プレビュー</h3>
        <ScrollArea className="bg-muted/30 min-h-0 flex-1 rounded-lg border p-2">
          <OutputPreview
            pages={outputPages}
            onPagesChange={onOutputPagesChange}
            onDeletePage={onPageExcluded}
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

/** 除外対象かどうかを判定 */
function isPageExcluded(page: OutputPage, excludedPages: Set<string>): boolean {
  if (page.isNUpCombined && page.combinedPages) {
    return page.combinedPages.some((pageNumber) =>
      excludedPages.has(`${page.sourceFileId}:${pageNumber}`)
    )
  }
  return excludedPages.has(`${page.sourceFileId}:${page.sourcePageNumber}`)
}

/**
 * インポートされたファイルから出力ページリストを生成
 *
 * @param files - インポートされたファイル一覧
 * @param mode - エクスポートモード（merge, split, interleave）
 * @param interleaveConfig - 交互挿入設定
 * @returns 生成された出力ページ配列
 */
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
        for (const pageNumber of sortedPages) {
          pages.push({
            id: crypto.randomUUID(),
            sourceFileId: file.id,
            sourceFileName: file.name,
            sourcePageNumber: pageNumber,
            thumbnail: file.thumbnails[pageNumber - 1] || "",
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
        for (const pageNumber of sortedPages) {
          group.push({
            id: crypto.randomUUID(),
            sourceFileId: file.id,
            sourceFileName: file.name,
            sourcePageNumber: pageNumber,
            thumbnail: file.thumbnails[pageNumber - 1] || "",
            rotation: transform.rotation,
            isNUpCombined: false,
          })
        }
      }

      filePageGroups.push(group)
    }

    // pagesPerGroupに基づいてグループ化してインターリーブ
    const groupedPages: OutputPage[][][] = filePageGroups.map(
      (group, index) => {
        const transform = interleaveConfig.transforms[index]
        const perGroup = transform?.pagesPerGroup || 1
        const chunks: OutputPage[][] = []
        for (let i = 0; i < group.length; i += perGroup) {
          chunks.push(group.slice(i, i + perGroup))
        }
        return chunks
      }
    )

    const maxChunks = Math.max(...groupedPages.map((group) => group.length), 0)
    for (let i = 0; i < maxChunks; i++) {
      for (const chunks of groupedPages) {
        if (chunks[i]) {
          pages.push(...chunks[i])
        }
      }
    }
  } else {
    // インターリーブ無効時はmergeと同じ
    return generateOutputPages(files, "merge", interleaveConfig)
  }

  return pages
}
