"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Type } from "lucide-react"
import { useState } from "react"
import { COLOR_PALETTE } from "./constants/drawing-constants"
import type { DrawingTool } from "./types/answer-individual-types"

interface TextToolPopoverProps {
  currentTool: DrawingTool
  onToolChange: (tool: DrawingTool) => void
  textColor: string
  onTextColorChange: (color: string) => void
  hasSelectedElement?: boolean // 選択中のテキストがあるかどうか
  hasOtherTypeSelected?: boolean // 他のタイプの要素が選択されているか
  onClearSelection?: () => void
}

export function TextToolPopover({
  currentTool,
  onToolChange,
  textColor,
  onTextColorChange,
  hasSelectedElement = false,
  hasOtherTypeSelected = false,
  onClearSelection,
}: TextToolPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleClick = (e: React.MouseEvent) => {
    // イベント伝播を停止（キャンバスのクリックハンドラに伝播しないように）
    e.stopPropagation()

    // 他のタイプの要素が選択されている場合は選択を解除
    if (hasOtherTypeSelected && onClearSelection) {
      onClearSelection()
    }

    if (hasSelectedElement) {
      // 選択中のテキストがある場合はポップオーバーを開く
      setIsOpen(!isOpen)
    } else if (currentTool === "text") {
      // 既に選択されている場合はPopoverをトグル
      setIsOpen(!isOpen)
    } else {
      // 違うツールの場合はツールを選択
      onToolChange("text")
      setIsOpen(false)
    }
  }

  // ボタンがアクティブ状態かどうか
  const isActive = currentTool === "text" || hasSelectedElement

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant={isActive ? "default" : "ghost"}
          onClick={handleClick}
          title={hasSelectedElement ? "選択中のテキストを編集" : "テキストアンカー - クリックでテキスト配置"}
          style={{
            backgroundColor: isActive ? textColor : undefined,
            borderColor: isActive ? textColor : undefined,
          }}
        >
          <Type
            className="h-4 w-4"
            style={{ color: isActive ? "white" : undefined }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" side="right">
        <div className="space-y-3">
          <h4 className="text-sm font-medium">
            {hasSelectedElement ? "選択中のテキストを編集" : "テキストツール"}
          </h4>

          {/* カラーパレット */}
          <div>
            <Label className="text-xs">テキスト色</Label>
            <div className="mt-1 grid grid-cols-8 gap-1">
              {COLOR_PALETTE.map((color, index) => (
                <button
                  key={index}
                  onClick={() => onTextColorChange(color)}
                  className={`h-5 w-5 rounded border transition-transform hover:scale-110 ${
                    textColor === color
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
