"use client"

import { useDroppable } from "@dnd-kit/core"
import { FileText, Trash, Upload } from "lucide-react"
import { useState } from "react"

import type { TableHeaderProps } from "@/components/exams/06-student-answers/student-answer-table/types"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"

import { MarkerCorrectionToggle } from "./MarkerCorrectionToggle"
import { OverwriteToggle } from "./OverwriteToggle"
import { PlacementStrategySelector } from "./PlacementStrategySelector"
import { PreviewModeToggle } from "./PreviewModeToggle"

export function TableHeader({
  maxPages,
  enabledFilesCount,
  uploadPlacement,
  trashFiles,
  onFileRestore,
  isUploading,
  mode,
  onUpload,
  fileOrder,
  onFileOrderChange,
  previewMode,
  onPreviewModeChange,
  hasNameRegion,
  allowOverwrite = false,
  onAllowOverwriteChange,
  markerCorrectionEnabled = false,
  markerCorrectionAvailable = false,
  markerDiagnostics,
  onMarkerCorrectionChange,
}: TableHeaderProps) {
  const [isTrashOpen, setIsTrashOpen] = useState(false)

  const { setNodeRef } = useDroppable({
    id: "trash-area",
  })

  // マスに置けずあふれた答案（アップロードされない）
  const overflowCount = uploadPlacement
    ? enabledFilesCount - uploadPlacement.placedCount
    : 0

  return (
    // 表を下へスクロールしても、件数と操作ボタンが見えるよう上端に貼り付ける。
    // マスの強調表示（最大 z-50）より手前に出す。スクロールする親（06 の page の
    // p-3）の内側余白のぶん上に隙間が空くので、-top-3 で打ち消して上端に付ける。
    // 背景は少し透かしてぼかし、下を流れる表がうっすら見えるようにする
    <div className="sticky -top-3 z-60 bg-background/50 py-2 backdrop-blur-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="flex shrink-0 items-center gap-2 font-semibold whitespace-nowrap">
            <FileText className="h-5 w-5" />
            {mode === "view" ? "配置済み答案の確認" : "答案配置"}
          </h2>

          {/* 統計情報 */}
          <div className="flex shrink-0 flex-wrap items-center gap-4">
            {mode === "view" ? (
              <>
                <StatisticItem label="登録済み答案" count={enabledFilesCount} />
                <StatisticItem label="総ページ数" count={maxPages} />
              </>
            ) : (
              <>
                {/* 未配置＝マスに入りきらずアップロードされない答案 */}
                {uploadPlacement && (
                  <>
                    <StatisticItem
                      label="配置済"
                      count={uploadPlacement.placedCount}
                      tone="success"
                    />
                    <StatisticItem
                      label="未配置"
                      count={overflowCount}
                      tone="danger"
                    />
                  </>
                )}
                <StatisticItem
                  label="無効"
                  count={trashFiles.length}
                  tone="muted"
                />
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* 配置戦略選択（新規配置＝アップロード専用。確認モードでは答案は実セルに固定表示するため非表示） */}
          {mode === "upload" && (
            <PlacementStrategySelector
              fileOrder={fileOrder}
              onFileOrderChange={onFileOrderChange}
            />
          )}

          {/* プレビューモード切り替え */}
          <PreviewModeToggle
            previewMode={previewMode}
            onPreviewModeChange={onPreviewModeChange}
            hasNameRegion={hasNameRegion}
          />

          {/* マーカー補正トグル（アップロードモードのみ） */}
          {mode === "upload" && onMarkerCorrectionChange && (
            <MarkerCorrectionToggle
              enabled={markerCorrectionEnabled}
              available={markerCorrectionAvailable}
              diagnostics={markerDiagnostics}
              onChange={onMarkerCorrectionChange}
            />
          )}

          {/* 既存答案上書きトグル（アップロードモードのみ） */}
          {mode === "upload" && onAllowOverwriteChange && (
            <OverwriteToggle
              allowOverwrite={allowOverwrite}
              onAllowOverwriteChange={onAllowOverwriteChange}
            />
          )}

          {/* アップロードボタン */}
          {mode === "upload" && (
            <Button
              onClick={onUpload}
              disabled={isUploading || enabledFilesCount === 0}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {isUploading ? "アップロード中..." : "アップロード実行"}
            </Button>
          )}

          {/* ゴミ箱ポップオーバー */}
          <Popover open={isTrashOpen} onOpenChange={setIsTrashOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="relative flex items-center gap-2"
                id="trash-popover-trigger"
              >
                <Trash className="h-4 w-4" />
                無効化済み ({trashFiles.length})
                {trashFiles.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                    {trashFiles.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <div className="space-y-2">
                <h4 className="font-medium">無効化済みファイル</h4>
                <Separator />
                <div
                  ref={setNodeRef}
                  className="max-h-48 min-h-16 space-y-2 overflow-y-auto rounded-md border-2 border-dashed border-gray-200 p-2"
                >
                  {trashFiles.length === 0 ? (
                    <p className="text-center text-sm text-gray-500">
                      無効化されたファイルはありません
                    </p>
                  ) : (
                    trashFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between rounded-md bg-gray-50 p-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {file.name.split(" - ページ")[0] || file.name}
                          </p>
                          {file.size !== undefined && (
                            <p className="text-xs text-gray-500">
                              {(file.size / 1024).toFixed(1)}KB
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onFileRestore(file.id)}
                          className="ml-2 h-8 px-2"
                        >
                          復元
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  )
}

const STATISTIC_TONE_CLASSES = {
  neutral: "bg-white text-gray-900 shadow-sm",
  success: "border-green-200 bg-green-100 text-green-700",
  danger: "border-red-200 bg-red-100 text-red-700",
  muted: "border-gray-200 bg-gray-100 text-gray-600",
} as const

function StatisticItem({
  label,
  count,
  tone = "neutral",
}: {
  label: string
  count: number
  tone?: "neutral" | "success" | "danger" | "muted"
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-600">{label}</span>
      <span
        className={`rounded-md border px-3 text-lg font-bold ${STATISTIC_TONE_CLASSES[tone]}`}
      >
        {count}
      </span>
    </div>
  )
}
