"use client"

import { useCallback, useEffect, useRef } from "react"

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
import { generateOutputPages } from "./generateOutputPages"
import InterleaveSettings from "./InterleaveSettings"
import { arrangeInManualOrder, outputPageKey } from "./outputPageOrder"
import OutputPreview from "./OutputPreview"

interface ExportPanelProps {
  importedFiles: ImportedFile[]
  outputPages: OutputPage[]
  excludedPages: Set<string>
  pageRotations: Map<string, RotationDegree>
  exportMode: PdfExportMode
  interleaveConfig: InterleaveConfig
  isProcessing: boolean
  onExportModeChange: (mode: PdfExportMode) => void
  onInterleaveConfigChange: (config: InterleaveConfig) => void
  onFileUpdated: (file: ImportedFile) => void
  onOutputPagesChange: (pages: OutputPage[]) => void
  onPageExcluded: (page: OutputPage) => void
  onPageRotated: (page: OutputPage, rotation: RotationDegree) => void
  onProcessingChange: (processing: boolean) => void
  previewColumns: number
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
  pageRotations,
  exportMode,
  interleaveConfig,
  isProcessing,
  onExportModeChange,
  onInterleaveConfigChange,
  onFileUpdated,
  onOutputPagesChange,
  onPageExcluded,
  onPageRotated,
  onProcessingChange,
  previewColumns,
}: ExportPanelProps) {
  // ドラッグで並べ替えた順（出力ページのキーの並び）。並べ替えていなければ null で、
  // 設定から作った順をそのまま使う。設定を変えて出力ページを作り直しても、この順に並べ直す。
  const manualOrderKeysRef = useRef<string[] | null>(null)

  // 並べる方式（出力モードと交互挿入の1回あたりのページ数）。これを変えるのは順を選び直す
  // 操作なので、そのときはドラッグで並べ替えた順を捨てて新しい方式の順にする
  // （捨てないと、方式を変えても見た目が何も変わらない）。
  const arrangementRef = useRef({ exportMode, interleaveConfig })

  // 設定・除外ページ・ページ別回転が変わったら出力ページを作り直す（並べ替えた順は保つ）
  useEffect(() => {
    const previousArrangement = arrangementRef.current
    arrangementRef.current = { exportMode, interleaveConfig }
    if (
      isArrangementChanged(previousArrangement, {
        exportMode,
        interleaveConfig,
      })
    ) {
      manualOrderKeysRef.current = null
    }

    const pages = generateOutputPages(
      importedFiles,
      exportMode,
      interleaveConfig,
      pageRotations
    )
    const filtered = pages.filter(
      (page) => !isPageExcluded(page, excludedPages)
    )
    const manualOrderKeys = manualOrderKeysRef.current
    if (!manualOrderKeys) {
      onOutputPagesChange(filtered)
      return
    }
    const arranged = arrangeInManualOrder(filtered, manualOrderKeys)
    // 増えたページを差し込んだ位置も覚える（次に作り直したときの基準にする）
    manualOrderKeysRef.current = arranged.map(outputPageKey)
    onOutputPagesChange(arranged)
  }, [
    importedFiles,
    exportMode,
    interleaveConfig,
    excludedPages,
    pageRotations,
    onOutputPagesChange,
  ])

  /** プレビューでドラッグして並べ替えた */
  const handlePagesReorder = useCallback(
    (pages: OutputPage[]) => {
      manualOrderKeysRef.current = pages.map(outputPageKey)
      onOutputPagesChange(pages)
    },
    [onOutputPagesChange]
  )

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
            onPagesChange={onOutputPagesChange}
            onPagesReorder={handlePagesReorder}
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

/**
 * 並べる方式が変わったか。出力モード、または交互挿入で1回に入れるページ数の変更を指す。
 * ファイルの追加・削除に伴う交互挿入設定の増減、2-in-1・回転の変更は含めない
 * （これらは並べ替えた順を保ったまま反映する）。
 */
function isArrangementChanged(
  previous: { exportMode: PdfExportMode; interleaveConfig: InterleaveConfig },
  current: { exportMode: PdfExportMode; interleaveConfig: InterleaveConfig }
): boolean {
  if (previous.exportMode !== current.exportMode) return true
  if (current.exportMode !== "interleave") return false
  const previousPagesPerGroupByFileId = new Map(
    previous.interleaveConfig.transforms.map((transform) => [
      transform.fileId,
      transform.pagesPerGroup,
    ])
  )
  return current.interleaveConfig.transforms.some((transform) => {
    const previousPagesPerGroup = previousPagesPerGroupByFileId.get(
      transform.fileId
    )
    return (
      previousPagesPerGroup !== undefined &&
      previousPagesPerGroup !== transform.pagesPerGroup
    )
  })
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
