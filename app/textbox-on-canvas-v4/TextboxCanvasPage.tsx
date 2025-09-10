/**
 * @fileoverview メインのTextbox Canvas ページコンポーネント
 * @description 数学式対応テキストボックスCanvasシステムのメインコンポーネント
 *
 * ## 主要機能
 * - ドラッグ&ドロップによるテキストボックス作成
 * - MathJax数式のリアルタイム描画
 * - 高精度な動的サイズ測定
 * - SVG-Canvas変換による高品質レンダリング
 *
 * ## 技術的特徴
 * - ReactMarkdown + MathJax統合
 * - MutationObserver による描画完了検出
 * - アスペクト比維持スケーリング
 * - 完全自動サイズ調整（余白なし高精度測定）
 */

"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { AlignLeft, AlignCenter, AlignRight, AlignVerticalSpaceAround, AlignVerticalSpaceBetween } from "lucide-react"
import React, { useCallback, useEffect, useRef, useState } from "react"

// 型定義とインターフェース
import type { DragState, TextBox } from "./types"

/**
 * TextboxのプレビューコンポーネントでMathJax処理を実行
 * SVG変換と完全に同じロジックを使用
 */
function TextboxPreview({ textBox }: { textBox: TextBox }) {
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (previewRef.current && textBox.text) {
      const processPreview = async () => {
        try {
          // テキストをHTMLに変換
          const htmlContent = parseTextWithMath(textBox.text)

          // SVG変換と完全に同じMathJax処理を実行
          await processMathJaxContent(previewRef.current!, htmlContent)

        } catch (error) {
          console.error("DIVプレビュー処理エラー:", error)
        }
      }

      processPreview()
    }
  }, [textBox.text])

  return (
    <div className="border border-green-300 rounded p-2 bg-white">
      <div className="text-xs text-gray-500 mb-1">
        ID: {textBox.id.substring(0, 8)}... | 位置: ({Math.round(textBox.x)}, {Math.round(textBox.y)})
      </div>
      <div 
        ref={previewRef}
        className="text-sm math-preview"
      />
      <div className="text-xs text-gray-400 mt-1">
        生テキスト: {textBox.text}
      </div>
    </div>
  )
}

/**
 * SVG プレビューコンポーネント
 * 変換後の純粋なSVG図形データを表示
 */
function TextboxSvgPreview({ textBox }: { textBox: TextBox }) {
  const [svgElement, setSvgElement] = useState<SVGSVGElement | null>(null)
  const [renderingStatus, setRenderingStatus] = useState<string>("待機中")

  useEffect(() => {
    if (textBox.text) {
      const renderSvgPreview = async () => {
        try {
          setRenderingStatus("SVG生成中...")
          
          // Canvas描画プレビューと**全く同じSVG生成処理**
          const generatedSvg = await convertTextToSvg(
            textBox.text, 
            textBox.width, 
            textBox.height, 
            textBox.horizontalAlign || 'left', 
            textBox.verticalAlign || 'top'
          )

          if (generatedSvg) {
            setSvgElement(generatedSvg.cloneNode(true) as SVGSVGElement)
            setRenderingStatus("SVG生成完了")
          } else {
            setSvgElement(null)
            setRenderingStatus("SVG生成失敗")
          }

        } catch (error) {
          console.error("SVGプレビュー処理エラー:", error)
          setSvgElement(null)
          setRenderingStatus("SVG生成エラー")
        }
      }

      renderSvgPreview()
    }
  }, [textBox.text, textBox.width, textBox.height, textBox.horizontalAlign, textBox.verticalAlign])

  return (
    <div className="border border-blue-300 rounded p-2 bg-white">
      <div className="text-xs text-gray-500 mb-1">
        ID: {textBox.id.substring(0, 8)}... | SVGサイズ: {svgElement?.getAttribute('width') || 'N/A'} × {svgElement?.getAttribute('height') || 'N/A'}
      </div>
      <div className="border border-gray-200 rounded p-2 bg-white min-h-[60px] flex items-center justify-center">
        {svgElement ? (
          <div 
            dangerouslySetInnerHTML={{ 
              __html: new XMLSerializer().serializeToString(svgElement) 
            }}
            style={{ maxWidth: '100%', overflow: 'auto' }}
          />
        ) : (
          <div className="text-gray-400 text-sm">SVG生成待機中...</div>
        )}
      </div>
      <div className="text-xs text-gray-400 mt-1 flex justify-between">
        <span>ステータス: {renderingStatus}</span>
        <span>元テキスト長: {textBox.text.length}文字</span>
      </div>
    </div>
  )
}

/**
 * Image プレビューコンポーネント
 * SVG→Image変換後の状態を表示
 */
function TextboxImagePreview({ textBox }: { textBox: TextBox }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageSize, setImageSize] = useState<{width: number, height: number} | null>(null)
  const [renderingStatus, setRenderingStatus] = useState<string>("待機中")

  useEffect(() => {
    if (textBox.text) {
      const renderImagePreview = async () => {
        try {
          setRenderingStatus("Image生成中...")
          
          // SVGプレビューと**全く同じSVG生成処理**
          const svgElement = await convertTextToSvg(
            textBox.text, 
            textBox.width, 
            textBox.height, 
            textBox.horizontalAlign || 'left', 
            textBox.verticalAlign || 'top'
          )

          if (svgElement) {
            // SVG→Blob→Image変換 (Canvas描画と全く同じ処理)
            const svgData = new XMLSerializer().serializeToString(svgElement)
            const svgBlob = new Blob([svgData], {
              type: "image/svg+xml;charset=utf-8",
            })
            const svgUrl = URL.createObjectURL(svgBlob)

            const img = new Image()
            img.onload = () => {
              setImageUrl(svgUrl)
              setImageSize({ width: img.width, height: img.height })
              setRenderingStatus("Image生成完了")
            }
            img.onerror = () => {
              URL.revokeObjectURL(svgUrl)
              setImageUrl(null)
              setImageSize(null)
              setRenderingStatus("Image生成失敗")
            }
            img.src = svgUrl
          } else {
            setImageUrl(null)
            setImageSize(null)
            setRenderingStatus("SVG生成失敗")
          }

        } catch (error) {
          console.error("Imageプレビュー処理エラー:", error)
          setImageUrl(null)
          setImageSize(null)
          setRenderingStatus("Image生成エラー")
        }
      }

      renderImagePreview()
    }

    // クリーンアップ
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl)
      }
    }
  }, [textBox.text, textBox.width, textBox.height, textBox.horizontalAlign, textBox.verticalAlign])

  return (
    <div className="border border-purple-300 rounded p-2 bg-white">
      <div className="text-xs text-gray-500 mb-1">
        ID: {textBox.id.substring(0, 8)}... | Image: {imageSize ? `${imageSize.width} × ${imageSize.height}` : 'N/A'}
      </div>
      <div className="border border-gray-200 rounded p-2 bg-white min-h-[60px] flex items-center justify-center">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt="SVG→Image変換結果"
            style={{ 
              maxWidth: '100%', 
              maxHeight: '200px',
              objectFit: 'contain'
            }}
          />
        ) : (
          <div className="text-gray-400 text-sm">Image生成待機中...</div>
        )}
      </div>
      <div className="text-xs text-gray-400 mt-1 flex justify-between">
        <span>ステータス: {renderingStatus}</span>
        <span>フォーマット: ラスター画像</span>
      </div>
    </div>
  )
}

/**
 * Canvas プレビューコンポーネント
 * 実際のCanvas描画をプレビュー表示
 */
function TextboxCanvasPreview({ textBox }: { textBox: TextBox }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [renderingStatus, setRenderingStatus] = useState<string>("待機中")
  const [usedSvg, setUsedSvg] = useState<SVGSVGElement | null>(null)

  useEffect(() => {
    if (canvasRef.current && textBox.text) {
      const renderPreview = async () => {
        try {
          setRenderingStatus("描画中...")
          const canvas = canvasRef.current!
          const ctx = canvas.getContext("2d")
          if (!ctx) {
            setRenderingStatus("Canvas取得失敗")
            return
          }

          // キャンバスクリア
          ctx.clearRect(0, 0, canvas.width, canvas.height)

          // 白い背景を設定
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)

          // 他のプレビューと**全く同じSVG生成処理**
          const svgElement = await convertTextToSvg(
            textBox.text, 
            textBox.width, 
            textBox.height, 
            textBox.horizontalAlign || 'left', 
            textBox.verticalAlign || 'top'
          )

          if (svgElement) {
            // デバッグ用にSVGを保存
            setUsedSvg(svgElement.cloneNode(true) as SVGSVGElement)
            
            // Canvas描画
            await renderSvgToCanvas(svgElement, ctx, 10, 10, textBox.width - 20, textBox.height - 20)
            setRenderingStatus("描画完了")
          } else {
            setUsedSvg(null)
            setRenderingStatus("SVG生成失敗")
          }

        } catch (error) {
          console.error("Canvasプレビュー処理エラー:", error)
          setRenderingStatus("描画エラー")
        }
      }

      renderPreview()
    }
  }, [textBox.text, textBox.width, textBox.height, textBox.horizontalAlign, textBox.verticalAlign])

  return (
    <div className="border border-orange-300 rounded p-2 bg-white">
      <div className="text-xs text-gray-500 mb-1">
        ID: {textBox.id.substring(0, 8)}... | 使用SVG: {usedSvg?.getAttribute('width') || 'N/A'} × {usedSvg?.getAttribute('height') || 'N/A'}
      </div>
      <canvas
        ref={canvasRef}
        width={Math.max(textBox.width, 200)}
        height={Math.max(textBox.height, 100)}
        className="border border-gray-200 rounded"
        style={{ 
          maxWidth: '100%', 
          height: 'auto',
          backgroundColor: '#ffffff'
        }}
      />
      <div className="text-xs text-gray-400 mt-1 flex justify-between">
        <span>ステータス: {renderingStatus}</span>
        <span>配置: {textBox.horizontalAlign || 'left'} × {textBox.verticalAlign || 'top'}</span>
      </div>
    </div>
  )
}

// 定数
import { SAMPLE_IMAGE_URL } from "./constants"

// ユーティリティ関数群
import {
  drawBackgroundImage,
  drawCreatingTextBox,
  drawTextBoxBorder,
  renderSvgToCanvas,
} from "./utils/canvasUtils"
import {
  createTextBoxFromDrag,
  findTextBoxAtPoint,
  getCanvasCoordinates,
  isValidDragForTextBox,
  updateTextBoxContent,
  updateTextBoxSelection,
} from "./utils/coordinateUtils"
import { convertTextToSvg, processMathJaxContent, parseTextWithMath } from "./utils/textConversionUtils"

/**
 * テキストボックス Canvas ページのメインコンポーネント
 * @returns
 */
export default function TextboxCanvasPage() {
  // Canvas要素への参照
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 状態管理
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([])
  const [isCreatingTextBox, setIsCreatingTextBox] = useState<boolean>(false)
  const [currentDrag, setCurrentDrag] = useState<DragState | null>(null)
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(
    null,
  )
  const [showTextInput, setShowTextInput] = useState<boolean>(false)
  const [textInputValue, setTextInputValue] = useState<string>("")
  const [zoom, setZoom] = useState<number>(1)
  const [status, setStatus] = useState<string>("")

  /**
   * テキストをCanvas上にレンダリングする（MathJax対応）
   * @param text レンダリングするテキスト
   * @param x X座標
   * @param y Y座標
   * @param width 幅
   * @param height 高さ
   */
  const renderTextToCanvas = useCallback(
    async (
      text: string,
      x: number,
      y: number,
      width: number,
      height: number,
    ): Promise<void> => {
      const canvas = canvasRef.current
      if (!canvas || !text.trim()) return

      try {
        setStatus("数式を描画中...")

        // 対応するテキストボックスを座標とテキストで検索（より確実）
        const currentTextBox = textBoxes.find(tb => 
          tb.text === text && 
          Math.abs(tb.x - x) < 1 && 
          Math.abs(tb.y - y) < 1
        )
        const horizontalAlign = currentTextBox?.horizontalAlign || 'left'
        const verticalAlign = currentTextBox?.verticalAlign || 'top'

        console.log('描画設定:', { text, horizontalAlign, verticalAlign, textBoxId: currentTextBox?.id })

        // SVG生成（プレビューで正常確認済み）
        const svgElement = await convertTextToSvg(text, width, height, horizontalAlign, verticalAlign)

        if (svgElement) {
          // Canvas描画コンテキストを取得
          const ctx = canvas.getContext("2d")
          if (ctx) {
            // SVG→Canvas描画
            const result = await renderSvgToCanvas(svgElement, ctx, x, y, width, height)
            console.log('Canvas描画完了:', { width: result.width, height: result.height })
            setStatus("描画完了")
          } else {
            setStatus("Canvas描画コンテキスト取得失敗")
          }
        } else {
          setStatus("SVG生成失敗")
        }
      } catch (error) {
        console.error("テキスト描画エラー:", error)
        setStatus("描画エラー")
      }
    },
    [textBoxes],
  )


  /**
   * Canvas全体を再描画する
   */
  const redrawCanvas = useCallback(async (): Promise<void> => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    try {
      setStatus("描画中...")

      // キャンバスクリア
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // 背景画像を描画
      await drawBackgroundImage(ctx, SAMPLE_IMAGE_URL)

      // テキストボックスを描画
      for (const textBox of textBoxes) {
        // テキストボックス枠を描画
        drawTextBoxBorder(
          ctx,
          textBox.x,
          textBox.y,
          textBox.width,
          textBox.height,
          textBox.isSelected,
        )

        // テキスト内容を描画
        if (textBox.text) {
          await renderTextToCanvas(
            textBox.text,
            textBox.x,
            textBox.y,
            textBox.width,
            textBox.height,
          )
        }
      }

      // 作成中のテキストボックスを描画
      if (currentDrag && isCreatingTextBox) {
        const x = Math.min(currentDrag.startX, currentDrag.currentX)
        const y = Math.min(currentDrag.startY, currentDrag.currentY)
        const width = Math.abs(currentDrag.currentX - currentDrag.startX)
        const height = Math.abs(currentDrag.currentY - currentDrag.startY)

        drawCreatingTextBox(ctx, x, y, width, height)
      }

      setStatus("描画完了")
    } catch (error) {
      console.error("Canvas再描画エラー:", error)
      setStatus("描画エラー")
    }
  }, [textBoxes, currentDrag, isCreatingTextBox, renderTextToCanvas])

  /**
   * マウスダウンイベントハンドラー
   */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent): void => {
      const canvas = canvasRef.current
      if (!canvas) return

      const coords = getCanvasCoordinates(e.clientX, e.clientY, canvas, zoom)

      // テキストボックスの選択チェック
      const clickedTextBox = findTextBoxAtPoint(textBoxes, coords)

      if (clickedTextBox) {
        // 既存のテキストボックスをクリック
        setTextBoxes(updateTextBoxSelection(textBoxes, clickedTextBox.id))
        setSelectedTextBoxId(clickedTextBox.id)

        // ダブルクリックでテキスト編集
        if (selectedTextBoxId === clickedTextBox.id) {
          setTextInputValue(clickedTextBox.text)
          setShowTextInput(true)
        }
      } else {
        // 新しいテキストボックスの作成開始
        setTextBoxes(updateTextBoxSelection(textBoxes, null))
        setSelectedTextBoxId(null)
        setIsCreatingTextBox(true)
        setCurrentDrag({
          startX: coords.x,
          startY: coords.y,
          currentX: coords.x,
          currentY: coords.y,
        })
      }
    },
    [textBoxes, selectedTextBoxId, zoom],
  )

  /**
   * マウスムーブイベントハンドラー
   */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent): void => {
      if (!currentDrag || !isCreatingTextBox || !canvasRef.current) return

      const coords = getCanvasCoordinates(
        e.clientX,
        e.clientY,
        canvasRef.current,
        zoom,
      )
      setCurrentDrag((prev) =>
        prev
          ? {
              ...prev,
              currentX: coords.x,
              currentY: coords.y,
            }
          : null,
      )
    },
    [currentDrag, isCreatingTextBox, zoom],
  )

  /**
   * マウスアップイベントハンドラー
   */
  const handleMouseUp = useCallback((): void => {
    if (currentDrag && isCreatingTextBox) {
      // 有効なサイズのテキストボックスのみ作成
      if (isValidDragForTextBox(currentDrag)) {
        const newTextBox = createTextBoxFromDrag(currentDrag)
        setTextBoxes((prev) => [...prev, newTextBox])
      }

      setCurrentDrag(null)
      setIsCreatingTextBox(false)
    }
  }, [currentDrag, isCreatingTextBox])

  /**
   * テキスト入力送信処理
   */
  const handleTextSubmit = useCallback((): void => {
    if (!textInputValue.trim() || !selectedTextBoxId) {
      setShowTextInput(false)
      setTextInputValue("")
      return
    }

    setTextBoxes(
      updateTextBoxContent(textBoxes, selectedTextBoxId, textInputValue),
    )
    setShowTextInput(false)
    setTextInputValue("")
  }, [textInputValue, selectedTextBoxId, textBoxes])

  /**
   * テキスト入力キャンセル処理
   */
  const handleTextCancel = useCallback((): void => {
    setShowTextInput(false)
    setTextInputValue("")
  }, [])

  // Canvas再描画効果
  useEffect(() => {
    redrawCanvas()
  }, [redrawCanvas])

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>
              テキストボックス Canvas (ズーム: {Math.round(zoom * 100)}%)
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              ドラッグしてテキストボックスを作成し、ダブルクリックでテキストを編集できます。
              MathJax数式をサポートしています。
            </p>
            {status && (
              <div className="rounded bg-blue-50 px-3 py-2 text-sm text-blue-700">
                ステータス: {status}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* メインCanvas */}
              <div className="relative">
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={600}
                  className="cursor-crosshair border-2 border-gray-300 shadow-lg"
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: "top left",
                  }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                />
              </div>

              {/* Element Information List */}
              <div className="rounded-md border bg-gray-50 p-3 text-xs text-gray-600">
                <div className="mb-2 font-medium">
                  要素情報リスト ({textBoxes.length}個)
                </div>
                {textBoxes.length === 0 ? (
                  <div className="text-gray-400 italic">
                    テキストボックスが作成されていません
                  </div>
                ) : (
                  <div className="space-y-1">
                    {textBoxes.map((textBox) => (
                      <div
                        key={textBox.id}
                        className={`flex items-center justify-between rounded p-2 ${
                          textBox.isSelected
                            ? "border border-blue-200 bg-blue-100"
                            : "border border-gray-200 bg-white"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 font-mono text-xs text-gray-500">
                            ID: {textBox.id.substring(0, 8)}...
                          </div>
                          <div className="text-xs">
                            <span className="mr-3 inline-block">
                              位置: ({Math.round(textBox.x)},{" "}
                              {Math.round(textBox.y)})
                            </span>
                            <span className="inline-block">
                              サイズ: {Math.round(textBox.width)} ×{" "}
                              {Math.round(textBox.height)}
                            </span>
                          </div>
                          {textBox.text && (
                            <div className="mt-1 truncate text-xs text-gray-700">
                              内容: {textBox.text.substring(0, 50)}
                              {textBox.text.length > 50 ? "..." : ""}
                            </div>
                          )}
                        </div>
                        <div className="ml-2 flex-shrink-0">
                          {textBox.isSelected && (
                            <span className="rounded bg-blue-500 px-2 py-1 text-xs text-white">
                              選択中
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 1. SVG変換前のDIVプレビュー */}
              <div className="rounded-md border border-green-200 bg-green-50 p-3">
                <div className="mb-2 text-sm font-medium text-green-800">1️⃣ DIVプレビュー (MathJax処理済みDOM)</div>
                <div id="div-preview-container" className="space-y-2">
                  {textBoxes.length === 0 || !textBoxes.some(tb => tb.text) ? (
                    <div className="text-gray-400 italic text-sm">
                      テキストボックスにテキストを入力するとMathJax処理済みDOMが表示されます
                    </div>
                  ) : (
                    textBoxes.filter(tb => tb.text).map((textBox) => (
                      <TextboxPreview key={textBox.id} textBox={textBox} />
                    ))
                  )}
                </div>
              </div>

              {/* 2. SVG変換後のプレビュー */}
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                <div className="mb-2 text-sm font-medium text-blue-800">2️⃣ SVGプレビュー (純粋な図形データ)</div>
                <div id="svg-preview-container" className="space-y-2">
                  {textBoxes.length === 0 || !textBoxes.some(tb => tb.text) ? (
                    <div className="text-gray-400 italic text-sm">
                      テキストボックスにテキストを入力するとSVG図形データが表示されます
                    </div>
                  ) : (
                    textBoxes.filter(tb => tb.text).map((textBox) => (
                      <TextboxSvgPreview key={textBox.id} textBox={textBox} />
                    ))
                  )}
                </div>
              </div>

              {/* 3. Image変換後のプレビュー */}
              <div className="rounded-md border border-purple-200 bg-purple-50 p-3">
                <div className="mb-2 text-sm font-medium text-purple-800">3️⃣ Imageプレビュー (ラスター画像)</div>
                <div id="image-preview-container" className="space-y-2">
                  {textBoxes.length === 0 || !textBoxes.some(tb => tb.text) ? (
                    <div className="text-gray-400 italic text-sm">
                      テキストボックスにテキストを入力するとImage変換結果が表示されます
                    </div>
                  ) : (
                    textBoxes.filter(tb => tb.text).map((textBox) => (
                      <TextboxImagePreview key={textBox.id} textBox={textBox} />
                    ))
                  )}
                </div>
              </div>

              {/* 4. Canvas描画プレビュー */}
              <div className="rounded-md border border-orange-200 bg-orange-50 p-3">
                <div className="mb-2 text-sm font-medium text-orange-800">4️⃣ Canvasプレビュー (最終描画結果)</div>
                <div id="canvas-preview-container" className="space-y-2">
                  {textBoxes.length === 0 || !textBoxes.some(tb => tb.text) ? (
                    <div className="text-gray-400 italic text-sm">
                      テキストボックスにテキストを入力するとCanvas描画結果が表示されます
                    </div>
                  ) : (
                    textBoxes.filter(tb => tb.text).map((textBox) => (
                      <TextboxCanvasPreview key={textBox.id} textBox={textBox} />
                    ))
                  )}
                </div>
              </div>

              {/* Red Border Debug Information */}
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-gray-600">
                <div className="mb-2 font-medium">🔴 赤枠サイズ情報</div>
                <div id="red-border-display" className="space-y-2">
                  <div className="text-gray-400 italic">
                    テキストボックスにテキストを入力すると赤枠サイズが表示されます
                  </div>
                </div>
              </div>

              {/* コントロールパネル */}
              <div className="flex items-center space-x-4">
                <Button
                  onClick={() => setZoom((prev) => Math.min(prev + 0.1, 2))}
                  variant="outline"
                  size="sm"
                >
                  ズームイン
                </Button>
                <Button
                  onClick={() => setZoom((prev) => Math.max(prev - 0.1, 0.5))}
                  variant="outline"
                  size="sm"
                >
                  ズームアウト
                </Button>
                <Button onClick={() => setZoom(1)} variant="outline" size="sm">
                  リセット
                </Button>
                <div className="text-sm text-gray-600">
                  テキストボックス数: {textBoxes.length}
                </div>
              </div>

              {/* テキスト入力モーダル */}
              {showTextInput && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader>
                    <CardTitle className="text-lg">テキスト入力</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Textarea
                        value={textInputValue}
                        onChange={(e) => setTextInputValue(e.target.value)}
                        placeholder="数式を含むテキストを入力してください... 例: $x^2 + y^2 = r^2$"
                        className="min-h-32"
                        rows={6}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            handleTextCancel()
                          } else if (e.key === "Enter" && e.ctrlKey) {
                            handleTextSubmit()
                          }
                        }}
                      />
                      {/* 配置設定 */}
                      <div className="space-y-4 border-t pt-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">水平方向の配置</label>
                          <ToggleGroup
                            type="single"
                            value={selectedTextBoxId ? textBoxes.find(tb => tb.id === selectedTextBoxId)?.horizontalAlign || 'left' : 'left'}
                            onValueChange={(value) => {
                              if (value && selectedTextBoxId) {
                                setTextBoxes(prev => 
                                  prev.map(tb => 
                                    tb.id === selectedTextBoxId 
                                      ? { ...tb, horizontalAlign: value as 'left' | 'center' | 'right' }
                                      : tb
                                  )
                                )
                                // Canvas再描画をトリガー
                                setTimeout(() => redrawCanvas(), 100)
                              }
                            }}
                            className="justify-start"
                          >
                            <ToggleGroupItem value="left" aria-label="左揃え">
                              <AlignLeft className="h-4 w-4" />
                            </ToggleGroupItem>
                            <ToggleGroupItem value="center" aria-label="中央揃え">
                              <AlignCenter className="h-4 w-4" />
                            </ToggleGroupItem>
                            <ToggleGroupItem value="right" aria-label="右揃え">
                              <AlignRight className="h-4 w-4" />
                            </ToggleGroupItem>
                          </ToggleGroup>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">垂直方向の配置</label>
                          <ToggleGroup
                            type="single"
                            value={selectedTextBoxId ? textBoxes.find(tb => tb.id === selectedTextBoxId)?.verticalAlign || 'top' : 'top'}
                            onValueChange={(value) => {
                              if (value && selectedTextBoxId) {
                                setTextBoxes(prev => 
                                  prev.map(tb => 
                                    tb.id === selectedTextBoxId 
                                      ? { ...tb, verticalAlign: value as 'top' | 'center' | 'bottom' }
                                      : tb
                                  )
                                )
                                // Canvas再描画をトリガー
                                setTimeout(() => redrawCanvas(), 100)
                              }
                            }}
                            className="justify-start"
                          >
                            <ToggleGroupItem value="top" aria-label="上揃え">
                              <AlignVerticalSpaceAround className="h-4 w-4 rotate-180" />
                            </ToggleGroupItem>
                            <ToggleGroupItem value="center" aria-label="中央揃え">
                              <AlignVerticalSpaceBetween className="h-4 w-4 rotate-90" />
                            </ToggleGroupItem>
                            <ToggleGroupItem value="bottom" aria-label="下揃え">
                              <AlignVerticalSpaceAround className="h-4 w-4" />
                            </ToggleGroupItem>
                          </ToggleGroup>
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        <Button onClick={handleTextSubmit}>
                          確定 (Ctrl+Enter)
                        </Button>
                        <Button onClick={handleTextCancel} variant="outline">
                          キャンセル (Esc)
                        </Button>
                      </div>
                      <div className="text-xs text-gray-500">
                        <p>
                          <strong>数式記法:</strong> $x^2$ または \(x^2\) (インライン),
                          $$\int x dx$$ または \[\int x dx\] (ブロック)
                        </p>
                        <p>
                          <strong>書式:</strong> **太字**, *斜体*, __下線__, ~~取り消し線~~
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
