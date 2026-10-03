"use client"

import { Bold, Italic, Minus, Plus, Underline } from "lucide-react"

import { TooltipButton } from "@/components/common/TooltipButton"
import { WithTooltip } from "@/components/common/WithTooltip"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

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
        <TooltipButton
          label="太字 (Ctrl+B)"
          size="sm"
          variant={isBold ? "default" : "ghost"}
          onClick={onBold}
        >
          <Bold className="h-4 w-4" />
        </TooltipButton>
        <TooltipButton
          label="斜体 (Ctrl+I)"
          size="sm"
          variant={isItalic ? "default" : "ghost"}
          onClick={onItalic}
        >
          <Italic className="h-4 w-4" />
        </TooltipButton>
        <TooltipButton
          label="下線 (Ctrl+U)"
          size="sm"
          variant={isUnderline ? "default" : "ghost"}
          onClick={onUnderline}
        >
          <Underline className="h-4 w-4" />
        </TooltipButton>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* フォントサイズ */}
      <div className="flex items-center gap-1">
        <TooltipButton
          label="フォントサイズを小さく"
          size="sm"
          variant="ghost"
          onClick={onFontSizeDecrease}
        >
          <Minus className="h-4 w-4" />
        </TooltipButton>
        <span className="min-w-8 text-center text-sm">{fontSize}</span>
        <TooltipButton
          label="フォントサイズを大きく"
          size="sm"
          variant="ghost"
          onClick={onFontSizeIncrease}
        >
          <Plus className="h-4 w-4" />
        </TooltipButton>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* 数式 */}
      <div className="flex items-center gap-1">
        <WithTooltip content="インライン数式 $...$">
          <Button
            size="sm"
            variant="ghost"
            onClick={onMathInline}
            className="text-xs"
          >
            $x$
          </Button>
        </WithTooltip>
        <WithTooltip content="ブロック数式 $$...$$">
          <Button
            size="sm"
            variant="ghost"
            onClick={onMathBlock}
            className="text-xs"
          >
            $$
          </Button>
        </WithTooltip>
      </div>
    </div>
  )
}
