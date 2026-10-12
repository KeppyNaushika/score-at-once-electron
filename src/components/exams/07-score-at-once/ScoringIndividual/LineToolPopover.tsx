"use client"

import { Slash } from "lucide-react"

import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ignoreDeselect } from "@/lib/toggleSelection"
import { LINE_STYLES, type LineStyle } from "@/types/drawingAnnotation.types"

import { ColorPaletteGrid } from "./ColorPaletteGrid"
import { DrawingToolPopover } from "./DrawingToolPopover"
import { StrokeWidthSlider } from "./StrokeWidthSlider"
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
  hasSelectedElement,
  hasOtherTypeSelected,
  onClearSelection,
  shortcutKey,
}: LineToolPopoverProps) {
  return (
    <DrawingToolPopover
      tool="line"
      currentTool={currentTool}
      onToolChange={onToolChange}
      icon={Slash}
      tooltipLabel="直線ツール"
      tooltipNote="Shift+ドラッグで鉛直・水平線"
      toolHeading="直線ツール"
      selectedHeading="選択中の線を編集"
      activeColor={strokeColor}
      hasSelectedElement={hasSelectedElement}
      hasOtherTypeSelected={hasOtherTypeSelected}
      onClearSelection={onClearSelection}
      shortcutKey={shortcutKey}
    >
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

      <StrokeWidthSlider
        strokeWidth={strokeWidth}
        onStrokeWidthChange={onStrokeWidthChange}
      />
      <ColorPaletteGrid
        label="色"
        selectedColor={strokeColor}
        onColorChange={onStrokeColorChange}
      />
    </DrawingToolPopover>
  )
}
