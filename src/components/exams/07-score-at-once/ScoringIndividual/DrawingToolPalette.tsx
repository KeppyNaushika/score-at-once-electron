"use client"

import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import {
  Crop,
  Hand,
  Maximize,
  MousePointer2,
  Star,
  ZoomIn,
  ZoomOut,
} from "lucide-react"

import { useKeyBindings } from "@/components/exams/07-score-at-once/hooks/useKeyBindings"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

import { EllipseToolPopover } from "./EllipseToolPopover"
import { usePaletteAutoHide } from "./hooks/view/usePaletteAutoHide"
import { LineToolPopover } from "./LineToolPopover"
import { PaletteTooltip } from "./PaletteTooltip"
import { RectangleToolPopover } from "./RectangleToolPopover"
import { TextToolPopover } from "./TextToolPopover"
import type { CanvasTool } from "./types"
import { paletteStylesFor } from "./utils/paletteStyles"

interface DrawingToolPaletteProps {
  // Container ref for mouse event monitoring
  containerRef?: React.RefObject<HTMLDivElement | null>

  // View controls
  onZoomIn: () => void
  onZoomOut: () => void
  onMaximizeView: () => void
  onCropView: () => void
  currentCropRegion?: QuestionAnswerRegionRow

  // Tool selection
  currentTool: CanvasTool
  onToolChange: (tool: CanvasTool) => void

  // Drawing settings
  strokeColor: string
  strokeWidth: number
  lineStyle: string
  onStrokeColorChange: (color: string) => void
  onStrokeWidthChange: (width: number) => void
  onLineStyleChange: (style: string) => void

  // 選択中の要素（スタイル編集用）
  selectedElements?: DrawingAnnotation[]
  onUpdateSelectedElements?: (
    updates: Array<{ id: string; updates: Partial<DrawingAnnotation> }>
  ) => void
  onClearSelection?: () => void

  // お気に入り機能
  onToggleFavorite?: (elementIds: string[]) => void
  favoriteElementIds?: Set<string>
}

export function DrawingToolPalette({
  containerRef,
  onZoomIn,
  onZoomOut,
  onMaximizeView,
  onCropView,
  currentCropRegion,
  currentTool,
  onToolChange,
  strokeColor,
  strokeWidth,
  lineStyle,
  onStrokeColorChange,
  onStrokeWidthChange,
  onLineStyleChange,
  selectedElements = [],
  onUpdateSelectedElements,
  onClearSelection,
  onToggleFavorite,
  favoriteElementIds,
}: DrawingToolPaletteProps) {
  // 種類ごとの表示値と変更ハンドラ（選択中の要素があればその値）
  const {
    selectedLines,
    selectedRectangles,
    selectedEllipses,
    selectedTexts,
    line,
    rectangle,
    ellipse,
    text,
  } = paletteStylesFor({
    selectedElements,
    strokeColor,
    strokeWidth,
    lineStyle,
    onStrokeColorChange,
    onStrokeWidthChange,
    onLineStyleChange,
    onUpdateSelectedElements,
  })

  // キーバインディング取得
  const { keyBindings } = useKeyBindings()

  // 一定時間操作が無ければ隠す
  const { isVisible, setIsHovered } = usePaletteAutoHide(containerRef)

  return (
    <TooltipPrimitive.Provider delayDuration={300} disableHoverableContent>
      <div
        className="absolute top-4 left-4 transition-opacity duration-300"
        style={{
          opacity: isVisible ? 1 : 0,
          pointerEvents: isVisible ? "auto" : "none",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Card className="p-2">
          <div className="flex flex-col space-y-1">
            {/* ズーム・ビュー操作 */}
            <PaletteTooltip label="拡大" shortcutKey="+">
              <Button size="sm" variant="ghost" onClick={onZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </PaletteTooltip>

            <PaletteTooltip label="縮小" shortcutKey="-">
              <Button size="sm" variant="ghost" onClick={onZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
            </PaletteTooltip>

            <PaletteTooltip
              label="全体表示"
              shortcutKey={(keyBindings["view.fullView"] || "M").toUpperCase()}
            >
              <Button size="sm" variant="ghost" onClick={onMaximizeView}>
                <Maximize className="h-4 w-4" />
              </Button>
            </PaletteTooltip>

            <PaletteTooltip
              label="設問表示"
              shortcutKey={(
                keyBindings["view.questionView"] || "C"
              ).toUpperCase()}
            >
              <Button
                size="sm"
                variant="ghost"
                onClick={onCropView}
                disabled={!currentCropRegion}
              >
                <Crop className="h-4 w-4" />
              </Button>
            </PaletteTooltip>

            {/* セパレーター */}
            <Separator className="my-1" />

            {/* ツール選択 */}
            <PaletteTooltip
              label="ハンドツール"
              note="ドラッグで移動"
              shortcutKey={(keyBindings["tool.hand"] || "H").toUpperCase()}
            >
              <Button
                size="sm"
                variant={currentTool === "hand" ? "default" : "ghost"}
                onClick={() => onToolChange("hand")}
              >
                <Hand className="h-4 w-4" />
              </Button>
            </PaletteTooltip>

            <PaletteTooltip
              label="選択ツール"
              note="図形を選択・移動・削除"
              shortcutKey={(keyBindings["tool.select"] || "G").toUpperCase()}
            >
              <Button
                size="sm"
                variant={currentTool === "select" ? "default" : "ghost"}
                onClick={() => onToolChange("select")}
              >
                <MousePointer2 className="h-4 w-4" />
              </Button>
            </PaletteTooltip>

            <LineToolPopover
              currentTool={currentTool}
              onToolChange={onToolChange}
              strokeColor={line.color}
              strokeWidth={line.width}
              lineStyle={line.style}
              onStrokeColorChange={line.onColorChange}
              onStrokeWidthChange={line.onWidthChange}
              onLineStyleChange={line.onStyleChange}
              hasSelectedElement={selectedLines.length > 0}
              hasOtherTypeSelected={
                selectedRectangles.length > 0 ||
                selectedEllipses.length > 0 ||
                selectedTexts.length > 0
              }
              onClearSelection={onClearSelection}
              shortcutKey={keyBindings["tool.line"] || "L"}
            />

            <RectangleToolPopover
              currentTool={currentTool}
              onToolChange={onToolChange}
              strokeColor={rectangle.color}
              strokeWidth={rectangle.width}
              onStrokeColorChange={rectangle.onColorChange}
              onStrokeWidthChange={rectangle.onWidthChange}
              hasSelectedElement={selectedRectangles.length > 0}
              hasOtherTypeSelected={
                selectedLines.length > 0 ||
                selectedEllipses.length > 0 ||
                selectedTexts.length > 0
              }
              onClearSelection={onClearSelection}
              shortcutKey={keyBindings["tool.rectangle"] || "B"}
            />

            <EllipseToolPopover
              currentTool={currentTool}
              onToolChange={onToolChange}
              strokeColor={ellipse.color}
              strokeWidth={ellipse.width}
              onStrokeColorChange={ellipse.onColorChange}
              onStrokeWidthChange={ellipse.onWidthChange}
              hasSelectedElement={selectedEllipses.length > 0}
              hasOtherTypeSelected={
                selectedLines.length > 0 ||
                selectedRectangles.length > 0 ||
                selectedTexts.length > 0
              }
              onClearSelection={onClearSelection}
              shortcutKey={keyBindings["tool.ellipse"] || "Y"}
            />

            <TextToolPopover
              currentTool={currentTool}
              onToolChange={onToolChange}
              textColor={text.color}
              onTextColorChange={text.onColorChange}
              hasSelectedElement={selectedTexts.length > 0}
              hasOtherTypeSelected={
                selectedLines.length > 0 ||
                selectedRectangles.length > 0 ||
                selectedEllipses.length > 0
              }
              onClearSelection={onClearSelection}
              shortcutKey={keyBindings["tool.text"] || "T"}
            />

            {/* お気に入り登録ボタン（要素選択時のみ表示） */}
            {selectedElements.length > 0 && onToggleFavorite && (
              <>
                <Separator className="my-1" />
                <PaletteTooltip label="お気に入り">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      onToggleFavorite(
                        selectedElements.map((element) => element.id)
                      )
                    }
                  >
                    <Star
                      className={cn(
                        "h-4 w-4",
                        selectedElements.some((element) =>
                          favoriteElementIds?.has(element.id)
                        ) && "fill-yellow-400 text-yellow-400"
                      )}
                    />
                  </Button>
                </PaletteTooltip>
              </>
            )}
          </div>
        </Card>
      </div>
    </TooltipPrimitive.Provider>
  )
}
