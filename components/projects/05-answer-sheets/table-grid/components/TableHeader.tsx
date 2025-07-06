"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CardHeader, CardTitle } from "@/components/ui/card"
import type { PlacementStrategy, UnifiedFile } from "@/types/answer-sheet.types"
import TrashDropZone from "../../TrashDropZone"
import type { PreviewMode } from "../types"
import { PlacementStrategySelector } from "./PlacementStrategySelector"
import { PreviewModeToggle } from "./PreviewModeToggle"

interface TableHeaderProps {
  maxPages: number
  enabledFilesCount: number
  trashFiles: UnifiedFile[]
  onFileRestore: (fileId: string) => void
  isUploading: boolean
  mode: "upload" | "view"
  onUpload: () => void
  fileOrder?: PlacementStrategy
  onFileOrderChange?: (order: PlacementStrategy) => void
  previewMode: PreviewMode
  onPreviewModeChange: (mode: PreviewMode) => void
  hasNameRegion: boolean
}

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
  return (
    <CardHeader>
      <CardTitle className="flex flex-col justify-between gap-4">
        <div className="flex items-center gap-2">
          <span>答案配置テーブル</span>
          <Badge variant="outline">{maxPages}ページ</Badge>
          <span className="rounded-full bg-green-100 px-2 py-1 text-sm text-green-700">
            {enabledFilesCount}件
          </span>

          {/* ゴミ箱 */}
          <TrashDropZone
            trashFiles={trashFiles}
            onFileRestore={onFileRestore}
          />

          {/* アップロードボタン */}
          <Button
            onClick={onUpload}
            disabled={isUploading || enabledFilesCount === 0}
            className="ml-4"
          >
            {isUploading
              ? mode === "view"
                ? "更新中..."
                : "アップロード中..."
              : mode === "view"
                ? "変更を反映"
                : "アップロード実行"}
          </Button>
        </div>

        <div className="flex flex-col gap-2 md:flex-row">
          {/* 配置戦略選択（アップロードモード時のみ表示） */}
          {onFileOrderChange && fileOrder && (
            <PlacementStrategySelector
              fileOrder={fileOrder}
              onFileOrderChange={onFileOrderChange}
              mode={mode}
            />
          )}

          {/* プレビューモード切り替え */}
          <PreviewModeToggle
            previewMode={previewMode}
            onPreviewModeChange={onPreviewModeChange}
            hasNameRegion={hasNameRegion}
          />
        </div>
      </CardTitle>
    </CardHeader>
  )
}
