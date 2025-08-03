"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { Circle } from "lucide-react"
import { useState } from "react"
import { COLOR_PALETTE } from "./constants/drawing-constants"
import type { DrawingTool } from "./types/answer-individual-types"

interface EllipseToolPopoverProps {
  currentTool: DrawingTool
  onToolChange: (tool: DrawingTool) => void
  strokeColor: string
  strokeWidth: number
  onStrokeColorChange: (color: string) => void
  onStrokeWidthChange: (width: number) => void
}

export function EllipseToolPopover({
  currentTool,
  onToolChange,
  strokeColor,
  strokeWidth,
  onStrokeColorChange,
  onStrokeWidthChange,
}: EllipseToolPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleClick = () => {
    if (currentTool === "ellipse") {
      // 既に選択されている場合はPopoverをトグル
      setIsOpen(!isOpen)
    } else {
      // 違うツールの場合はツールを選択
      onToolChange("ellipse")
      setIsOpen(false)
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant={currentTool === "ellipse" ? "default" : "ghost"}
          onClick={handleClick}
          title="楕円ツール - Shift+ドラッグで正円"
          style={{
            backgroundColor: currentTool === "ellipse" ? strokeColor : undefined,
            borderColor: currentTool === "ellipse" ? strokeColor : undefined,
          }}
        >
          <Circle
            className="h-4 w-4"
            style={{ color: currentTool === "ellipse" ? "white" : undefined }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" side="right">
        <div className="space-y-3">
          <h4 className="text-sm font-medium">楕円ツール</h4>

          {/* 線幅 */}
          <div>
            <Label className="text-xs">線幅: {strokeWidth}px</Label>
            <Slider
              min={1}
              max={10}
              step={1}
              value={[strokeWidth]}
              onValueChange={(value) => onStrokeWidthChange(value[0])}
              className="mt-2"
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
