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

  // リサイズ関連の状態
  const [leftPanelWidth, setLeftPanelWidth] = useState(50) // パーセント
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const handleFilesImported = (files: ImportedFile[]) => {
    setImportedFiles((prev) => [...prev, ...files])
  }

  const handleFileRemoved = (fileId: string) => {
    setImportedFiles((prev) => prev.filter((f) => f.id !== fileId))
    setOutputPages((prev) => prev.filter((p) => p.sourceFileId !== fileId))
  }

  const handleFileUpdated = (updatedFile: ImportedFile) => {
    setImportedFiles((prev) =>
      prev.map((f) => (f.id === updatedFile.id ? updatedFile : f))
    )
  }

  const handleOutputPagesChange = useCallback((pages: OutputPage[]) => {
    setOutputPages(pages)
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
          onFilesImported={handleFilesImported}
          onFileRemoved={handleFileRemoved}
          onFileUpdated={handleFileUpdated}
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
          exportMode={exportMode}
          interleaveConfig={interleaveConfig}
          isProcessing={isProcessing}
          onExportModeChange={setExportMode}
          onInterleaveConfigChange={setInterleaveConfig}
          onOutputPagesChange={handleOutputPagesChange}
          onProcessingChange={setIsProcessing}
        />
      </div>
    </div>
  )
}
