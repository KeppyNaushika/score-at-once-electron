"use client"

import { useMemo } from "react"

import { ScrollArea } from "@/components/ui/scroll-area"
import type {
  ImportedFile,
  InterleaveConfig,
  NUpConfig,
  OutputPage,
  PdfExportMode,
  RotationDegree,
} from "@/types/pdfTools.types"

import ExportActions from "./ExportActions"
import ExportModeToggle from "./ExportModeToggle"
import GlobalNUpSettings from "./GlobalNUpSettings"
import InterleaveSettings from "./InterleaveSettings"
import {
  movePageInOrder,
  outputPageKey,
  type PageOrder,
} from "./outputPageOrder"
import OutputPreview from "./OutputPreview"
import {
  deriveOutputPages,
  groupIntoGlobalSheets,
  groupIntoSheets,
} from "./outputSheets"

interface ExportPanelProps {
  importedFiles: ImportedFile[]
  excludedPages: Set<string>
  pageRotations: Map<string, RotationDegree>
  exportMode: PdfExportMode
  interleaveConfig: InterleaveConfig
  /** 全体の N-up（ファイルごとの面や単独ページを、さらに N 個ずつ1面にまとめる） */
  globalNUp: NUpConfig
  /** ページの並び順（全ページ） */
  pageOrder: PageOrder
  isProcessing: boolean
  onExportModeChange: (mode: PdfExportMode) => void
  onInterleaveConfigChange: (config: InterleaveConfig) => void
  onGlobalNUpChange: (globalNUp: NUpConfig) => void
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
 * 除外していないページを残す → ファイルごとの N-up の面に組む → 全体の N-up の面に
 * まとめる。利用者の操作として持つのは並び順・除外・回転だけ。
 */
export default function ExportPanel({
  importedFiles,
  excludedPages,
  pageRotations,
  exportMode,
  interleaveConfig,
  globalNUp,
  pageOrder,
  isProcessing,
  onExportModeChange,
  onInterleaveConfigChange,
  onGlobalNUpChange,
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
    () =>
      groupIntoGlobalSheets(
        groupIntoSheets(outputPages, importedFiles),
        globalNUp
      ),
    [outputPages, importedFiles, globalNUp]
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
      {/*
        パネルの見出し（左のインポート欄の見出しと同じ段）。出力モードはその右端に置く。
        モードは並び順ごと作り直す大きな切り替えなので、出力の設定より上に置く
      */}
      <div className="flex items-center justify-between gap-2 border-b p-4">
        {/* 狭いときは見出しの文字を切り詰め、出力モードを同じ行に残す */}
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">エクスポート</h2>
          <p className="truncate text-sm text-muted-foreground">
            出力設定とプレビュー
          </p>
        </div>
        <ExportModeToggle
          mode={exportMode}
          onModeChange={onExportModeChange}
          disabled={isProcessing}
        />
      </div>

      {/*
        全体の N-up と出力ボタン（横幅いっぱいを3等分）。プレビューに縦の場所を残すよう
        余白を詰める。出力ボタンはプレビューの上に置く。下端に置くと、出力の完了を知らせる
        トースト（アプリ共通で右下に出る）が消えるまでの数秒、ボタンに重なって押せなくなる
      */}
      <div className="space-y-2 border-b px-4 py-3">
        <GlobalNUpSettings
          globalNUp={globalNUp}
          onGlobalNUpChange={onGlobalNUpChange}
          disabled={isProcessing}
        />
        <ExportActions
          outputSheets={outputSheets}
          importedFiles={importedFiles}
          isProcessing={isProcessing}
          onProcessingChange={onProcessingChange}
        />
      </div>

      {/* ファイルが多いとプレビューを押し出すので、高さに上限を付けて中でスクロールさせる */}
      {exportMode === "interleave" && (
        <div className="max-h-[35%] shrink-0 overflow-y-auto border-b px-4 py-3">
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
