"use client"

import { GripVertical } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import type {
  ImportedFile,
  InterleaveConfig,
  OutputPage,
  PdfExportMode,
  RotationDegree,
} from "@/types/pdfTools.types"

import ExportPanel from "./export-panel/ExportPanel"
import ImportPanel from "./import-panel/ImportPanel"

interface PdfToolsMainViewProps {
  /** ページプレビューの1行あたりの枚数 */
  previewColumns: number
}

export default function PdfToolsMainView({
  previewColumns,
}: PdfToolsMainViewProps) {
  const [importedFiles, setImportedFiles] = useState<ImportedFile[]>([])
  const [outputPages, setOutputPages] = useState<OutputPage[]>([])
  const [exportMode, setExportMode] = useState<PdfExportMode>("merge")
  const [interleaveConfig, setInterleaveConfig] = useState<InterleaveConfig>({
    transforms: [],
  })
  const [isProcessing, setIsProcessing] = useState(false)
  // 出力プレビューから除外されたページ（"fileId:pageNumber" のセット）
  const [excludedPages, setExcludedPages] = useState<Set<string>>(new Set())
  // 出力プレビューで個別に回されたページ（"fileId:pageNumber" → 回転角）
  const [pageRotations, setPageRotations] = useState<
    Map<string, RotationDegree>
  >(new Map())

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
    // ファイル削除時に対応する除外ページ・ページ別回転もクリア
    setExcludedPages((prev) => withoutFilePages(prev, fileId))
    setPageRotations((prev) => withoutFileRotations(prev, fileId))
  }

  const handleFileUpdated = (updatedFile: ImportedFile) => {
    // ファイル単位の回転を変えたら、そのファイルのページ別回転は指定し直しとみなす
    const previousFile = importedFiles.find(
      (file) => file.id === updatedFile.id
    )
    if (previousFile && previousFile.rotation !== updatedFile.rotation) {
      setPageRotations((prev) => withoutFileRotations(prev, updatedFile.id))
    }

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

  /** 出力プレビューでページ単位に指定された回転を記録（永続的） */
  const handlePageRotated = useCallback(
    (page: OutputPage, rotation: RotationDegree) => {
      setPageRotations((prev) => {
        const next = new Map(prev)
        // 2-in-1結合ページは先頭ページ番号を代表キーにする（生成側のキーと揃える）
        next.set(`${page.sourceFileId}:${page.sourcePageNumber}`, rotation)
        return next
      })
    },
    []
  )

  /** 除外ページのリセット（ファイル指定 or 全体） */
  const handleResetExcludedPages = useCallback((fileId?: string) => {
    if (fileId) {
      setExcludedPages((prev) => withoutFilePages(prev, fileId))
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
          previewColumns={previewColumns}
        />
      </div>

      {/* リサイズハンドル */}
      <div
        className="relative flex w-2 cursor-col-resize items-center justify-center bg-border transition-colors hover:bg-primary/30"
        onMouseDown={handleMouseDown}
      >
        <div className="flex h-6 w-3 items-center justify-center rounded-sm border bg-muted">
          <GripVertical className="h-3 w-3" />
        </div>
      </div>

      {/* 右パネル */}
      <div className="h-full min-w-0 flex-1 overflow-hidden">
        <ExportPanel
          importedFiles={importedFiles}
          outputPages={outputPages}
          excludedPages={excludedPages}
          pageRotations={pageRotations}
          exportMode={exportMode}
          interleaveConfig={interleaveConfig}
          isProcessing={isProcessing}
          onExportModeChange={setExportMode}
          onInterleaveConfigChange={setInterleaveConfig}
          onOutputPagesChange={handleOutputPagesChange}
          onPageExcluded={handlePageExcluded}
          onPageRotated={handlePageRotated}
          onProcessingChange={setIsProcessing}
          previewColumns={previewColumns}
        />
      </div>
    </div>
  )
}

/** "fileId:pageNumber" キーの集合から、指定ファイルの分を取り除く */
function withoutFilePages(pageKeys: Set<string>, fileId: string): Set<string> {
  const next = new Set<string>()
  for (const pageKey of pageKeys) {
    if (!pageKey.startsWith(`${fileId}:`)) next.add(pageKey)
  }
  return next
}

/** "fileId:pageNumber" → 回転角のマップから、指定ファイルの分を取り除く */
function withoutFileRotations(
  pageRotations: Map<string, RotationDegree>,
  fileId: string
): Map<string, RotationDegree> {
  const next = new Map<string, RotationDegree>()
  for (const [pageKey, rotation] of pageRotations) {
    if (!pageKey.startsWith(`${fileId}:`)) next.set(pageKey, rotation)
  }
  return next
}
