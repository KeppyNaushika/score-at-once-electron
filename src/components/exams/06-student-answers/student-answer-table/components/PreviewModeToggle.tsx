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
      <span className="text-sm text-gray-600">表示:</span>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        selectedTone="primary"
        value={previewMode}
        aria-label="表示"
        onValueChange={ignoreDeselect(PREVIEW_MODES, onPreviewModeChange)}
      >
        {/* 項目の横幅は「配置戦略」のトグル（PlacementStrategySelector）とそろえる */}
        <ToggleGroupItem value="full" className="w-20">
          全体
        </ToggleGroupItem>
        <ToggleGroupItem
          value="name-only"
          disabled={!hasNameRegion}
          className="w-20"
        >
          {/* 5文字ぶんの幅を80%に縮め、縮めた1文字ぶん（0.5em×2）を余白から詰める */}
          <span className="mx-[-0.5em] inline-block scale-x-80">
            氏名欄のみ
          </span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}
