"use client"

import { Button } from "@/components/ui/button"
import { Eye, User } from "lucide-react"
import type { PreviewMode } from "../types"

interface PreviewModeToggleProps {
  previewMode: PreviewMode
  onPreviewModeChange: (mode: PreviewMode) => void
  hasNameRegion: boolean
}

export function PreviewModeToggle({
  previewMode,
  onPreviewModeChange,
  hasNameRegion,
}: PreviewModeToggleProps) {
  return (
    <div className="flex gap-1">
      <Button
        onClick={() => onPreviewModeChange("full")}
        variant={previewMode === "full" ? "default" : "outline"}
        size="sm"
        className="h-8 px-2 py-1 text-xs"
      >
        <Eye className="mr-1 h-3 w-3" />
        全体表示
      </Button>

      <Button
        onClick={() => onPreviewModeChange("name")}
        variant={previewMode === "name" ? "default" : "outline"}
        size="sm"
        className="h-8 px-2 py-1 text-xs"
        disabled={!hasNameRegion}
        title={
          hasNameRegion ? "氏名欄のみ表示" : "氏名欄領域が設定されていません"
        }
      >
        <User className="mr-1 h-3 w-3" />
        氏名欄
      </Button>
    </div>
  )
}
