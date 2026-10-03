"use client"

import { Bold, Italic, Minus, Plus, Underline } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

import { ToolbarTooltip } from "./ToolbarTooltip"

/** 文字の窓の書式ツールバー（太字・斜体・下線・文字サイズ・数式） */
export function RichTextFormatToolbar({
  isBold,
  isItalic,
  isUnderline,
  fontSize,
  onBold,
  onItalic,
  onUnderline,
  onFontSizeDecrease,
  onFontSizeIncrease,
  onMathInline,
  onMathBlock,
}: {
  isBold: boolean
  isItalic: boolean
  isUnderline: boolean
  fontSize: number
  onBold: () => void
  onItalic: () => void
  onUnderline: () => void
  onFontSizeDecrease: () => void
  onFontSizeIncrease: () => void
  onMathInline: () => void
  onMathBlock: () => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-gray-50 p-2">
      {/* 基本書式 */}
      <div className="flex items-center gap-1">
        <ToolbarTooltip label="太字 (Ctrl+B)">
          <Button
            size="sm"
            variant={isBold ? "default" : "ghost"}
            onClick={onBold}
            aria-label="太字 (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </Button>
        </ToolbarTooltip>
        <ToolbarTooltip label="斜体 (Ctrl+I)">
          <Button
            size="sm"
            variant={isItalic ? "default" : "ghost"}
            onClick={onItalic}
            aria-label="斜体 (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </Button>
        </ToolbarTooltip>
        <ToolbarTooltip label="下線 (Ctrl+U)">
          <Button
            size="sm"
            variant={isUnderline ? "default" : "ghost"}
            onClick={onUnderline}
            aria-label="下線 (Ctrl+U)"
          >
            <Underline className="h-4 w-4" />
          </Button>
        </ToolbarTooltip>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* フォントサイズ */}
      <div className="flex items-center gap-1">
        <ToolbarTooltip label="フォントサイズを小さく">
          <Button
            size="sm"
            variant="ghost"
            onClick={onFontSizeDecrease}
            aria-label="フォントサイズを小さく"
          >
            <Minus className="h-4 w-4" />
          </Button>
        </ToolbarTooltip>
        <span className="min-w-8 text-center text-sm">{fontSize}</span>
        <ToolbarTooltip label="フォントサイズを大きく">
          <Button
            size="sm"
            variant="ghost"
            onClick={onFontSizeIncrease}
            aria-label="フォントサイズを大きく"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </ToolbarTooltip>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* 数式 */}
      <div className="flex items-center gap-1">
        <ToolbarTooltip label="インライン数式 $...$">
          <Button
            size="sm"
            variant="ghost"
            onClick={onMathInline}
            className="text-xs"
          >
            $x$
          </Button>
        </ToolbarTooltip>
        <ToolbarTooltip label="ブロック数式 $$...$$">
          <Button
            size="sm"
            variant="ghost"
            onClick={onMathBlock}
            className="text-xs"
          >
            $$
          </Button>
        </ToolbarTooltip>
      </div>
    </div>
  )
}
