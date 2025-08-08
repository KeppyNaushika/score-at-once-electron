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
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeMathjax from "rehype-mathjax/svg"
import { createRoot } from "react-dom/client"

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
  
  // SVGプレビュー状態（textbox-on-canvasと同じロジック）
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

  /**
   * textbox-on-canvasのconvertTextToSvg関数を完全移植
   */
  const convertTextToSvg = useCallback(
    async (text: string): Promise<SVGSVGElement | null> => {
      if (!text.trim()) return null

      /**
       * textbox-on-canvasと完全に同じDOM容器作成
       */
      const createTempPreviewContainer = (): HTMLDivElement => {
        const tempPreviewDiv = document.createElement("div")
        tempPreviewDiv.style.cssText = `
          position: absolute;
          left: -9999px;
          top: -9999px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans JP", "Hiragino Kaku Gothic ProN", "ヒラギノ角ゴ ProN W3", Arial, sans-serif;
          font-size: ${fontSize}px;
          line-height: 1.6;
          color: ${color};
          background: white;
          padding: 0;
          margin: 0;
          border: 0;
          width: max-content;
          height: max-content;
          display: block;
        `
        document.body.appendChild(tempPreviewDiv)
        return tempPreviewDiv
      }

      /**
       * textbox-on-canvasと完全に同じReactMarkdownレンダリング
       */
      const renderReactMarkdown = (container: HTMLDivElement) => {
        const root = createRoot(container)
        root.render(
          React.createElement(
            ReactMarkdown,
            {
              remarkPlugins: [remarkMath],
              rehypePlugins: [rehypeMathjax],
            },
            text,
          ),
        )
        return root
      }

      /**
       * textbox-on-canvasと完全に同じブラウザ描画完了待機
       */
      const waitForRenderingComplete = async (frames: number = 2): Promise<void> => {
        for (let i = 0; i < frames; i++) {
          await new Promise((resolve) => requestAnimationFrame(resolve))
        }
      }

      /**
       * textbox-on-canvasと完全に同じMathJax処理
       */
      const processMathJax = async (container: HTMLDivElement): Promise<void> => {
        const MJ = (window as any).MathJax
        if (MJ && MJ.typesetPromise) {
          try {
            await MJ.typesetPromise([container])
            await waitForRenderingComplete()
          } catch (mathError) {
            // MathJax処理失敗時も継続
          }
        }
      }

      /**
       * textbox-on-canvasと完全に同じ要素スタイルクリーンアップ
       */
      const cleanupElementStyles = (container: HTMLDivElement): void => {
        const allElements = container.querySelectorAll("*")
        allElements.forEach((el) => {
          const element = el as HTMLElement
          element.style.margin = "0"
          element.style.padding = "0"
          element.style.border = "0"
        })

        // textbox-on-canvasと同じ特別クリーンアップ
        const pElements = container.querySelectorAll("p")
        const mjxElements = container.querySelectorAll("mjx-container")

        pElements.forEach((p) => {
          p.style.margin = "0"
          p.style.padding = "0"
          p.style.lineHeight = "1.6"
        })

        mjxElements.forEach((mjx) => {
          const mjxEl = mjx as HTMLElement
          mjxEl.style.margin = "0"
          mjxEl.style.padding = "0"
        })
      }

      /**
       * textbox-on-canvasと完全に同じ寸法測定
       */
      const measureContentDimensions = (container: HTMLDivElement): { width: number; height: number } => {
        // Initial measurement (for reference, not used)
        container.getBoundingClientRect()
        container.scrollWidth
        container.scrollHeight

        // Optimize for content size
        container.style.width = "max-content"
        container.style.height = "max-content"

        // Final measurement
        const finalRect = container.getBoundingClientRect()
        const finalScrollWidth = container.scrollWidth
        const finalScrollHeight = container.scrollHeight

        const actualWidth = Math.max(finalScrollWidth, finalRect.width) + 20
        const actualHeight = Math.max(finalScrollHeight, finalRect.height)

        return { width: actualWidth, height: actualHeight }
      }

      /**
       * textbox-on-canvasと完全に同じSVG作成
       */
      const createSvgFromHtml = (htmlContent: string, width: number, height: number): SVGSVGElement => {
        const svgString = `
          <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            <foreignObject x="0" y="0" width="${width}" height="${height}">
              <div xmlns="http://www.w3.org/1999/xhtml" style="">
                <div style="font-size: ${fontSize}px; line-height: 1.6; color: ${color};">
                  ${htmlContent}
                </div>
              </div>
            </foreignObject>
          </svg>
        `

        const parser = new DOMParser()
        const svgDoc = parser.parseFromString(svgString, "image/svg+xml")
        return svgDoc.documentElement as unknown as SVGSVGElement
      }

      /**
       * textbox-on-canvasと完全に同じクリーンアップ処理
       */
      const performCleanup = (root: any, container: HTMLDivElement): void => {
        try {
          root.unmount()
          document.body.removeChild(container)
        } catch (cleanupError) {
          // クリーンアップ失敗時も継続
        }
      }

      /**
       * textbox-on-canvasと完全に同じDOM変更検出
       */
      const hasSignificantChanges = (mutations: MutationRecord[]): boolean => {
        return mutations.some(
          (mutation) =>
            mutation.type === "childList" &&
            (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0),
        )
      }

      /**
       * textbox-on-canvasと完全に同じレンダリング後処理
       */
      const processRenderedContent = async (
        container: HTMLDivElement,
        root: any,
        resolve: (value: SVGSVGElement | null) => void
      ): Promise<void> => {
        try {
          console.log('🔄 描画完了待機中...')
          await waitForRenderingComplete()
          
          console.log('🧮 MathJax処理中...')
          await processMathJax(container)
          
          console.log('🧹 スタイルクリーンアップ中...')
          cleanupElementStyles(container)
          await waitForRenderingComplete(1)

          console.log('📏 寸法測定中...')
          const dimensions = measureContentDimensions(container)
          console.log('📐 測定結果:', dimensions)
          
          const htmlContent = container.innerHTML
          console.log('📄 HTML内容:', htmlContent.substring(0, 200))
          
          console.log('🖼️ SVG作成中...')
          const svgElement = createSvgFromHtml(htmlContent, dimensions.width, dimensions.height)
          console.log('✅ SVG作成完了:', !!svgElement)
          
          performCleanup(root, container)
          
          resolve(svgElement)
        } catch (error) {
          console.error('❌ processRenderedContentエラー:', error)
          performCleanup(root, container)
          resolve(null)
        }
      }

      try {
        console.log('🏗️ DOM容器作成中...')
        const tempPreviewDiv = createTempPreviewContainer()
        console.log('⚛️ ReactMarkdown描画中...')
        const root = renderReactMarkdown(tempPreviewDiv)

        return new Promise((resolve) => {
          let renderingComplete = false

          const observer = new MutationObserver(async (mutations) => {
            console.log('🔍 MutationObserver発火:', { 
              mutationsCount: mutations.length, 
              hasChanges: hasSignificantChanges(mutations),
              childrenCount: tempPreviewDiv.children.length 
            })

            if (renderingComplete) return

            if (hasSignificantChanges(mutations) && tempPreviewDiv.children.length > 0) {
              console.log('✨ 描画完了検出、SVG生成開始...')
              renderingComplete = true
              observer.disconnect()
              await processRenderedContent(tempPreviewDiv, root, resolve)
            }
          })

          observer.observe(tempPreviewDiv, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false,
          })
          
          console.log('👀 MutationObserver開始')

          // 初期状態をチェック（デバッグ用）
          setTimeout(() => {
            console.log('🔍 1秒後のコンテナ状態:', {
              childrenCount: tempPreviewDiv.children.length,
              innerHTML: tempPreviewDiv.innerHTML.substring(0, 100),
              textContent: tempPreviewDiv.textContent?.substring(0, 100)
            })
          }, 1000)

          // textbox-on-canvasと同じフォールバックタイムアウト
          setTimeout(() => {
            if (!renderingComplete) {
              console.log('⏰ タイムアウト発生（10秒）')
              console.log('💀 最終コンテナ状態:', {
                childrenCount: tempPreviewDiv.children.length,
                innerHTML: tempPreviewDiv.innerHTML.substring(0, 200)
              })
              observer.disconnect()
              performCleanup(root, tempPreviewDiv)
              resolve(null)
            }
          }, 10000)
        })
      } catch (error) {
        console.error('💥 convertTextToSvg全体エラー:', error)
        return null
      }
    },
    [], // 依存関係を空に（fontSize, colorは関数内で直接参照）
  )

  // LaTeX記法をMarkdown記法に変換
  const convertLatexToMarkdown = useCallback((text: string): string => {
    return text
      .replace(/\\\(/g, '$')     // \( を $ に
      .replace(/\\\)/g, '$')     // \) を $ に
      .replace(/\\\[/g, '$$')    // \[ を $$ に
      .replace(/\\\]/g, '$$')    // \] を $$ に
  }, [])

  // SVGプレビュー更新（textbox-on-canvasと同じロジック + LaTeX変換）
  useEffect(() => {
    console.log('🔄 SVGプレビュー更新開始:', { value: value.substring(0, 50), isEmpty: !value.trim() })
    
    if (!value.trim()) {
      setSvgPreviewUrl(null)
      return
    }

    setIsPreviewRendering(true)

    const updatePreview = async () => {
      try {
        // LaTeX記法をMarkdown記法に変換
        const processedText = convertLatexToMarkdown(value)
        console.log('⏳ convertTextToSvg開始:', processedText.substring(0, 50))
        const svgElement = await convertTextToSvg(processedText)
        console.log('✅ convertTextToSvg完了:', { svgElement: !!svgElement })
        
        if (svgElement) {
          const svgData = new XMLSerializer().serializeToString(svgElement)
          const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`
          console.log('🖼️ SVG URL生成完了:', svgDataUrl.substring(0, 100))
          setSvgPreviewUrl(svgDataUrl)
        } else {
          console.log('❌ SVG生成失敗')
          setSvgPreviewUrl(null)
        }
        setIsPreviewRendering(false)
      } catch (error) {
        console.error('❌ SVGプレビューエラー:', error)
        setSvgPreviewUrl(null)
        setIsPreviewRendering(false)
      }
    }

    updatePreview()
  }, [value, fontSize, color, convertLatexToMarkdown])

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

          {/* SVGプレビュー（textbox-on-canvasと同じロジック） */}
          <div>
            <Label className="text-sm font-medium">プレビュー</Label>
            <div className="mt-2 p-3 border rounded-md bg-white min-h-16 flex items-center justify-center">
              {isPreviewRendering ? (
                <div className="text-gray-400 text-sm">レンダリング中...</div>
              ) : svgPreviewUrl ? (
                <img
                  src={svgPreviewUrl}
                  alt="Preview"
                  className="max-w-full h-auto"
                  style={{ display: "block" }}
                />
              ) : (
                <div className="text-gray-400 text-sm">テキストを入力するとプレビューが表示されます</div>
              )}
            </div>
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