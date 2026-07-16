"use client"

import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { Type } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

import { COLOR_PALETTE } from "./constants/drawingConstants"
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
  hasSelectedElement = false,
  hasOtherTypeSelected = false,
  onClearSelection,
  shortcutKey,
}: TextToolPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleClick = (e: React.MouseEvent) => {
    // イベント伝播を停止（キャンバスのクリックハンドラに伝播しないように）
    e.stopPropagation()

    // このタイプの要素が選択されていない場合のみ選択を解除
    if (!hasSelectedElement && hasOtherTypeSelected && onClearSelection) {
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
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side="right"
            sideOffset={5}
            className={tooltipContentClass}
          >
            <div className="text-center">
              <div className="font-medium">テキストツール</div>
              <div className="text-xs text-gray-400">
                クリックでテキスト配置
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
            {hasSelectedElement ? "選択中のテキストを編集" : "テキストツール"}
          </h4>

          {/* カラーパレット */}
          <div>
            <Label className="text-xs">テキスト色</Label>
            <div className="mt-1 grid grid-cols-8 gap-1">
              {COLOR_PALETTE.map((color, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation()
                    onTextColorChange(color)
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
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
