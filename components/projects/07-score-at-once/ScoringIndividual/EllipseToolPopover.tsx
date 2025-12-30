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
import { COLOR_PALETTE } from "./constants/drawingConstants"
import type { DrawingTool } from "./types/answerIndividualTypes"

interface EllipseToolPopoverProps {
  currentTool: DrawingTool
  onToolChange: (tool: DrawingTool) => void
  strokeColor: string
  strokeWidth: number
  onStrokeColorChange: (color: string) => void
  onStrokeWidthChange: (width: number) => void
  hasSelectedElement?: boolean // 選択中の楕円があるかどうか
  hasOtherTypeSelected?: boolean // 他のタイプの要素が選択されているか
  onClearSelection?: () => void
}

export function EllipseToolPopover({
  currentTool,
  onToolChange,
  strokeColor,
  strokeWidth,
  onStrokeColorChange,
  onStrokeWidthChange,
  hasSelectedElement = false,
  hasOtherTypeSelected = false,
  onClearSelection,
}: EllipseToolPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleClick = (e: React.MouseEvent) => {
    // イベント伝播を停止（キャンバスのクリックハンドラに伝播しないように）
    e.stopPropagation()

    // このタイプの要素が選択されていない場合のみ選択を解除
    if (!hasSelectedElement && hasOtherTypeSelected && onClearSelection) {
      onClearSelection()
    }

    if (hasSelectedElement) {
      // 選択中の楕円がある場合はポップオーバーを開く
      setIsOpen(!isOpen)
    } else if (currentTool === "ellipse") {
      // 既に選択されている場合はPopoverをトグル
      setIsOpen(!isOpen)
    } else {
      // 違うツールの場合はツールを選択
      onToolChange("ellipse")
      setIsOpen(false)
    }
  }

  // ボタンがアクティブ状態かどうか
  const isActive = currentTool === "ellipse" || hasSelectedElement

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant={isActive ? "default" : "ghost"}
          onClick={handleClick}
          onPointerDown={(e) => e.stopPropagation()}
          title={
            hasSelectedElement
              ? "選択中の楕円を編集"
              : "楕円ツール - Shift+ドラッグで正円"
          }
          style={{
            backgroundColor: isActive ? strokeColor : undefined,
            borderColor: isActive ? strokeColor : undefined,
          }}
        >
          <Circle
            className="h-4 w-4"
            style={{ color: isActive ? "white" : undefined }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" side="right">
        <div className="space-y-3">
          <h4 className="text-sm font-medium">
            {hasSelectedElement ? "選択中の楕円を編集" : "楕円ツール"}
          </h4>

          {/* 線幅 */}
          <div onPointerDown={(e) => e.stopPropagation()}>
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
                  onClick={(e) => {
                    e.stopPropagation()
                    onStrokeColorChange(color)
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
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
