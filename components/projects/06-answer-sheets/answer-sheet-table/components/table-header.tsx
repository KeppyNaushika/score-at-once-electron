"use client"

import type { TableHeaderProps } from "@/components/projects/06-answer-sheets/answer-sheet-table/types"
import { Button } from "@/components/ui/button"
import { CardHeader, CardTitle } from "@/components/ui/card"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { useDroppable } from "@dnd-kit/core"
import { FileText, Trash2, Upload } from "lucide-react"
import { useState } from "react"
import { PlacementStrategySelector } from "./placement-strategy-selector"
import { PreviewModeToggle } from "./preview-mode-toggle"

export function TableHeader({
  maxPages,
  enabledFilesCount,
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
}: TableHeaderProps) {
  const [isTrashOpen, setIsTrashOpen] = useState(false)

  const { setNodeRef } = useDroppable({
    id: "trash-area",
  })

  const totalCapacity = maxPages * 100 // 仮の容量計算

  return (
    <CardHeader className="pb-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {mode === "view" ? "配置済み答案の確認" : "答案配置テーブル"}
        </CardTitle>

        <div className="flex flex-wrap items-center gap-4">
          {/* 配置戦略選択 - 確認モードでは非表示 */}
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
                <Trash2 className="h-4 w-4" />
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
                          <p className="text-xs text-gray-500">
                            {(file.size / 1024).toFixed(1)}KB
                          </p>
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

      {/* 統計情報 */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
        {mode === "view" ? (
          <>
            <span>登録済み答案: {enabledFilesCount}件</span>
            <span>総ページ数: {maxPages}ページ</span>
          </>
        ) : (
          <>
            <span>配置済み: {enabledFilesCount}件</span>
            <span>無効化済み: {trashFiles.length}件</span>
            <span>容量: {totalCapacity}セル</span>
          </>
        )}
      </div>
    </CardHeader>
  )
}
