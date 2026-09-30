"use client"

import type {
  PreviewMode,
  PreviewModeToggleProps,
} from "@/components/exams/06-student-answers/student-answer-table/types"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const PREVIEW_MODES: PreviewMode[] = ["full", "name-only"]

export function PreviewModeToggle({
  previewMode,
  onPreviewModeChange,
  hasNameRegion,
}: PreviewModeToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600">プレビュー:</span>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={previewMode}
        aria-label="プレビュー"
        onValueChange={(value) => {
          // 選択中をもう一度押すと空文字が来る。選択は外さない
          const nextPreviewMode = PREVIEW_MODES.find(
            (candidatePreviewMode) => candidatePreviewMode === value
          )
          if (nextPreviewMode) onPreviewModeChange(nextPreviewMode)
        }}
      >
        <ToggleGroupItem
          value="full"
          className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          全体
        </ToggleGroupItem>
        <ToggleGroupItem
          value="name-only"
          disabled={!hasNameRegion}
          className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          氏名欄のみ
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}
