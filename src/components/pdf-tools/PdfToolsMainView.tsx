"use client"

import { GripVertical } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import type {
  ExportMode,
  ImportedFile,
  InterleaveConfig,
  OutputPage,
} from "@/types/pdfTools.types"

import ExportPanel from "./export-panel/ExportPanel"
import ImportPanel from "./import-panel/ImportPanel"

export default function PdfToolsMainView() {
  const [importedFiles, setImportedFiles] = useState<ImportedFile[]>([])
  const [outputPages, setOutputPages] = useState<OutputPage[]>([])
  const [exportMode, setExportMode] = useState<ExportMode>("merge")
  const [interleaveConfig, setInterleaveConfig] = useState<InterleaveConfig>({
    enabled: false,
    transforms: [],
  })
  const [isProcessing, setIsProcessing] = useState(false)
  // 出力プレビューから除外されたページ（"fileId:pageNumber" のセット）
  const [excludedPages, setExcludedPages] = useState<Set<string>>(new Set())

  // リサイズ関連の状態
  const [leftPanelWidth, setLeftPanelWidth] = useState(50) // パーセント
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const handleFilesImported = (files: ImportedFile[]) => {
    setImportedFiles((prev) => [...prev, ...files])
  }

  const handleFileRemoved = (fileId: string) => {
    setImportedFiles((prev) => prev.filter((file) => file.id !== fileId))
    setOutputPages((prev) =>
      prev.filter((page) => page.sourceFileId !== fileId)
    )
    // ファイル削除時に対応する除外ページもクリア
    setExcludedPages((prev) => {
      const next = new Set<string>()
      for (const key of prev) {
        if (!key.startsWith(`${fileId}:`)) next.add(key)
      }
      return next
    })
  }

  const handleFileUpdated = (updatedFile: ImportedFile) => {
    setImportedFiles((prev) =>
      prev.map((file) => (file.id === updatedFile.id ? updatedFile : file))
    )
  }

  const handleOutputPagesChange = useCallback((pages: OutputPage[]) => {
    setOutputPages(pages)
  }, [])

  /** 出力プレビューからページを除外（永続的） */
  const handlePageExcluded = useCallback((page: OutputPage) => {
    setExcludedPages((prev) => {
      const next = new Set(prev)
      if (page.isNUpCombined && page.combinedPages) {
        for (const pageNumber of page.combinedPages) {
          next.add(`${page.sourceFileId}:${pageNumber}`)
        }
      } else {
        next.add(`${page.sourceFileId}:${page.sourcePageNumber}`)
      }
      return next
    })
  }, [])

  /** 除外ページのリセット（ファイル指定 or 全体） */
  const handleResetExcludedPages = useCallback((fileId?: string) => {
    if (fileId) {
      setExcludedPages((prev) => {
        const next = new Set<string>()
        for (const key of prev) {
          if (!key.startsWith(`${fileId}:`)) next.add(key)
        }
        return next
      })
    } else {
      setExcludedPages(new Set())
    }
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const newWidth =
      ((e.clientX - containerRect.left) / containerRect.width) * 100

    // 20% ~ 80% の範囲に制限
    const clampedWidth = Math.min(Math.max(newWidth, 20), 80)
    setLeftPanelWidth(clampedWidth)
  }, [])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
    document.body.style.cursor = ""
    document.body.style.userSelect = ""
  }, [])

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  return (
    <div ref={containerRef} className="flex h-full w-full">
      {/* 左パネル */}
      <div
        className="h-full min-w-0 overflow-hidden"
        style={{ width: `${leftPanelWidth}%` }}
      >
        <ImportPanel
          importedFiles={importedFiles}
          excludedPages={excludedPages}
          onFilesImported={handleFilesImported}
          onFileRemoved={handleFileRemoved}
          onFileUpdated={handleFileUpdated}
          onResetExcludedPages={handleResetExcludedPages}
          isProcessing={isProcessing}
        />
      </div>

      {/* リサイズハンドル */}
      <div
        className="bg-border hover:bg-primary/30 relative flex w-2 cursor-col-resize items-center justify-center transition-colors"
        onMouseDown={handleMouseDown}
      >
        <div className="bg-muted flex h-6 w-3 items-center justify-center rounded-sm border">
          <GripVertical className="h-3 w-3" />
        </div>
      </div>

      {/* 右パネル */}
      <div className="h-full min-w-0 flex-1 overflow-hidden">
        <ExportPanel
          importedFiles={importedFiles}
          outputPages={outputPages}
          excludedPages={excludedPages}
          exportMode={exportMode}
          interleaveConfig={interleaveConfig}
          isProcessing={isProcessing}
          onExportModeChange={setExportMode}
          onInterleaveConfigChange={setInterleaveConfig}
          onOutputPagesChange={handleOutputPagesChange}
          onPageExcluded={handlePageExcluded}
          onProcessingChange={setIsProcessing}
        />
      </div>
    </div>
  )
}
