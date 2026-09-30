"use client"

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  Bold,
  Italic,
  Minus,
  Plus,
  Underline,
  UnfoldVertical,
} from "lucide-react"
import React, { useCallback, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
// テキストボックスCanvas機能をインポート
import type { TextBox } from "@/lib/textbox-canvas/types"
import type { AnchorDirection } from "@/types/drawingAnnotation.types"

import { COLOR_PALETTE } from "./constants/drawingConstants"
import { EnhancedCanvasPreview } from "./EnhancedCanvasPreview"

interface RichTextEditorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string
  onValueChange: (value: string) => void
  color: string
  onColorChange: (color: string) => void
  onSubmit: () => void
  onCancel: () => void
  title?: string
  // 座標情報（個別採点画面の0-1座標系）
  position?: { x: number; y: number } // 0.0-1.0
  canvasWidth?: number
  canvasHeight?: number
  // 答案画像背景表示用
  backgroundImageUrl?: string
  // フォントサイズとアンカー方向
  fontSize?: number
  onFontSizeChange?: (size: number) => void
  anchorDirection?: AnchorDirection
  onAnchorDirectionChange?: (direction: AnchorDirection) => void
}

export function RichTextEditorModal({
  open,
  onOpenChange,
  value,
  onValueChange,
  color,
  onColorChange,
  onSubmit,
  onCancel,
  title = "テキスト編集",
  position = { x: 0.5, y: 0.5 },
  canvasWidth = 800,
  canvasHeight = 600,
  backgroundImageUrl,
  // 文字サイズとアンカー方向は親が保持する制御プロパティ。ローカルに複製しない
  fontSize = 5,
  onFontSizeChange,
  anchorDirection = "top-left",
  onAnchorDirectionChange,
}: RichTextEditorModalProps) {
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isUnderline, setIsUnderline] = useState(false)

  const setFontSize = useCallback(
    (size: number) => {
      onFontSizeChange?.(size)
    },
    [onFontSizeChange]
  )

  const setAnchorDirection = useCallback(
    (direction: AnchorDirection) => {
      onAnchorDirectionChange?.(direction)
    },
    [onAnchorDirectionChange]
  )

  // 背景画像表示設定
  const [showBackground, setShowBackground] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // プレビュー用のTextBoxオブジェクトを作成
  const previewTextBox: TextBox = {
    id: "preview",
    x: position.x * canvasWidth, // 相対座標を絶対座標に変換
    y: position.y * canvasHeight,
    text: value,
    isSelected: true,
    anchorDirection: anchorDirection,
    textSize: fontSize,
    coordinateSystem: "absolute",
  }

  // テキスト装飾の挿入
  const insertFormatting = useCallback(
    (prefix: string, suffix: string = "") => {
      const textarea = textareaRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const selectedText = value.substring(start, end)

      let newText =
        value.substring(0, start) +
        prefix +
        selectedText +
        suffix +
        value.substring(end)
      onValueChange(newText)

      // カーソル位置を調整
      setTimeout(() => {
        if (selectedText) {
          textarea.setSelectionRange(start + prefix.length, end + prefix.length)
        } else {
          textarea.setSelectionRange(
            start + prefix.length,
            start + prefix.length
          )
        }
        textarea.focus()
      }, 0)
    },
    [value, onValueChange]
  )

  // 書式設定ボタンのハンドラー
  const handleBold = useCallback(() => {
    insertFormatting("**", "**")
    setIsBold(true)
    setTimeout(() => setIsBold(false), 200)
  }, [insertFormatting])

  const handleItalic = useCallback(() => {
    insertFormatting("*", "*")
    setIsItalic(true)
    setTimeout(() => setIsItalic(false), 200)
  }, [insertFormatting])

  const handleUnderline = useCallback(() => {
    insertFormatting("__", "__")
    setIsUnderline(true)
    setTimeout(() => setIsUnderline(false), 200)
  }, [insertFormatting])

  // MathJax記法の挿入
  const handleMathInline = useCallback(() => {
    insertFormatting("$", "$")
  }, [insertFormatting])

  const handleMathBlock = useCallback(() => {
    insertFormatting("$$\n", "\n$$")
  }, [insertFormatting])

  // フォントサイズ調整 (mm単位)
  const handleFontSizeIncrease = useCallback(() => {
    setFontSize(Math.min(fontSize + 1, 20))
  }, [fontSize, setFontSize])

  const handleFontSizeDecrease = useCallback(() => {
    setFontSize(Math.max(fontSize - 1, 2))
  }, [fontSize, setFontSize])

  // アンカー方向の取得関数
  const getHorizontalAlign = (direction: AnchorDirection) => {
    if (direction.includes("left")) return "left"
    if (direction.includes("right")) return "right"
    return "center"
  }

  const getVerticalAlign = (direction: AnchorDirection) => {
    if (direction.includes("top")) return "top"
    if (direction.includes("bottom")) return "bottom"
    return "center"
  }

  // アンカー方向設定
  const setHorizontalAlign = useCallback(
    (align: "left" | "center" | "right") => {
      const vertical = getVerticalAlign(anchorDirection)
      let newDirection: AnchorDirection

      if (vertical === "center" && align === "center") {
        newDirection = "center"
      } else if (vertical === "center") {
        newDirection = align as AnchorDirection
      } else if (align === "center") {
        newDirection = vertical as AnchorDirection
      } else {
        newDirection = `${vertical}-${align}` as AnchorDirection
      }

      setAnchorDirection(newDirection)
    },
    [anchorDirection, setAnchorDirection]
  )

  const setVerticalAlign = useCallback(
    (align: "top" | "center" | "bottom") => {
      const horizontal = getHorizontalAlign(anchorDirection)
      let newDirection: AnchorDirection

      if (align === "center" && horizontal === "center") {
        newDirection = "center"
      } else if (align === "center") {
        newDirection = horizontal as AnchorDirection
      } else if (horizontal === "center") {
        newDirection = align as AnchorDirection
      } else {
        newDirection = `${align}-${horizontal}` as AnchorDirection
      }

      setAnchorDirection(newDirection)
    },
    [anchorDirection, setAnchorDirection]
  )

  // キーボードショートカット
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "b":
            e.preventDefault()
            handleBold()
            break
          case "i":
            e.preventDefault()
            handleItalic()
            break
          case "u":
            e.preventDefault()
            handleUnderline()
            break
          case "Enter":
            e.preventDefault()
            onSubmit()
            break
        }
      }
    },
    [handleBold, handleItalic, handleUnderline, onSubmit]
  )

  // Esc は窓のどこにフォーカスがあっても1回で閉じる。Radix に任せると、
  // Tooltip が開いているあいだは Tooltip が一番上の層として Esc を取り、
  // 窓は閉じない（最初の Esc が Tooltip を閉じるだけになる）。
  // 変換中の Esc は変換の取り消しなので閉じない。
  const handleDialogKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && !e.nativeEvent.isComposing) {
        onCancel()
      }
    },
    [onCancel]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto"
        // 開いてすぐ文字を打てるように入力欄へ。既定の「最初のボタン」へ
        // フォーカスが行くと、そのボタンの Tooltip が開くたびに出てしまう
        onOpenAutoFocus={(e) => {
          const textarea = textareaRef.current
          if (!textarea) return
          e.preventDefault()
          textarea.focus()
        }}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onKeyDown={handleDialogKeyDown}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 書式設定ツールバー */}
          <div className="flex items-center gap-2 rounded-md border bg-gray-50 p-2">
            {/* 基本書式 */}
            <div className="flex items-center gap-1">
              <ToolbarTooltip label="太字 (Ctrl+B)">
                <Button
                  size="sm"
                  variant={isBold ? "default" : "ghost"}
                  onClick={handleBold}
                  aria-label="太字 (Ctrl+B)"
                >
                  <Bold className="h-4 w-4" />
                </Button>
              </ToolbarTooltip>
              <ToolbarTooltip label="斜体 (Ctrl+I)">
                <Button
                  size="sm"
                  variant={isItalic ? "default" : "ghost"}
                  onClick={handleItalic}
                  aria-label="斜体 (Ctrl+I)"
                >
                  <Italic className="h-4 w-4" />
                </Button>
              </ToolbarTooltip>
              <ToolbarTooltip label="下線 (Ctrl+U)">
                <Button
                  size="sm"
                  variant={isUnderline ? "default" : "ghost"}
                  onClick={handleUnderline}
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
                  onClick={handleFontSizeDecrease}
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
                  onClick={handleFontSizeIncrease}
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
                  onClick={handleMathInline}
                  className="text-xs"
                >
                  $x$
                </Button>
              </ToolbarTooltip>
              <ToolbarTooltip label="ブロック数式 $$...$$">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleMathBlock}
                  className="text-xs"
                >
                  $$
                </Button>
              </ToolbarTooltip>
            </div>
          </div>

          {/* アンカー位置設定 (Lucideアイコン使用) */}
          <div>
            <Label className="text-sm font-medium">アンカー位置</Label>
            <div className="mt-2 flex items-center gap-4">
              {/* 横方向 */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">横:</span>
                <ToolbarTooltip label="左寄せ">
                  <Button
                    size="sm"
                    variant={
                      getHorizontalAlign(anchorDirection) === "left"
                        ? "default"
                        : "ghost"
                    }
                    onClick={() => setHorizontalAlign("left")}
                    aria-label="左寄せ"
                  >
                    <AlignLeft className="h-4 w-4" />
                  </Button>
                </ToolbarTooltip>
                <ToolbarTooltip label="左右中央寄せ">
                  <Button
                    size="sm"
                    variant={
                      getHorizontalAlign(anchorDirection) === "center"
                        ? "default"
                        : "ghost"
                    }
                    onClick={() => setHorizontalAlign("center")}
                    aria-label="左右中央寄せ"
                  >
                    <AlignCenter className="h-4 w-4" />
                  </Button>
                </ToolbarTooltip>
                <ToolbarTooltip label="右寄せ">
                  <Button
                    size="sm"
                    variant={
                      getHorizontalAlign(anchorDirection) === "right"
                        ? "default"
                        : "ghost"
                    }
                    onClick={() => setHorizontalAlign("right")}
                    aria-label="右寄せ"
                  >
                    <AlignRight className="h-4 w-4" />
                  </Button>
                </ToolbarTooltip>
              </div>

              {/* 縦方向 */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">縦:</span>
                <ToolbarTooltip label="上寄せ">
                  <Button
                    size="sm"
                    variant={
                      getVerticalAlign(anchorDirection) === "top"
                        ? "default"
                        : "ghost"
                    }
                    onClick={() => setVerticalAlign("top")}
                    aria-label="上寄せ"
                  >
                    <ArrowUpToLine className="h-4 w-4" />
                  </Button>
                </ToolbarTooltip>
                <ToolbarTooltip label="上下中央寄せ">
                  <Button
                    size="sm"
                    variant={
                      getVerticalAlign(anchorDirection) === "center"
                        ? "default"
                        : "ghost"
                    }
                    onClick={() => setVerticalAlign("center")}
                    aria-label="上下中央寄せ"
                  >
                    <UnfoldVertical className="h-4 w-4" />
                  </Button>
                </ToolbarTooltip>
                <ToolbarTooltip label="下寄せ">
                  <Button
                    size="sm"
                    variant={
                      getVerticalAlign(anchorDirection) === "bottom"
                        ? "default"
                        : "ghost"
                    }
                    onClick={() => setVerticalAlign("bottom")}
                    aria-label="下寄せ"
                  >
                    <ArrowDownToLine className="h-4 w-4" />
                  </Button>
                </ToolbarTooltip>
              </div>

              {/* 現在の設定表示 */}
              <div className="text-xs text-gray-500">
                現在: {anchorDirection}
              </div>
            </div>
          </div>

          {/* カラーパレット */}
          <div>
            <Label className="text-sm font-medium">テキスト色</Label>
            <div className="mt-2 grid grid-cols-8 gap-2">
              {COLOR_PALETTE.map((paletteColor) => (
                <ToolbarTooltip key={paletteColor} label={paletteColor}>
                  <button
                    type="button"
                    onClick={() => onColorChange(paletteColor)}
                    className={`h-8 w-8 rounded border-2 transition-transform hover:scale-110 ${
                      color === paletteColor
                        ? "scale-110 border-gray-800"
                        : "border-gray-300"
                    }`}
                    style={{ backgroundColor: paletteColor }}
                    aria-label={paletteColor}
                  />
                </ToolbarTooltip>
              ))}
            </div>
          </div>

          {/* テキスト入力エリア */}
          <div>
            <Label className="text-sm font-medium">テキスト内容</Label>
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="テキストを入力してください..."
              rows={6}
              className="mt-2 resize-none"
              style={{
                fontSize: "16px",
                color: color,
              }}
            />
          </div>

          {/* 拡張Canvasプレビュー */}
          {value.trim() && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-sm font-medium">プレビュー</Label>
                {backgroundImageUrl && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="showBackground"
                      checked={showBackground}
                      onCheckedChange={(checked) =>
                        setShowBackground(checked === true)
                      }
                    />
                    <label
                      htmlFor="showBackground"
                      className="cursor-pointer text-xs text-gray-600"
                    >
                      答案画像を背景表示
                    </label>
                  </div>
                )}
              </div>
              <EnhancedCanvasPreview
                textBox={previewTextBox}
                backgroundImageUrl={backgroundImageUrl}
                showBackground={showBackground}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            キャンセル
          </Button>
          <Button onClick={onSubmit}>確定 (Ctrl+Enter)</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** 窓の中のボタンに、title の代わりに付ける短い説明 */
function ToolbarTooltip({
  label,
  children,
}: {
  label: string
  children: React.ReactElement
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
