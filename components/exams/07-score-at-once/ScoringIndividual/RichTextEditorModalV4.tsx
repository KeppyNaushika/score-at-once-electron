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
import React, { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
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

// V4統合: textbox-on-canvas-v4の機能をインポート
import type {
  AnchorDirection,
  TextBox,
} from "../../../../app/textbox-on-canvas-v4/types"
import { COLOR_PALETTE } from "./constants/drawingConstants"
import { EnhancedCanvasPreview } from "./EnhancedCanvasPreview"

interface RichTextEditorModalV4Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string
  onValueChange: (value: string) => void
  color: string
  onColorChange: (color: string) => void
  onSubmit: () => void
  onCancel: () => void
  title?: string
  // V4統合: 座標情報（個別採点画面の0-1座標系）
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

export function RichTextEditorModalV4({
  open,
  onOpenChange,
  value,
  onValueChange,
  color,
  onColorChange,
  onSubmit,
  onCancel,
  title = "高品質テキスト編集",
  position = { x: 0.5, y: 0.5 },
  canvasWidth = 800,
  canvasHeight = 600,
  backgroundImageUrl,
  fontSize: initialFontSize = 16,
  onFontSizeChange,
  anchorDirection: initialAnchorDirection = "top-left",
  onAnchorDirectionChange,
}: RichTextEditorModalV4Props) {
  const [fontSize, setFontSizeLocal] = useState(initialFontSize)
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isUnderline, setIsUnderline] = useState(false)

  // V4統合: アンカー方向の設定
  const [anchorDirection, setAnchorDirectionLocal] = useState<AnchorDirection>(
    initialAnchorDirection
  )

  // 親への通知付きsetFontSize
  const setFontSize = useCallback(
    (size: number) => {
      setFontSizeLocal(size)
      onFontSizeChange?.(size)
    },
    [onFontSizeChange]
  )

  // 親への通知付きsetAnchorDirection
  const setAnchorDirection = useCallback(
    (direction: AnchorDirection) => {
      setAnchorDirectionLocal(direction)
      onAnchorDirectionChange?.(direction)
    },
    [onAnchorDirectionChange]
  )

  // propsが変更されたときにローカル状態を更新
  useEffect(() => {
    setFontSizeLocal(initialFontSize)
  }, [initialFontSize])

  useEffect(() => {
    setAnchorDirectionLocal(initialAnchorDirection)
  }, [initialAnchorDirection])

  // 背景画像表示設定
  const [showBackground, setShowBackground] = useState(false)

  // テキストエリアの参照
  const [textareaRef, setTextareaRef] = useState<HTMLTextAreaElement | null>(
    null
  )

  // V4統合: プレビュー用のTextBoxオブジェクトを作成
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

  // モーダルが開いたときにフォーカス
  useEffect(() => {
    if (open && textareaRef) {
      textareaRef.focus()
    }
  }, [open, textareaRef])

  // テキスト装飾の挿入
  const insertFormatting = useCallback(
    (prefix: string, suffix: string = "") => {
      if (!textareaRef) return

      const start = textareaRef.selectionStart
      const end = textareaRef.selectionEnd
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
          textareaRef.setSelectionRange(
            start + prefix.length,
            end + prefix.length
          )
        } else {
          textareaRef.setSelectionRange(
            start + prefix.length,
            start + prefix.length
          )
        }
        textareaRef.focus()
      }, 0)
    },
    [value, onValueChange, textareaRef]
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

  // フォントサイズ調整
  const handleFontSizeIncrease = useCallback(() => {
    setFontSize(Math.min(fontSize + 2, 48))
  }, [fontSize, setFontSize])

  const handleFontSizeDecrease = useCallback(() => {
    setFontSize(Math.max(fontSize - 2, 8))
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
      } else if (e.key === "Escape") {
        onCancel()
      }
    },
    [handleBold, handleItalic, handleUnderline, onSubmit, onCancel]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 書式設定ツールバー */}
          <div className="flex items-center gap-2 rounded-md border bg-gray-50 p-2">
            {/* 基本書式 */}
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={isBold ? "default" : "ghost"}
                onClick={handleBold}
                title="太字 (Ctrl+B)"
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant={isItalic ? "default" : "ghost"}
                onClick={handleItalic}
                title="斜体 (Ctrl+I)"
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant={isUnderline ? "default" : "ghost"}
                onClick={handleUnderline}
                title="下線 (Ctrl+U)"
              >
                <Underline className="h-4 w-4" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* フォントサイズ */}
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleFontSizeDecrease}
                title="フォントサイズを小さく"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="min-w-8 text-center text-sm">{fontSize}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleFontSizeIncrease}
                title="フォントサイズを大きく"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* 数式 */}
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleMathInline}
                title="インライン数式 $...$"
                className="text-xs"
              >
                $x$
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleMathBlock}
                title="ブロック数式 $$...$$"
                className="text-xs"
              >
                $$
              </Button>
            </div>
          </div>

          {/* アンカー位置設定 (Lucideアイコン使用) */}
          <div>
            <Label className="text-sm font-medium">アンカー位置</Label>
            <div className="mt-2 flex items-center gap-4">
              {/* 横方向 */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">横:</span>
                <Button
                  size="sm"
                  variant={
                    getHorizontalAlign(anchorDirection) === "left"
                      ? "default"
                      : "ghost"
                  }
                  onClick={() => setHorizontalAlign("left")}
                  title="左寄せ"
                >
                  <AlignLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant={
                    getHorizontalAlign(anchorDirection) === "center"
                      ? "default"
                      : "ghost"
                  }
                  onClick={() => setHorizontalAlign("center")}
                  title="中央寄せ"
                >
                  <AlignCenter className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant={
                    getHorizontalAlign(anchorDirection) === "right"
                      ? "default"
                      : "ghost"
                  }
                  onClick={() => setHorizontalAlign("right")}
                  title="右寄せ"
                >
                  <AlignRight className="h-4 w-4" />
                </Button>
              </div>

              {/* 縦方向 */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">縦:</span>
                <Button
                  size="sm"
                  variant={
                    getVerticalAlign(anchorDirection) === "top"
                      ? "default"
                      : "ghost"
                  }
                  onClick={() => setVerticalAlign("top")}
                  title="上寄せ"
                >
                  <ArrowUpToLine className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant={
                    getVerticalAlign(anchorDirection) === "center"
                      ? "default"
                      : "ghost"
                  }
                  onClick={() => setVerticalAlign("center")}
                  title="中央寄せ"
                >
                  <UnfoldVertical className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant={
                    getVerticalAlign(anchorDirection) === "bottom"
                      ? "default"
                      : "ghost"
                  }
                  onClick={() => setVerticalAlign("bottom")}
                  title="下寄せ"
                >
                  <ArrowDownToLine className="h-4 w-4" />
                </Button>
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
              {COLOR_PALETTE.map((paletteColor, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => onColorChange(paletteColor)}
                  className={`h-8 w-8 rounded border-2 transition-transform hover:scale-110 ${
                    color === paletteColor
                      ? "scale-110 border-gray-800"
                      : "border-gray-300"
                  }`}
                  style={{ backgroundColor: paletteColor }}
                  title={paletteColor}
                />
              ))}
            </div>
          </div>

          {/* テキスト入力エリア */}
          <div>
            <Label className="text-sm font-medium">テキスト内容</Label>
            <Textarea
              ref={setTextareaRef}
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="テキストを入力してください..."
              rows={6}
              className="mt-2 resize-none"
              style={{
                fontSize: `${fontSize}px`,
                color: color,
              }}
            />
          </div>

          {/* V4統合: 拡張Canvasプレビュー */}
          {value.trim() && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-sm font-medium">プレビュー</Label>
                {backgroundImageUrl && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="showBackground"
                      checked={showBackground}
                      onChange={(e) => setShowBackground(e.target.checked)}
                      className="rounded"
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
