"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { Ruler } from "lucide-react"
import { COLOR_PALETTE } from "../constants/drawing-constants"
import type { DrawingTool } from "../types/answer-display-types"

interface LineToolPopoverProps {
  currentTool: DrawingTool
  onToolChange: (tool: DrawingTool) => void
  strokeColor: string
  strokeWidth: number
  lineStyle: string
  onStrokeColorChange: (color: string) => void
  onStrokeWidthChange: (width: number) => void
  onLineStyleChange: (style: string) => void
}

export function LineToolPopover({
  currentTool,
  onToolChange,
  strokeColor,
  strokeWidth,
  lineStyle,
  onStrokeColorChange,
  onStrokeWidthChange,
  onLineStyleChange,
}: LineToolPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant={currentTool === "line" ? "default" : "ghost"}
          onClick={() => onToolChange("line")}
          title="自由線ツール - Shift+ドラッグで鉛直・水平線"
        >
          <Ruler className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" side="right">
        <div className="space-y-3">
          <h4 className="text-sm font-medium">線の設定</h4>

          {/* 線種選択 */}
          <div>
            <Label className="text-xs">線種</Label>
            <div className="mt-1 grid grid-cols-2 gap-1">
              <Button
                size="sm"
                variant={lineStyle === "solid" ? "default" : "outline"}
                onClick={() => onLineStyleChange("solid")}
                className="h-8 text-xs"
              >
                直線
              </Button>
              <Button
                size="sm"
                variant={lineStyle === "wave" ? "default" : "outline"}
                onClick={() => onLineStyleChange("wave")}
                className="h-8 text-xs"
              >
                波線
              </Button>
              <Button
                size="sm"
                variant={lineStyle === "zigzag" ? "default" : "outline"}
                onClick={() => onLineStyleChange("zigzag")}
                className="h-8 text-xs"
              >
                折線
              </Button>
              <Button
                size="sm"
                variant={lineStyle === "double" ? "default" : "outline"}
                onClick={() => onLineStyleChange("double")}
                className="h-8 text-xs"
              >
                二重線
              </Button>
            </div>
          </div>

          {/* 線幅 */}
          <div>
            <Label className="text-xs">線幅: {strokeWidth}px</Label>
            <Slider
              min={1}
              max={10}
              step={1}
              value={[strokeWidth]}
              onValueChange={(value) => onStrokeWidthChange(value[0])}
              className="mt-1"
            />
          </div>

          {/* カラーパレット */}
          <div>
            <Label className="text-xs">色</Label>
            <div className="mt-1 grid grid-cols-8 gap-1">
              {COLOR_PALETTE.map((color, index) => (
                <button
                  key={index}
                  onClick={() => onStrokeColorChange(color)}
                  className={`h-5 w-5 rounded border transition-transform hover:scale-110 ${
                    strokeColor === color
                      ? "border-2 border-gray-800"
                      : "border-gray-300"
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
