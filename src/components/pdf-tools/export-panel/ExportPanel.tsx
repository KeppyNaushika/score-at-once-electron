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
import InterleaveSettings from "./InterleaveSettings"
import {
  movePageInOrder,
  outputPageKey,
  type PageOrder,
} from "./outputPageOrder"
import OutputPreview from "./OutputPreview"
import { deriveOutputPages, groupIntoSheets } from "./outputSheets"

interface ExportPanelProps {
  importedFiles: ImportedFile[]
  excludedPages: Set<string>
  pageRotations: Map<string, RotationDegree>
  exportMode: PdfExportMode
  interleaveConfig: InterleaveConfig
  /** ページの並び順（全ページ） */
  pageOrder: PageOrder
  isProcessing: boolean
  onExportModeChange: (mode: PdfExportMode) => void
  onInterleaveConfigChange: (config: InterleaveConfig) => void
  onFileUpdated: (file: ImportedFile) => void
  onPageOrderChange: (pageOrder: PageOrder) => void
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
 * 出力ページは state に持たず、描画のたびに導く: ページの並び順から、選択していて
 * 除外していないページを残す → ファイルごとの N-up の面に組む。利用者の操作として
 * 持つのは並び順・除外・回転だけ。
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
  const outputPages = useMemo(
    () =>
      deriveOutputPages({
        files: importedFiles,
        pageRotations,
        pageOrder,
        excludedPages,
      }),
    [importedFiles, pageRotations, pageOrder, excludedPages]
  )
  const outputSheets = useMemo(
    () => groupIntoSheets(outputPages, importedFiles),
    [outputPages, importedFiles]
  )

  /** プレビューでドラッグして並べ替えた（全ページの並び順に写す） */
  const handlePageMoved = (
    movedPage: OutputPage,
    targetPage: OutputPage,
    placement: "before" | "after"
  ) => {
    onPageOrderChange(
      movePageInOrder(
        pageOrder,
        outputPageKey(movedPage),
        outputPageKey(targetPage),
        placement
      )
    )
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">エクスポート</h2>
        <p className="text-sm text-muted-foreground">出力設定とプレビュー</p>
      </div>

      {/*
        出力モードと出力ボタンを1行にまとめ、プレビューに縦の場所を残す。幅が足りなければ
        折り返し、ボタン群は右寄せのまま下の行へ回る。
        @container/export-row は、狭いときに出力ボタンをアイコンだけにする判定に使う（ExportActions）。
        出力ボタンはプレビューの上に置く。下端に置くと、出力の完了を知らせるトースト
        （アプリ共通で右下に出る）が消えるまでの数秒、ボタンに重なって押せなくなる
      */}
      <div className="@container/export-row flex flex-wrap items-center gap-2 border-b p-4">
        <ExportModeSelector
          mode={exportMode}
          onModeChange={onExportModeChange}
          disabled={isProcessing}
        />
        <div className="ml-auto">
          <ExportActions
            outputSheets={outputSheets}
            importedFiles={importedFiles}
            isProcessing={isProcessing}
            onProcessingChange={onProcessingChange}
          />
        </div>
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
        {/* 見出しは割らず、件数のほうを折り返す（幅が足りなければ次の行へ回す） */}
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2">
          <h3 className="text-sm font-medium whitespace-nowrap">
            出力プレビュー
          </h3>
          <span className="min-w-0 text-sm text-muted-foreground">
            {importedFiles.length}ファイル / {outputSheets.length}ページを出力
          </span>
        </div>
        <ScrollArea className="min-h-0 flex-1 rounded-lg border bg-muted/30">
          {/*
            余白はスクロール領域の内側に持たせる。外（ScrollArea 自体）に付けると、
            面をくくる枠（カードの外へはみ出して描く）の上辺と左端が、はみ出さない
            内側の表示域で切り取られる
          */}
          <div className="p-2">
            <OutputPreview
              pages={outputPages}
              sheets={outputSheets}
              onPageMoved={handlePageMoved}
              onDeletePage={onPageExcluded}
              onRotatePage={onPageRotated}
              disabled={isProcessing}
              columns={previewColumns}
            />
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
