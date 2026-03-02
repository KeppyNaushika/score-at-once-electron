/**
 * @fileoverview 個別採点画面用の拡張Canvasプレビューコンポーネント
 * @description テキスト全体表示・背景画像対応のCanvasプレビュー
 */

"use client"

import { useEffect, useRef, useState } from "react"

import type { TextBox } from "../../../../app/textbox-on-canvas-v4/types"
import {
  drawBackgroundImage,
  renderSvgToCanvas,
} from "../../../../app/textbox-on-canvas-v4/utils/canvasUtils"
import { convertTextToSvg } from "../../../../app/textbox-on-canvas-v4/utils/textConversionUtils"

interface EnhancedCanvasPreviewProps {
  textBox: TextBox
  backgroundImageUrl?: string
  showBackground?: boolean
}

/**
 * 拡張Canvas プレビューコンポーネント
 * - テキスト全体が表示されるように自動サイズ調整
 * - 答案画像を背景に表示可能
 */
export function EnhancedCanvasPreview({
  textBox,
  backgroundImageUrl,
  showBackground = false,
}: EnhancedCanvasPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [renderingStatus, setRenderingStatus] = useState<string>("待機中")
  const [actualSize, setActualSize] = useState<{
    width: number
    height: number
  } | null>(null)

  useEffect(() => {
    if (textBox.text && canvasRef.current) {
      const renderEnhancedPreview = async () => {
        try {
          setRenderingStatus("描画準備中...")

          const canvas = canvasRef.current!
          const ctx = canvas.getContext("2d")!

          // テキストサイズに基づいてCanvas推定サイズを計算
          const lines = textBox.text.split("\n")
          const maxLineLength = Math.max(...lines.map((line) => line.length))
          const estimatedWidth = Math.max(
            300,
            maxLineLength * textBox.textSize * 0.8
          )
          const estimatedHeight = Math.max(
            120,
            lines.length * textBox.textSize * 1.5 + 60
          )

          // Canvasサイズを動的に設定
          canvas.width = estimatedWidth
          canvas.height = estimatedHeight

          // Canvas背景をクリア
          ctx.fillStyle = "#f8f9fa"
          ctx.fillRect(0, 0, canvas.width, canvas.height)

          // 背景画像を描画（オプション）
          if (showBackground && backgroundImageUrl) {
            setRenderingStatus("背景画像描画中...")
            try {
              await drawBackgroundImage(ctx, backgroundImageUrl)
              // 半透明白オーバーレイでテキスト可読性を向上
              ctx.fillStyle = "rgba(255, 255, 255, 0.8)"
              ctx.fillRect(0, 0, canvas.width, canvas.height)
            } catch (bgError) {
              console.warn("背景画像の描画に失敗:", bgError)
              // 背景画像が失敗した場合は白背景に戻す
              ctx.fillStyle = "white"
              ctx.fillRect(0, 0, canvas.width, canvas.height)
            }
          } else {
            // 通常の白背景
            ctx.fillStyle = "white"
            ctx.fillRect(0, 0, canvas.width, canvas.height)
          }

          setRenderingStatus("SVG生成中...")

          // SVG生成（テキスト全体に対応するサイズ）
          const svgElement = await convertTextToSvg(
            textBox.text,
            estimatedWidth - 40, // マージン考慮
            estimatedHeight - 40,
            "left",
            "top",
            textBox.textSize
          )

          if (svgElement) {
            setRenderingStatus("Canvas描画中...")

            // アンカー位置を中央に設定
            const anchorX = canvas.width / 2
            const anchorY = canvas.height / 2

            // Canvas描画を実行
            const renderResult = await renderSvgToCanvas(
              svgElement,
              ctx,
              anchorX,
              anchorY,
              textBox.anchorDirection
            )

            setActualSize({
              width: renderResult.width,
              height: renderResult.height,
            })

            setRenderingStatus("描画完了")
          } else {
            setActualSize(null)
            setRenderingStatus("SVG生成失敗")
          }
        } catch (error) {
          console.error("拡張Canvasプレビュー処理エラー:", error)
          setActualSize(null)
          setRenderingStatus("描画エラー")
        }
      }

      renderEnhancedPreview()
    }
  }, [
    textBox.text,
    textBox.anchorDirection,
    textBox.textSize,
    backgroundImageUrl,
    showBackground,
  ])

  return (
    <div className="rounded border border-blue-300 bg-white p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-gray-600">
        <span>
          プレビューサイズ:{" "}
          {actualSize
            ? `${Math.round(actualSize.width)} × ${Math.round(actualSize.height)}px`
            : "計算中..."}
        </span>
        <span>
          背景: {showBackground && backgroundImageUrl ? "答案画像" : "白背景"}
        </span>
      </div>

      <div className="flex justify-center rounded border border-gray-200 bg-gray-50 p-2">
        <canvas
          ref={canvasRef}
          className="max-w-full rounded border border-gray-100 shadow-sm"
          style={{
            maxHeight: "300px",
            objectFit: "contain",
            backgroundColor: "white",
          }}
        />
      </div>

      <div className="mt-2 flex justify-between text-xs text-gray-500">
        <span>ステータス: {renderingStatus}</span>
        <span>
          テキスト: {textBox.text.length}文字 /{" "}
          {textBox.text.split("\n").length}行
        </span>
      </div>
    </div>
  )
}
