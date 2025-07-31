"use client"

import type { PreviewModeToggleProps } from "@/components/projects/06-answer-sheets/answer-sheet-table/types"
import { Button } from "@/components/ui/button"

export function PreviewModeToggle({
  previewMode,
  onPreviewModeChange,
  hasNameRegion,
}: PreviewModeToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600">プレビュー:</span>
      <div className="flex rounded-md border">
        <Button
          variant={previewMode === "full" ? "default" : "ghost"}
          size="sm"
          onClick={() => {
            onPreviewModeChange("full")
          }}
          className="rounded-r-none border-r"
        >
          全体
        </Button>
        <Button
          variant={previewMode === "name-only" ? "default" : "ghost"}
          size="sm"
          onClick={() => {
            onPreviewModeChange("name-only")
          }}
          className="rounded-l-none"
          disabled={!hasNameRegion}
        >
          氏名欄のみ
        </Button>
      </div>
    </div>
  )
}
