/**
 * @fileoverview Canvasプレビューコンポーネント
 * @description Canvas描画結果をプレビュー表示
 */

"use client"

import React, { useEffect, useRef, useState } from "react"
import type { TextBox } from "../types"
import { convertTextToSvg } from "../utils/textConversionUtils"
import { renderSvgToCanvas, drawBackgroundImage } from "../utils/canvasUtils"

/**
 * Canvas プレビューコンポーネント（V4新機能）
 * 実際のCanvas描画結果をプレビュー表示
 */
export function TextboxCanvasPreview({ textBox }: { textBox: TextBox }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [renderingStatus, setRenderingStatus] = useState<string>("待機中")
  const [canvasSize, setCanvasSize] = useState<{width: number, height: number} | null>(null)

  useEffect(() => {
    if (textBox.text && canvasRef.current) {
      const renderCanvasPreview = async () => {
        try {
          setRenderingStatus("Canvas描画中...")
          
          const canvas = canvasRef.current!
          const ctx = canvas.getContext('2d')!
          
          // Canvas背景をクリア
          ctx.fillStyle = 'white'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          
          // SVGプレビューと**全く同じSVG生成処理**
          const svgElement = await convertTextToSvg(
            textBox.text, 
            textBox.width, 
            textBox.height, 
            textBox.horizontalAlign || 'left', 
            textBox.verticalAlign || 'top'
          )

          if (svgElement) {
            // Canvas描画を実行
            const renderResult = await renderSvgToCanvas(
              svgElement,
              ctx,
              10, // 左マージン
              10, // 上マージン
              canvas.width - 20, // 表示幅（左右マージン考慮）
              canvas.height - 20 // 表示高さ（上下マージン考慮）
            )
            
            setCanvasSize({
              width: renderResult.width,
              height: renderResult.height
            })
            setRenderingStatus("Canvas描画完了")
          } else {
            setCanvasSize(null)
            setRenderingStatus("SVG生成失敗")
          }

        } catch (error) {
          console.error("Canvasプレビュー処理エラー:", error)
          setCanvasSize(null)
          setRenderingStatus("Canvas描画エラー")
        }
      }

      renderCanvasPreview()
    }
  }, [textBox.text, textBox.width, textBox.height, textBox.horizontalAlign, textBox.verticalAlign])

  return (
    <div className="border border-purple-300 rounded p-2 bg-white">
      <div className="text-xs text-gray-500 mb-1">
        ID: {textBox.id.substring(0, 8)}... | Canvas描画サイズ: {canvasSize ? `${Math.round(canvasSize.width)} × ${Math.round(canvasSize.height)}` : 'N/A'}
      </div>
      <div className="border border-gray-200 rounded p-2 bg-white min-h-[80px] flex items-center justify-center">
        <canvas 
          ref={canvasRef}
          width={300}
          height={80}
          className="border border-gray-100"
          style={{ maxWidth: '100%', objectFit: 'contain' }}
        />
      </div>
      <div className="text-xs text-gray-400 mt-1 flex justify-between">
        <span>ステータス: {renderingStatus}</span>
        <span>元テキスト長: {textBox.text.length}文字</span>
      </div>
    </div>
  )
}