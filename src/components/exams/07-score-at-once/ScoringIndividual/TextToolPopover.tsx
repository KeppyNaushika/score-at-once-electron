"use client"

import { Type } from "lucide-react"

import { ColorPaletteGrid } from "./ColorPaletteGrid"
import { DrawingToolPopover } from "./DrawingToolPopover"
import type { CanvasTool } from "./types"

interface TextToolPopoverProps {
  currentTool: CanvasTool
  onToolChange: (tool: CanvasTool) => void
  textColor: string
  onTextColorChange: (color: string) => void
  hasSelectedElement?: boolean // 選択中のテキストがあるかどうか
  hasOtherTypeSelected?: boolean // 他のタイプの要素が選択されているか
  onClearSelection?: () => void
  shortcutKey?: string
}

export function TextToolPopover({
  currentTool,
  onToolChange,
  textColor,
  onTextColorChange,
  hasSelectedElement,
  hasOtherTypeSelected,
  onClearSelection,
  shortcutKey,
}: TextToolPopoverProps) {
  return (
    <DrawingToolPopover
      tool="text"
      currentTool={currentTool}
      onToolChange={onToolChange}
      icon={Type}
      tooltipLabel="テキストツール"
      tooltipNote="クリックでテキスト配置"
      toolHeading="テキストツール"
      selectedHeading="選択中のテキストを編集"
      activeColor={textColor}
      hasSelectedElement={hasSelectedElement}
      hasOtherTypeSelected={hasOtherTypeSelected}
      onClearSelection={onClearSelection}
      shortcutKey={shortcutKey}
    >
      <ColorPaletteGrid
        label="テキスト色"
        selectedColor={textColor}
        onColorChange={onTextColorChange}
      />
    </DrawingToolPopover>
  )
}
