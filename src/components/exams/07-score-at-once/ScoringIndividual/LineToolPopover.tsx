"use client"

import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { Ruler } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

import { COLOR_PALETTE } from "./constants/drawingConstants"
import type { CanvasTool } from "./types"

interface LineToolPopoverProps {
  currentTool: CanvasTool
  onToolChange: (tool: CanvasTool) => void
  strokeColor: string
  strokeWidth: number
  lineStyle: string
  onStrokeColorChange: (color: string) => void
  onStrokeWidthChange: (width: number) => void
  onLineStyleChange: (style: string) => void
  hasSelectedElement?: boolean // 選択中の線があるかどうか
  hasOtherTypeSelected?: boolean // 他のタイプの要素が選択されているか
  onClearSelection?: () => void
  shortcutKey?: string
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
  hasSelectedElement = false,
  hasOtherTypeSelected = false,
  onClearSelection,
  shortcutKey,
}: LineToolPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)

  // 線が選択されている場合はポップオーバーを開く
  const handleClick = (e: React.MouseEvent) => {
    // イベント伝播を停止（キャンバスのクリックハンドラに伝播しないように）
    e.stopPropagation()

    // このタイプの要素が選択されていない場合のみ選択を解除
    if (!hasSelectedElement && hasOtherTypeSelected && onClearSelection) {
      onClearSelection()
    }

    if (hasSelectedElement) {
      // 選択中の線がある場合はポップオーバーを開く
      setIsOpen(!isOpen)
    } else if (currentTool === "line") {
      // 既に選択されている場合はPopoverをトグル
      setIsOpen(!isOpen)
    } else {
      // 違うツールの場合はツールを選択
      onToolChange("line")
      setIsOpen(false)
    }
  }

  // ボタンがアクティブ状態かどうか（線ツール選択中 または 線を選択中）
  const isActive = currentTool === "line" || hasSelectedElement

  const tooltipContentClass = cn(
    "bg-primary text-primary-foreground animate-in fade-in-0 zoom-in-95",
    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
    "data-[side=right]:slide-in-from-left-2",
    "z-50 w-fit rounded-md px-3 py-1.5 text-xs"
  )

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <TooltipPrimitive.Root open={isOpen ? false : undefined}>
        <TooltipPrimitive.Trigger asChild>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant={isActive ? "default" : "ghost"}
              onClick={handleClick}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                backgroundColor: isActive ? strokeColor : undefined,
                borderColor: isActive ? strokeColor : undefined,
              }}
            >
              <Ruler
                className="h-4 w-4"
                style={{ color: isActive ? "white" : undefined }}
              />
            </Button>
          </PopoverTrigger>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side="right"
            sideOffset={5}
            className={tooltipContentClass}
          >
            <div className="text-center">
              <div className="font-medium">線ツール</div>
              <div className="text-xs text-gray-400">
                Shift+ドラッグで鉛直・水平線
              </div>
              {shortcutKey && (
                <div className="mt-1 text-xs text-gray-400">
                  キー:{" "}
                  <kbd className="rounded bg-gray-200 px-1 py-0.5 text-xs text-gray-800">
                    {shortcutKey.toUpperCase()}
                  </kbd>
                </div>
              )}
            </div>
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
      <PopoverContent className="w-64" side="right">
        <div className="space-y-3">
          <h4 className="text-sm font-medium">
            {hasSelectedElement ? "選択中の線を編集" : "線分ツール"}
          </h4>

          {/* 線種選択 */}
          <div onPointerDown={(e) => e.stopPropagation()}>
            <Label className="text-xs">線種</Label>
            <div className="mt-1 grid grid-cols-2 gap-1">
              <Button
                size="sm"
                variant={lineStyle === "solid" ? "default" : "outline"}
                onClick={(e) => {
                  e.stopPropagation()
                  onLineStyleChange("solid")
                }}
                className="h-8 text-xs"
              >
                直線
              </Button>
              <Button
                size="sm"
                variant={lineStyle === "wave" ? "default" : "outline"}
                onClick={(e) => {
                  e.stopPropagation()
                  onLineStyleChange("wave")
                }}
                className="h-8 text-xs"
              >
                波線
              </Button>
              <Button
                size="sm"
                variant={lineStyle === "zigzag" ? "default" : "outline"}
                onClick={(e) => {
                  e.stopPropagation()
                  onLineStyleChange("zigzag")
                }}
                className="h-8 text-xs"
              >
                折線
              </Button>
              <Button
                size="sm"
                variant={lineStyle === "double" ? "default" : "outline"}
                onClick={(e) => {
                  e.stopPropagation()
                  onLineStyleChange("double")
                }}
                className="h-8 text-xs"
              >
                二重線
              </Button>
              <Button
                size="sm"
                variant={lineStyle === "arrow" ? "default" : "outline"}
                onClick={(e) => {
                  e.stopPropagation()
                  onLineStyleChange("arrow")
                }}
                className="h-8 text-xs"
              >
                矢印 →
              </Button>
              <Button
                size="sm"
                variant={lineStyle === "both_arrow" ? "default" : "outline"}
                onClick={(e) => {
                  e.stopPropagation()
                  onLineStyleChange("both_arrow")
                }}
                className="h-8 text-xs"
              >
                両矢印 ↔
              </Button>
            </div>
          </div>

          {/* 線幅 */}
          <div onPointerDown={(e) => e.stopPropagation()}>
            <Label className="text-xs">線幅: {strokeWidth}mm</Label>
            <Slider
              min={0.1}
              max={5.0}
              step={0.1}
              value={[strokeWidth]}
              onValueChange={(value) =>
                onStrokeWidthChange(Math.round(value[0] * 10) / 10)
              }
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
