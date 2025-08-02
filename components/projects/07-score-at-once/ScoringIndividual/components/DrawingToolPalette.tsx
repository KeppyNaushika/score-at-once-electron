"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Crop,
  Hand,
  Maximize,
  MousePointer2,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import type {
  DrawingTool,
  QuestionRegion,
} from "../types/answer-individual-types"
import { LineToolPopover } from "./LineToolPopover"
import { TextToolPopover } from "./TextToolPopover"

interface DrawingToolPaletteProps {
  // View controls
  onZoomIn: () => void
  onZoomOut: () => void
  onMaximizeView: () => void
  onCropView: () => void
  currentQuestion?: QuestionRegion

  // Tool selection
  currentTool: DrawingTool
  onToolChange: (tool: DrawingTool) => void

  // Drawing settings
  strokeColor: string
  strokeWidth: number
  lineStyle: string
  onStrokeColorChange: (color: string) => void
  onStrokeWidthChange: (width: number) => void
  onLineStyleChange: (style: string) => void
}

export function DrawingToolPalette({
  onZoomIn,
  onZoomOut,
  onMaximizeView,
  onCropView,
  currentQuestion,
  currentTool,
  onToolChange,
  strokeColor,
  strokeWidth,
  lineStyle,
  onStrokeColorChange,
  onStrokeWidthChange,
  onLineStyleChange,
}: DrawingToolPaletteProps) {
  return (
    <div className="absolute top-4 left-4">
      <Card className="p-2">
        <div className="flex flex-col space-y-1">
          {/* ズーム・ビュー操作 */}
          <Button size="sm" variant="ghost" onClick={onZoomIn} title="拡大 (+)">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onZoomOut}
            title="縮小 (-)"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onMaximizeView}
            title="全体表示 - ページ全体をフィット"
          >
            <Maximize className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onCropView}
            title="設問表示 - 設問領域をフィット"
            disabled={!currentQuestion}
          >
            <Crop className="h-4 w-4" />
          </Button>

          {/* セパレーター */}
          <Separator className="my-1" />

          {/* ツール選択 */}
          <LineToolPopover
            currentTool={currentTool}
            onToolChange={onToolChange}
            strokeColor={strokeColor}
            strokeWidth={strokeWidth}
            lineStyle={lineStyle}
            onStrokeColorChange={onStrokeColorChange}
            onStrokeWidthChange={onStrokeWidthChange}
            onLineStyleChange={onLineStyleChange}
          />

          <TextToolPopover
            currentTool={currentTool}
            onToolChange={onToolChange}
            strokeColor={strokeColor}
            onStrokeColorChange={onStrokeColorChange}
          />

          <Button
            size="sm"
            variant={currentTool === "select" ? "default" : "ghost"}
            onClick={() => onToolChange("select")}
            title="選択ツール - 図形を選択・移動・削除"
          >
            <MousePointer2 className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={currentTool === "hand" ? "default" : "ghost"}
            onClick={() => onToolChange("hand")}
            title="ハンドツール - ドラッグで移動"
          >
            <Hand className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  )
}
