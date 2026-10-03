"use client"

import {
  PREVIEW_MODES,
  type PreviewModeToggleProps,
} from "@/components/exams/06-student-answers/student-answer-table/types"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ignoreDeselect } from "@/lib/toggleSelection"

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
        selectedTone="primary"
        value={previewMode}
        aria-label="プレビュー"
        onValueChange={ignoreDeselect(PREVIEW_MODES, onPreviewModeChange)}
      >
        <ToggleGroupItem value="full" className="px-3">
          全体
        </ToggleGroupItem>
        <ToggleGroupItem
          value="name-only"
          disabled={!hasNameRegion}
          className="px-3"
        >
          氏名欄のみ
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}
