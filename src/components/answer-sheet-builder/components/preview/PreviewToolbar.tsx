"use client"

import { ChevronLeft, ChevronRight, Minus, Move, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { RenderMode } from "@/types/answerSheetDefinition.types"

interface PreviewToolbarProps {
  zoom: number
  onZoomChange: (zoom: number) => void
  renderMode: RenderMode
  onRenderModeChange: (mode: RenderMode) => void
  pageInfo: string
  interactive?: boolean
  onInteractiveChange?: (interactive: boolean) => void
  currentPage?: number
  totalPages?: number
  onPageChange?: (page: number) => void
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
  currentPage,
  totalPages,
  onPageChange,
}: PreviewToolbarProps) {
  const zoomIn = () => {
    const nextIdx = ZOOM_STEPS.findIndex((step) => step > zoom)
    if (nextIdx >= 0) onZoomChange(ZOOM_STEPS[nextIdx])
  }

  const zoomOut = () => {
    const prevIdx = [...ZOOM_STEPS].reverse().findIndex((step) => step < zoom)
    if (prevIdx >= 0) onZoomChange(ZOOM_STEPS[ZOOM_STEPS.length - 1 - prevIdx])
  }

  return (
    <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
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

      {/* 調整トグル + ページナビゲーション + ページ情報 */}
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
        {totalPages != null &&
          totalPages > 1 &&
          onPageChange &&
          currentPage != null && (
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage <= 0}
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="min-w-12 text-center text-xs">
                {currentPage + 1}/{totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages - 1}
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          )}
        <span className="text-xs text-muted-foreground">{pageInfo}</span>
      </div>

      {/* モード切替 */}
      <div className="flex items-center gap-1.5">
        <Switch
          id="render-mode-toggle"
          checked={renderMode === "model-answer"}
          onCheckedChange={(checked) =>
            onRenderModeChange(checked ? "model-answer" : "answer-sheet")
          }
          className="scale-75"
        />
        <Label
          htmlFor="render-mode-toggle"
          className="cursor-pointer text-xs text-muted-foreground"
        >
          模範解答の表示
        </Label>
      </div>
    </div>
  )
}
