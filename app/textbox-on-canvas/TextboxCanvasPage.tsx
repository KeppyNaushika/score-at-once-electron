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

import React, { useRef, useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// 型定義とインターフェース
import type { TextBox, Point, DragState } from "./types"

// 定数
import { SAMPLE_IMAGE_URL } from "./constants"

// ユーティリティ関数群
import { convertTextToSvg } from "./utils/textConversionUtils"
import {
  renderSvgToCanvas,
  setupDebugPreview,
  drawTextBoxBorder,
  drawCreatingTextBox,
  drawBackgroundImage,
  type DebugPreviewState,
} from "./utils/canvasUtils"
import {
  getCanvasCoordinates,
  findTextBoxAtPoint,
  createTextBoxFromDrag,
  updateTextBoxSelection,
  updateTextBoxContent,
  isValidDragForTextBox,
} from "./utils/coordinateUtils"

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

  // デバッグプレビュー状態
  const [debugSvgDataUrl, setDebugSvgDataUrl] = useState<string | null>(null)
  const [debugSvgInfo, setDebugSvgInfo] = useState<string>("")

  /**
   * デバッグ状態管理オブジェクト
   */
  const debugState: DebugPreviewState = {
    setSvgDataUrl: setDebugSvgDataUrl,
    setSvgInfo: setDebugSvgInfo,
  }

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

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      try {
        setStatus("数式を描画中...")

        // ReactMarkdown + MathJaxでSVG変換
        const svgElement = await convertTextToSvg(text, width, height)

        if (svgElement) {
          // SVG描画を試行（高品質レンダリング）
          const result = await renderSvgToCanvas(
            svgElement,
            ctx,
            x,
            y,
            width,
            height,
          )

          if (result.width > 0 && result.height > 0) {
            setStatus("描画完了")
            return // 成功した場合は終了
          }
        }

        // フォールバック処理は省略（通常は上記で成功）
        setStatus("描画失敗")
      } catch (error) {
        console.error("テキスト描画エラー:", error)
        setStatus("描画エラー")
      }
    },
    [],
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
              <div className="text-xs text-gray-600 bg-gray-50 rounded-md p-3 border">
                <div className="font-medium mb-2">要素情報リスト ({textBoxes.length}個)</div>
                {textBoxes.length === 0 ? (
                  <div className="text-gray-400 italic">テキストボックスが作成されていません</div>
                ) : (
                  <div className="space-y-1">
                    {textBoxes.map((textBox) => (
                      <div
                        key={textBox.id}
                        className={`flex items-center justify-between p-2 rounded ${
                          textBox.isSelected 
                            ? 'bg-blue-100 border border-blue-200' 
                            : 'bg-white border border-gray-200'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-xs text-gray-500 mb-1">
                            ID: {textBox.id.substring(0, 8)}...
                          </div>
                          <div className="text-xs">
                            <span className="inline-block mr-3">
                              位置: ({Math.round(textBox.x)}, {Math.round(textBox.y)})
                            </span>
                            <span className="inline-block">
                              サイズ: {Math.round(textBox.width)} × {Math.round(textBox.height)}
                            </span>
                          </div>
                          {textBox.text && (
                            <div className="text-xs text-gray-700 mt-1 truncate">
                              内容: {textBox.text.substring(0, 50)}{textBox.text.length > 50 ? '...' : ''}
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0 ml-2">
                          {textBox.isSelected && (
                            <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded">
                              選択中
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Red Border Debug Information */}
              <div className="text-xs text-gray-600 bg-red-50 rounded-md p-3 border border-red-200">
                <div className="font-medium mb-2">🔴 赤枠サイズ情報</div>
                <div id="red-border-display" className="space-y-2">
                  <div className="text-gray-400 italic">テキストボックスにテキストを入力すると赤枠サイズが表示されます</div>
                </div>
              </div>

              {/* Font Metrics Debug Information */}
              <div className="text-xs text-gray-600 bg-yellow-50 rounded-md p-3 border border-yellow-200">
                <div className="font-medium mb-2">📐 フォントメトリクス詳細</div>
                <div id="font-metrics-display" className="space-y-2">
                  <div className="text-gray-400 italic">テキストボックスを作成・編集するとメトリクスが表示されます</div>
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
                          <strong>数式記法:</strong> インライン数式: $x^2$,
                          ブロック数式: $$\int x dx$$
                        </p>
                        <p>
                          <strong>書式:</strong> **太字**, *斜体*,
                          リスト記法も利用可能
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* デバッグプレビュー */}
              {debugSvgDataUrl && (
                <Card className="border-green-200 bg-green-50">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      生成されたSVGプレビュー
                    </CardTitle>
                    <p className="text-sm text-green-700">{debugSvgInfo}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded border-2 border-green-200 bg-white p-4">
                      <img
                        src={debugSvgDataUrl}
                        alt="Generated SVG Preview"
                        className="max-w-full"
                        style={{ display: "block" }}
                      />
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
