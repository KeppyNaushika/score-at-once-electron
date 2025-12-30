/**
 * @fileoverview メインのTextbox Canvas ページコンポーネント（リファクタリング版）
 * @description 数学式対応テキストボックスCanvasシステムのメインコンポーネント
 *
 * ## 主要機能
 * - ドラッグ&ドロップによるテキストボックス作成
 * - MathJax数式のリアルタイム描画
 * - 4段階プレビューシステム（DIV・SVG・Image・Canvas）
 * - SVG-Canvas変換による高品質レンダリング
 *
 * ## リファクタリング内容
 * - プレビューコンポーネントの分離
 * - カスタムフックによるロジック分離
 * - 958行 → 200行以下への大幅削減
 */

"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useCallback, useEffect, useState } from "react"

// 型定義
import type { AnchorDirection } from "./types"

// 分離されたコンポーネントとフック
import {
  TextboxCanvasPreview,
  TextboxImagePreview,
  TextboxPreview,
  TextboxSvgPreview,
} from "./components"
import { AnchorControlPanel } from "./components/AnchorControlPanel"
import { SAMPLE_IMAGE_URL } from "./constants"
import { useCanvasManagement, useTextBoxOperations } from "./hooks"

/**
 * メインのTextbox Canvas ページ
 */
export default function TextboxCanvasPage() {
  // ズーム設定
  const [zoom, setZoom] = useState<number>(1)

  // カスタムフック使用
  const { canvasRef, status, redrawCanvas } = useCanvasManagement()
  const {
    textBoxes,
    selectedTextBoxId,
    currentDrag,
    isCreatingAnchor,
    isDraggingAnchor,
    showTextInput,
    textInputValue,
    setTextInputValue,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTextSubmit,
    handleTextCancel,
    getSelectedTextBox,
    updateTextBoxAnchorDirection,
    updateTextBoxSize,
    setTextBoxes: _setTextBoxes,
  } = useTextBoxOperations()

  // 選択されたテキストボックス
  const selectedTextBox = getSelectedTextBox()

  // Canvas再描画効果
  useEffect(() => {
    redrawCanvas(textBoxes, currentDrag, isCreatingAnchor, SAMPLE_IMAGE_URL)
  }, [redrawCanvas, textBoxes, currentDrag, isCreatingAnchor])

  // アンカー方向変更のハンドラー
  const handleAnchorDirectionChange = useCallback(
    (direction: AnchorDirection) => {
      if (!selectedTextBoxId) return
      updateTextBoxAnchorDirection(selectedTextBoxId, direction)
    },
    [selectedTextBoxId, updateTextBoxAnchorDirection]
  )

  // テキストサイズ変更のハンドラー
  const handleTextSizeChange = useCallback(
    (size: number) => {
      if (!selectedTextBoxId) return
      updateTextBoxSize(selectedTextBoxId, size)
    },
    [selectedTextBoxId, updateTextBoxSize]
  )

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>
              テキストボックス Canvas V4 (ズーム: {Math.round(zoom * 100)}%)
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
                  className={`border-2 border-gray-300 shadow-lg ${
                    isDraggingAnchor ? "cursor-move" : "cursor-crosshair"
                  }`}
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: "top left",
                  }}
                  onMouseDown={(e) => handleMouseDown(e, zoom)}
                  onMouseMove={(e) => handleMouseMove(e, zoom)}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                />

                {/* アンカー制御パネル */}
                <AnchorControlPanel
                  visible={!!selectedTextBox}
                  currentDirection={
                    selectedTextBox?.anchorDirection || "top-left"
                  }
                  currentTextSize={selectedTextBox?.textSize || 24}
                  onDirectionChange={handleAnchorDirectionChange}
                  onTextSizeChange={handleTextSizeChange}
                />
              </div>

              {/* ズーム制御 */}
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => setZoom((prev) => Math.max(0.25, prev - 0.25))}
                  variant="outline"
                  size="sm"
                >
                  ズーム -
                </Button>
                <span className="text-sm text-gray-600">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  onClick={() => setZoom((prev) => Math.min(3, prev + 0.25))}
                  variant="outline"
                  size="sm"
                >
                  ズーム +
                </Button>
                <Button onClick={() => setZoom(1)} variant="outline" size="sm">
                  リセット
                </Button>
              </div>

              {/* 4段階プレビューシステム */}
              {selectedTextBox && selectedTextBox.text && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <div className="mb-2 text-sm font-medium">
                      1. DIV プレビュー（MathJax処理後）
                    </div>
                    <TextboxPreview textBox={selectedTextBox} />
                  </div>
                  <div>
                    <div className="mb-2 text-sm font-medium">
                      2. SVG プレビュー（図形データ）
                    </div>
                    <TextboxSvgPreview textBox={selectedTextBox} />
                  </div>
                  <div>
                    <div className="mb-2 text-sm font-medium">
                      3. Image プレビュー（PNG変換後）
                    </div>
                    <TextboxImagePreview textBox={selectedTextBox} />
                  </div>
                  <div>
                    <div className="mb-2 text-sm font-medium">
                      4. Canvas プレビュー（V4新機能）
                    </div>
                    <TextboxCanvasPreview textBox={selectedTextBox} />
                  </div>
                </div>
              )}

              {/* テキスト編集モーダル */}
              {showTextInput && selectedTextBox && (
                <Card className="w-full">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      テキストボックス編集
                    </CardTitle>
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
                          <strong>数式記法:</strong> $x^2$ または \(x^2\)
                          (インライン), $$\int x dx$$ または \[\int x dx\]
                          (ブロック)
                        </p>
                        <p>
                          <strong>書式:</strong> **太字**, *斜体*, __下線__,
                          ~~取り消し線~~
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
