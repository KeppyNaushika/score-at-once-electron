/**
 * @fileoverview Canvasプレビューコンポーネント
 * @description Canvas描画結果をプレビュー表示
 */

"use client"

import { useEffect, useRef, useState } from "react"

import type { TextBox } from "../types"
import { renderSvgToCanvas } from "../utils/canvasUtils"
import { convertTextToSvg } from "../utils/textConversionUtils"

/**
 * Canvas プレビューコンポーネント（V4新機能）
 * 実際のCanvas描画結果をプレビュー表示
 */
export function TextboxCanvasPreview({ textBox }: { textBox: TextBox }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [renderingStatus, setRenderingStatus] = useState<string>("待機中")
  const [canvasSize, setCanvasSize] = useState<{
    width: number
    height: number
  } | null>(null)

  useEffect(() => {
    if (textBox.text && canvasRef.current) {
      const renderCanvasPreview = async () => {
        try {
          setRenderingStatus("Canvas描画中...")

          const canvas = canvasRef.current!
          const ctx = canvas.getContext("2d")!

          // Canvas背景をクリア
          ctx.fillStyle = "white"
          ctx.fillRect(0, 0, canvas.width, canvas.height)

          // アンカーベースのSVG生成処理
          const estimatedWidth = textBox.text.length * textBox.textSize * 0.6
          const estimatedHeight = textBox.textSize * 1.2

          const svgElement = await convertTextToSvg(
            textBox.text,
            estimatedWidth,
            estimatedHeight,
            "left",
            "top",
            textBox.textSize
          )

          if (svgElement) {
            // アンカー位置を中央に設定してプレビュー
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

            setCanvasSize({
              width: renderResult.width,
              height: renderResult.height,
            })
            setRenderingStatus("Canvas描画完了")
          } else {
            setCanvasSize(null)
            setRenderingStatus("SVG生成失敗")
          }
        } catch {
          // Canvasプレビュー処理エラー
          setCanvasSize(null)
          setRenderingStatus("Canvas描画エラー")
        }
      }

      renderCanvasPreview()
    }
  }, [textBox.text, textBox.anchorDirection, textBox.textSize])

  return (
    <div className="rounded border border-purple-300 bg-white p-2">
      <div className="mb-1 text-xs text-gray-500">
        ID: {textBox.id.substring(0, 8)}... | Canvas描画サイズ:{" "}
        {canvasSize
          ? `${Math.round(canvasSize.width)} × ${Math.round(canvasSize.height)}`
          : "N/A"}
      </div>
      <div className="flex min-h-[80px] items-center justify-center rounded border border-gray-200 bg-white p-2">
        <canvas
          ref={canvasRef}
          width={300}
          height={80}
          className="border border-gray-100"
          style={{ maxWidth: "100%", objectFit: "contain" }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-gray-400">
        <span>ステータス: {renderingStatus}</span>
        <span>元テキスト長: {textBox.text.length}文字</span>
      </div>
    </div>
  )
}
