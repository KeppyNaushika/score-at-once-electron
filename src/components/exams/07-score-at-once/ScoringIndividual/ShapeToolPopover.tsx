"use client"

import { Circle, type LucideIcon, RectangleHorizontal } from "lucide-react"

import { ColorPaletteGrid } from "./ColorPaletteGrid"
import { DrawingToolPopover } from "./DrawingToolPopover"
import { StrokeWidthSlider } from "./StrokeWidthSlider"
import type { CanvasTool } from "./types"

type ShapeTool = Extract<CanvasTool, "rectangle" | "ellipse">

/** 図形ごとに違うのは表示だけ（操作・既定値は共通） */
const SHAPE_TOOL_DISPLAY: Record<
  ShapeTool,
  {
    icon: LucideIcon
    tooltipLabel: string
    tooltipNote: string
    toolHeading: string
    selectedHeading: string
  }
> = {
  rectangle: {
    icon: RectangleHorizontal,
    tooltipLabel: "長方形ツール",
    tooltipNote: "Shift+ドラッグで正方形",
    toolHeading: "長方形ツール",
    selectedHeading: "選択中の長方形を編集",
  },
  ellipse: {
    icon: Circle,
    tooltipLabel: "楕円ツール",
    tooltipNote: "Shift+ドラッグで正円",
    toolHeading: "楕円ツール",
    selectedHeading: "選択中の楕円を編集",
  },
}

interface ShapeToolPopoverProps {
  shape: ShapeTool
  currentTool: CanvasTool
  onToolChange: (tool: CanvasTool) => void
  strokeColor: string
  strokeWidth: number
  onStrokeColorChange: (color: string) => void
  onStrokeWidthChange: (width: number) => void
  hasSelectedElement?: boolean // 選択中のこの図形があるかどうか
  hasOtherTypeSelected?: boolean // 他のタイプの要素が選択されているか
  onClearSelection?: () => void
  shortcutKey?: string
}

/**
 * 矩形・楕円ツールのボタンと設定 Popover（線幅・色）
 */
export function ShapeToolPopover({
  shape,
  currentTool,
  onToolChange,
  strokeColor,
  strokeWidth,
  onStrokeColorChange,
  onStrokeWidthChange,
  hasSelectedElement,
  hasOtherTypeSelected,
  onClearSelection,
  shortcutKey,
}: ShapeToolPopoverProps) {
  const shapeDisplay = SHAPE_TOOL_DISPLAY[shape]

  return (
    <DrawingToolPopover
      tool={shape}
      currentTool={currentTool}
      onToolChange={onToolChange}
      icon={shapeDisplay.icon}
      tooltipLabel={shapeDisplay.tooltipLabel}
      tooltipNote={shapeDisplay.tooltipNote}
      toolHeading={shapeDisplay.toolHeading}
      selectedHeading={shapeDisplay.selectedHeading}
      activeColor={strokeColor}
      hasSelectedElement={hasSelectedElement}
      hasOtherTypeSelected={hasOtherTypeSelected}
      onClearSelection={onClearSelection}
      shortcutKey={shortcutKey}
    >
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
