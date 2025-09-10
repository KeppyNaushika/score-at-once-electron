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
import React, { useState, useCallback, useEffect, useRef } from "react"
import { COLOR_PALETTE } from "./constants/drawing-constants"
import { convertTextToSvg } from "@/app/textbox-on-canvas-v3/utils/textConversionUtils"

interface RichTextEditorModalV3Props {
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

export function RichTextEditorModalV3({
  open,
  onOpenChange,
  value,
  onValueChange,
  color,
  onColorChange,
  onSubmit,
  onCancel,
  title = "テキスト編集",
}: RichTextEditorModalV3Props) {
  const [fontSize, setFontSize] = useState(16)
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isUnderline, setIsUnderline] = useState(false)

  // テキストエリアの参照
  const [textareaRef, setTextareaRef] = useState<HTMLTextAreaElement | null>(null)
  
  // SVGプレビュー状態（textbox-on-canvas-v3を使用）
  const [svgPreviewUrl, setSvgPreviewUrl] = useState<string | null>(null)
  const [isPreviewRendering, setIsPreviewRendering] = useState(false)

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

  // LaTeX記法をMarkdown記法に変換
  const convertLatexToMarkdown = useCallback((text: string): string => {
    return text
      .replace(/\\\(/g, '$')     // \( を $ に
      .replace(/\\\)/g, '$')     // \) を $ に
      .replace(/\\\[/g, '$$')    // \[ を $$ に
      .replace(/\\\]/g, '$$')    // \] を $$ に
  }, [])

  // textbox-on-canvas-v3のconvertTextToSvgを直接使用
  useEffect(() => {
    console.log('🔄 SVGプレビュー更新開始 (V3):', { value: value.substring(0, 50), isEmpty: !value.trim() })
    
    if (!value.trim()) {
      setSvgPreviewUrl(null)
      return
    }

    setIsPreviewRendering(true)

    const updatePreview = async () => {
      try {
        // textbox-on-canvas-v3のpreprocessMathSyntax機能を使用（LaTeX記法を$記法に正規化）
        const processedText = value // textbox-on-canvas-v3内でLaTeX処理は自動実行される
        console.log('⏳ textbox-on-canvas-v3 convertTextToSvg開始:', processedText.substring(0, 50))
        
        // textbox-on-canvas-v3の完全機能を使用（正しいAPI）
        const svgElement = await convertTextToSvg(
          processedText,
          800,  // 幅
          600,  // 高さ
          'left',   // horizontalAlign
          'top'     // verticalAlign
        )
        
        console.log('✅ textbox-on-canvas-v3 convertTextToSvg完了:', { svgElement: !!svgElement })
        
        if (svgElement) {
          const svgData = new XMLSerializer().serializeToString(svgElement)
          const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`
          console.log('🖼️ SVG URL生成完了 (V3):', svgDataUrl.substring(0, 100))
          setSvgPreviewUrl(svgDataUrl)
        } else {
          console.log('❌ SVG生成失敗 (V3)')
          setSvgPreviewUrl(null)
        }
        setIsPreviewRendering(false)
      } catch (error) {
        console.error('❌ SVGプレビューエラー (V3):', error)
        setSvgPreviewUrl(null)
        setIsPreviewRendering(false)
      }
    }

    updatePreview()
  }, [value, fontSize, color])

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
          <DialogTitle>{title} (V3統合版)</DialogTitle>
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

          {/* textbox-on-canvas-v3を使用したSVGプレビュー */}
          <div>
            <Label className="text-sm font-medium">プレビュー (V3統合版)</Label>
            <div className="mt-2 p-3 border rounded-md bg-white min-h-16 flex items-center justify-center">
              {isPreviewRendering ? (
                <div className="text-gray-400 text-sm">レンダリング中... (V3処理)</div>
              ) : svgPreviewUrl ? (
                <img
                  src={svgPreviewUrl}
                  alt="Preview"
                  className="max-w-full h-auto"
                  style={{ display: "block" }}
                />
              ) : (
                <div className="text-gray-400 text-sm">テキストを入力するとプレビューが表示されます (V3品質)</div>
              )}
            </div>
          </div>

          {/* ヘルプテキスト */}
          <div className="text-xs text-gray-500 space-y-1">
            <p><strong>V3統合版機能:</strong> scrollWidth/scrollHeight正確測定、改行処理最適化、MathJax高品質レンダリング</p>
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