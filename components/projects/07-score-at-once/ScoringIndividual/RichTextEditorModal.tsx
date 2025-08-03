"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { 
  Bold, 
  Italic, 
  Underline, 
  Type,
  Palette,
  Plus,
  Minus,
} from "lucide-react"
import { useState, useCallback, useEffect } from "react"
import { COLOR_PALETTE } from "./constants/drawing-constants"
import { MarkdownPreview } from "./MarkdownPreview"

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
}: RichTextEditorModalProps) {
  const [fontSize, setFontSize] = useState(16)
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isUnderline, setIsUnderline] = useState(false)

  // テキストエリアの参照
  const [textareaRef, setTextareaRef] = useState<HTMLTextAreaElement | null>(null)

  // モーダルが開いたときにフォーカス
  useEffect(() => {
    if (open && textareaRef) {
      textareaRef.focus()
    }
  }, [open, textareaRef])

  // テキスト装飾の挿入
  const insertFormatting = useCallback((prefix: string, suffix: string = '') => {
    if (!textareaRef) return

    const start = textareaRef.selectionStart
    const end = textareaRef.selectionEnd
    const selectedText = value.substring(start, end)
    
    let newText = value.substring(0, start) + prefix + selectedText + suffix + value.substring(end)
    onValueChange(newText)

    // カーソル位置を調整
    setTimeout(() => {
      if (selectedText) {
        textareaRef.setSelectionRange(start + prefix.length, end + prefix.length)
      } else {
        textareaRef.setSelectionRange(start + prefix.length, start + prefix.length)
      }
      textareaRef.focus()
    }, 0)
  }, [value, onValueChange, textareaRef])

  // 書式設定ボタンのハンドラー
  const handleBold = useCallback(() => {
    insertFormatting('**', '**')
    setIsBold(true)
    setTimeout(() => setIsBold(false), 200)
  }, [insertFormatting])

  const handleItalic = useCallback(() => {
    insertFormatting('*', '*')
    setIsItalic(true)
    setTimeout(() => setIsItalic(false), 200)
  }, [insertFormatting])

  const handleUnderline = useCallback(() => {
    insertFormatting('<u>', '</u>')
    setIsUnderline(true)
    setTimeout(() => setIsUnderline(false), 200)
  }, [insertFormatting])

  // MathJax記法の挿入
  const handleMathInline = useCallback(() => {
    insertFormatting('$', '$')
  }, [insertFormatting])

  const handleMathBlock = useCallback(() => {
    insertFormatting('$$\n', '\n$$')
  }, [insertFormatting])

  // フォントサイズ調整
  const handleFontSizeIncrease = useCallback(() => {
    setFontSize(prev => Math.min(prev + 2, 32))
  }, [])

  const handleFontSizeDecrease = useCallback(() => {
    setFontSize(prev => Math.max(prev - 2, 8))
  }, [])

  // キーボードショートカット
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault()
          handleBold()
          break
        case 'i':
          e.preventDefault()
          handleItalic()
          break
        case 'u':
          e.preventDefault()
          handleUnderline()
          break
        case 'Enter':
          e.preventDefault()
          onSubmit()
          break
      }
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }, [handleBold, handleItalic, handleUnderline, onSubmit, onCancel])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 書式設定ツールバー */}
          <div className="flex items-center gap-2 p-2 border rounded-md bg-gray-50">
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
              <span className="text-sm min-w-8 text-center">{fontSize}</span>
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

          {/* カラーパレット */}
          <div>
            <Label className="text-sm font-medium">テキスト色</Label>
            <div className="mt-2 grid grid-cols-8 gap-2">
              {COLOR_PALETTE.map((paletteColor, index) => (
                <button
                  key={index}
                  onClick={() => onColorChange(paletteColor)}
                  className={`h-8 w-8 rounded border-2 transition-transform hover:scale-110 ${
                    color === paletteColor
                      ? "border-gray-800 scale-110"
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

          {/* プレビュー */}
          <div>
            <Label className="text-sm font-medium">プレビュー</Label>
            <MarkdownPreview
              content={value}
              className="mt-2 p-3 border rounded-md bg-white min-h-16 prose-sm"
              style={{
                fontSize: `${fontSize}px`,
                color: color,
              }}
            />
          </div>

          {/* ヘルプテキスト */}
          <div className="text-xs text-gray-500 space-y-1">
            <p><strong>ショートカット:</strong> Ctrl+B (太字), Ctrl+I (斜体), Ctrl+U (下線), Ctrl+Enter (確定)</p>
            <p><strong>数式記法:</strong> インライン数式: $x^2$ または \(x^2\), ブロック数式: $$\int x dx$$ または \[\int x dx\]</p>
            <p><strong>書式記法:</strong> **太字**, *斜体*, &lt;u&gt;下線&lt;/u&gt;</p>
            <p><strong>その他:</strong> 改行は自動処理、リスト記法 (-, *), 見出し (#, ##, ###) も利用可能</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            キャンセル
          </Button>
          <Button onClick={onSubmit}>
            確定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}