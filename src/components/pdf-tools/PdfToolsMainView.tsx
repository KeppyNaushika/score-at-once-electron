"use client"

import { GripVertical } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import type {
  ImportedFile,
  InterleaveConfig,
  NUpConfig,
  OutputPage,
  PdfExportMode,
  RotationDegree,
} from "@/types/pdfTools.types"

import ExportPanel from "./export-panel/ExportPanel"
import {
  arrangementWithImportedFiles,
  arrangementWithInterleaveConfig,
  arrangementWithMode,
  arrangementWithoutFile,
  INITIAL_PAGE_ARRANGEMENT,
  isSourcePageKeyOf,
  outputPageKey,
  type PageArrangement,
  type PageOrder,
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
  // ページの並び順（取り込んだ全ページ。選択していないページも）と、それを作り直す材料
  // （出力モード・交互挿入の設定）。出力の順は並び順だけで決まる
  const [pageArrangement, setPageArrangement] = useState<PageArrangement>(
    INITIAL_PAGE_ARRANGEMENT
  )
  // 全体の N-up。並び順の後で面をまとめるだけなので、変えても並び順は作り直さない
  const [globalNUp, setGlobalNUp] = useState<NUpConfig>({
    pagesPerSheet: 1,
    slotOrder: "from-top-left-rightward",
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
    setPageArrangement((prev) => arrangementWithImportedFiles(prev, files))
  }

  const handleFileRemoved = (fileId: string) => {
    setImportedFiles((prev) => prev.filter((file) => file.id !== fileId))
    setPageArrangement((prev) => arrangementWithoutFile(prev, fileId))
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

  /** 出力モードを変えたら、並び順をその方式の順に作り直す（`arrangementWithMode`） */
  const handleExportModeChange = (mode: PdfExportMode) => {
    setPageArrangement((prev) => arrangementWithMode(prev, importedFiles, mode))
  }

  /**
   * 交互挿入の欄から来るのは1回に入れるページ数の変更だけなので、来たら並び順を
   * 作り直す。N-up・回転はファイルの設定なので並び順に触れない（`handleFileUpdated`）。
   */
  const handleInterleaveConfigChange = (config: InterleaveConfig) => {
    setPageArrangement((prev) =>
      arrangementWithInterleaveConfig(prev, importedFiles, config)
    )
  }

  /** 出力プレビューのドラッグで直した並び順（作り直しの材料は変えない） */
  const handlePageOrderChange = useCallback((pageOrder: PageOrder) => {
    setPageArrangement((prev) => ({ ...prev, pageOrder }))
  }, [])

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
          exportMode={pageArrangement.mode}
          interleaveConfig={pageArrangement.interleaveConfig}
          globalNUp={globalNUp}
          pageOrder={pageArrangement.pageOrder}
          isProcessing={isProcessing}
          onExportModeChange={handleExportModeChange}
          onInterleaveConfigChange={handleInterleaveConfigChange}
          onGlobalNUpChange={setGlobalNUp}
          onFileUpdated={handleFileUpdated}
          onPageOrderChange={handlePageOrderChange}
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
