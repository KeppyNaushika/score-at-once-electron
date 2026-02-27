"use client"

import { Minus, Move, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { RenderMode } from "@/types/answerSheetBuilder.types"

interface PreviewToolbarProps {
  zoom: number
  onZoomChange: (zoom: number) => void
  renderMode: RenderMode
  onRenderModeChange: (mode: RenderMode) => void
  pageInfo: string
  interactive?: boolean
  onInteractiveChange?: (interactive: boolean) => void
}

const ZOOM_STEPS = [50, 75, 100, 125, 150, 200]

export function PreviewToolbar({
  zoom,
  onZoomChange,
  renderMode,
  onRenderModeChange,
  pageInfo,
  interactive,
  onInteractiveChange,
}: PreviewToolbarProps) {
  const zoomIn = () => {
    const nextIdx = ZOOM_STEPS.findIndex((s) => s > zoom)
    if (nextIdx >= 0) onZoomChange(ZOOM_STEPS[nextIdx])
  }

  const zoomOut = () => {
    const prevIdx = [...ZOOM_STEPS].reverse().findIndex((s) => s < zoom)
    if (prevIdx >= 0) onZoomChange(ZOOM_STEPS[ZOOM_STEPS.length - 1 - prevIdx])
  }

  return (
    <div className="bg-muted/30 flex items-center justify-between border-b px-3 py-1.5">
      {/* ズーム */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={zoomOut}
          disabled={zoom <= ZOOM_STEPS[0]}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span className="w-10 text-center text-xs">{zoom}%</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={zoomIn}
          disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {/* 調整トグル + ページ情報 */}
      <div className="flex items-center gap-2">
        {onInteractiveChange && (
          <Button
            variant={interactive ? "secondary" : "ghost"}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => onInteractiveChange(!interactive)}
            title="罫線ドラッグで微調整"
          >
            <Move className="mr-1 h-3 w-3" />
            調整
          </Button>
        )}
        <span className="text-muted-foreground text-xs">{pageInfo}</span>
      </div>

      {/* モード切替 */}
      <Select
        value={renderMode}
        onValueChange={(v) => onRenderModeChange(v as RenderMode)}
      >
        <SelectTrigger className="h-7 w-28 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="answer-sheet">解答用紙</SelectItem>
          <SelectItem value="model-answer">模範解答</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
