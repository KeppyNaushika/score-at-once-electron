"use client"

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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ignoreDeselect } from "@/lib/toggleSelection"
import { LINE_STYLES, type LineStyle } from "@/types/drawingAnnotation.types"

import { COLOR_PALETTE } from "./constants/drawingConstants"
import { PaletteTooltip } from "./PaletteTooltip"
import type { CanvasTool } from "./types"

/** 線種の表示名（並びは正本 `LINE_STYLES` の順） */
const LINE_STYLE_LABELS: Record<LineStyle, string> = {
  solid: "直線",
  wave: "波線",
  zigzag: "折線",
  double: "二重線",
  arrow: "矢印 →",
  both_arrow: "両矢印 ↔",
}

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

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PaletteTooltip
        label="線ツール"
        note="Shift+ドラッグで鉛直・水平線"
        shortcutKey={shortcutKey?.toUpperCase()}
        open={isOpen ? false : undefined}
      >
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
      </PaletteTooltip>
      <PopoverContent className="w-64" side="right">
        <div className="space-y-3">
          <h4 className="text-sm font-medium">
            {hasSelectedElement ? "選択中の線を編集" : "線分ツール"}
          </h4>

          {/* 線種選択 */}
          <div onPointerDown={(e) => e.stopPropagation()}>
            <Label className="text-xs">線種</Label>
            {/* 採点画面はキーボード優先。Tab で1つずつ辿れる並びを保つため、矢印キーでの移動（roving focus）は切る */}
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              selectedTone="primary"
              rovingFocus={false}
              value={lineStyle}
              aria-label="線種"
              className="mt-1 grid w-full grid-cols-2 gap-1 data-[variant=outline]:shadow-none"
              onValueChange={ignoreDeselect(LINE_STYLES, onLineStyleChange)}
            >
              {LINE_STYLES.map((lineStyleValue) => (
                <ToggleGroupItem
                  key={lineStyleValue}
                  value={lineStyleValue}
                  onClick={(e) => e.stopPropagation()}
                  className="h-8 rounded-md text-xs data-[variant=outline]:border-l"
                >
                  {LINE_STYLE_LABELS[lineStyleValue]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
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
