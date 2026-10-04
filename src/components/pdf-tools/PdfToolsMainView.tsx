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
import {
  filePageKeys,
  isSourcePageKeyOf,
  outputPageKey,
  type PageOrder,
  rebuildPageOrder,
  withoutFilePageOrder,
} from "./export-panel/outputPageOrder"
import ImportPanel from "./import-panel/ImportPanel"

interface PdfToolsMainViewProps {
  /** ページプレビューの1行あたりの枚数 */
  previewColumns: number
}

export default function PdfToolsMainView({
  previewColumns,
}: PdfToolsMainViewProps) {
  const [importedFiles, setImportedFiles] = useState<ImportedFile[]>([])
  // ページの並び順（取り込んだ全ページ。選択していないページも）。出力の順はこれだけで決まる
  const [pageOrder, setPageOrder] = useState<PageOrder>([])
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
    // 取り込んだファイルのページは、ページ番号順に並び順の末尾に付く
    setPageOrder((prev) => [...prev, ...files.flatMap(filePageKeys)])
    // 交互挿入の設定は取り込んだ順に1ファイル1組で持つ（1回に入れるページ数は1から）
    setInterleaveConfig((prev) => ({
      ...prev,
      transforms: [
        ...prev.transforms,
        ...files.map((file) => ({ fileId: file.id, pagesPerGroup: 1 })),
      ],
    }))
  }

  const handleFileRemoved = (fileId: string) => {
    setImportedFiles((prev) => prev.filter((file) => file.id !== fileId))
    setPageOrder((prev) => withoutFilePageOrder(prev, fileId))
    setInterleaveConfig((prev) => ({
      ...prev,
      transforms: prev.transforms.filter(
        (transform) => transform.fileId !== fileId
      ),
    }))
    // ファイル削除時に対応する除外ページ・ページ別回転もクリア
    setExcludedPages((prev) => withoutFilePages(prev, fileId))
    setPageRotations((prev) => withoutFileRotations(prev, fileId))
  }

  // 左のファイル欄と、交互挿入の欄（N-up・回転）の両方から呼ばれる。N-up は並び順の
  // 後で面を組むだけなので、変えても並び順は作り直さない
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

  /**
   * 出力モードを変えたら、並び順をその方式の順に作り直す。方式を選ぶのは順を選ぶ
   * 操作なので、作り直さないと方式を変えても見た目が何も変わらない。
   */
  const handleExportModeChange = (mode: PdfExportMode) => {
    setExportMode(mode)
    setPageOrder(rebuildPageOrder(importedFiles, mode, interleaveConfig))
  }

  /**
   * 交互挿入の欄から来るのは1回に入れるページ数の変更だけなので、来たら並び順を
   * 作り直す。ファイルの増減に伴う設定の増減は取り込み・削除が直接持つのでここを
   * 通らず、N-up・回転はファイルの設定なので並び順に触れない（`handleFileUpdated`）。
   */
  const handleInterleaveConfigChange = (config: InterleaveConfig) => {
    setInterleaveConfig(config)
    setPageOrder(rebuildPageOrder(importedFiles, exportMode, config))
  }

  /**
   * 出力プレビューからページを除外（永続的）。除外はページ単位で、面は残りのページで
   * 組み直される（除外したページの分は詰まる）
   */
  const handlePageExcluded = useCallback((page: OutputPage) => {
    setExcludedPages((prev) => new Set(prev).add(outputPageKey(page)))
  }, [])

  /** 出力プレビューでページ単位に指定された回転を記録（永続的） */
  const handlePageRotated = useCallback(
    (page: OutputPage, rotation: RotationDegree) => {
      // 回すのはそのページだけ（N-up の面ではスロットの中で回る）
      setPageRotations((prev) =>
        new Map(prev).set(outputPageKey(page), rotation)
      )
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
          excludedPages={excludedPages}
          pageRotations={pageRotations}
          exportMode={exportMode}
          interleaveConfig={interleaveConfig}
          pageOrder={pageOrder}
          isProcessing={isProcessing}
          onExportModeChange={handleExportModeChange}
          onInterleaveConfigChange={handleInterleaveConfigChange}
          onFileUpdated={handleFileUpdated}
          onPageOrderChange={setPageOrder}
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
    if (!isSourcePageKeyOf(pageKey, fileId)) next.add(pageKey)
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
    if (!isSourcePageKeyOf(pageKey, fileId)) next.set(pageKey, rotation)
  }
  return next
}
