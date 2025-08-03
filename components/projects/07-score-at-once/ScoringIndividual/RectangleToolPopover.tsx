"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { Square, RectangleHorizontal } from "lucide-react"
import { COLOR_PALETTE } from "./constants/drawing-constants"
import type { DrawingTool } from "./types/answer-individual-types"

interface RectangleToolPopoverProps {
  currentTool: DrawingTool
  onToolChange: (tool: DrawingTool) => void
  strokeColor: string
  strokeWidth: number
  onStrokeColorChange: (color: string) => void
  onStrokeWidthChange: (width: number) => void
}

export function RectangleToolPopover({
  currentTool,
  onToolChange,
  strokeColor,
  strokeWidth,
  onStrokeColorChange,
  onStrokeWidthChange,
}: RectangleToolPopoverProps) {
  const isActive = currentTool === "rectangle" || currentTool === "rectangle-horizontal"

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant={isActive ? "default" : "ghost"}
          title="長方形ツール - 四角形を描画"
        >
          <Square className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" side="right">
        <div className="space-y-3">
          <h4 className="text-sm font-medium">長方形の設定</h4>
          
          {/* 長方形タイプ選択 */}
          <div className="space-y-2">
            <Label className="text-xs">長方形タイプ</Label>
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant={currentTool === "rectangle" ? "default" : "outline"}
                onClick={() => onToolChange("rectangle")}
                className="flex-1"
                title="正方形・長方形 - 自由な四角形"
              >
                <Square className="h-3 w-3 mr-1" />
                四角形
              </Button>
              <Button
                size="sm"
                variant={currentTool === "rectangle-horizontal" ? "default" : "outline"}
                onClick={() => onToolChange("rectangle-horizontal")}
                className="flex-1"
                title="横長長方形 - 横向きの長方形"
              >
                <RectangleHorizontal className="h-3 w-3 mr-1" />
                横長
              </Button>
            </div>
          </div>

          {/* 線の太さ */}
          <div className="space-y-2">
            <Label className="text-xs">線の太さ: {strokeWidth}px</Label>
            <Slider
              value={[strokeWidth]}
              onValueChange={(value) => onStrokeWidthChange(value[0])}
              max={10}
              min={1}
              step={1}
            />
          </div>

          {/* 色選択 */}
          <div className="space-y-2">
            <Label className="text-xs">色</Label>
            <div className="grid grid-cols-4 gap-2">
              {COLOR_PALETTE.map((color) => (
                <Button
                  key={color}
                  size="sm"
                  variant="outline"
                  className="w-8 h-8 p-0"
                  style={{
                    backgroundColor: color,
                    borderColor: strokeColor === color ? "#000" : "#ccc",
                    borderWidth: strokeColor === color ? "2px" : "1px",
                  }}
                  onClick={() => onStrokeColorChange(color)}
                />
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}