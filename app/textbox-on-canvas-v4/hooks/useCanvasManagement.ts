/**
 * @fileoverview Canvas管理カスタムフック
 * @description Canvas操作と描画管理のロジックを集約
 */

"use client"

import { useCallback, useRef, useState } from "react"
import type { AnchorDirection, TextBox } from "../types"
import {
  drawAnchor,
  drawBackgroundImage,
  getTextPositionFromAnchor,
  renderSvgToCanvas,
} from "../utils/canvasUtils"
import { convertTextToSvg } from "../utils/textConversionUtils"

/**
 * Canvas管理フック
 */
export function useCanvasManagement() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<string>("待機中")

  /**
   * テキストをCanvasに描画する（アンカーベース）
   */
  const renderTextToCanvas = useCallback(
    async (
      text: string,
      anchorX: number,
      anchorY: number,
      anchorDirection: AnchorDirection,
      textSize: number,
    ): Promise<void> => {
      const canvas = canvasRef.current
      if (!canvas || !text.trim()) return

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      try {
        setStatus("SVG生成中...")

        // テキストサイズに基づいて適切な描画サイズを計算
        const estimatedWidth = text.length * textSize * 0.6
        const estimatedHeight = textSize * 1.2

        const svgElement = await convertTextToSvg(
          text,
          estimatedWidth,
          estimatedHeight,
          "left",
          "top",
          textSize,
        )

        if (svgElement) {
          setStatus("Canvas描画中...")

          // アンカー方向に基づいて描画位置を計算
          const textPosition = getTextPositionFromAnchor(
            anchorX,
            anchorY,
            estimatedWidth,
            estimatedHeight,
            anchorDirection,
          )

          await renderSvgToCanvas(
            svgElement,
            ctx,
            textPosition.x,
            textPosition.y,
            estimatedWidth,
            estimatedHeight,
          )
          setStatus("描画完了")
        } else {
          setStatus("SVG生成失敗")
        }
      } catch (error) {
        console.error("Canvas描画エラー:", error)
        setStatus("描画エラー")
      }
    },
    [],
  )

  /**
   * Canvas全体を再描画（アンカーベース）
   */
  const redrawCanvas = useCallback(
    async (
      textBoxes: TextBox[],
      currentDrag: any,
      isCreatingAnchor: boolean,
      backgroundImageUrl?: string,
    ): Promise<void> => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      try {
        setStatus("Canvas再描画中...")

        // Canvas全体をクリア
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = "white"
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // 背景画像を描画
        if (backgroundImageUrl) {
          await drawBackgroundImage(ctx, backgroundImageUrl)
        }

        // テキストボックスとアンカーを描画
        for (const textBox of textBoxes) {
          // アンカー点を描画
          drawAnchor(ctx, textBox.x, textBox.y, textBox.isSelected)

          // テキスト内容を描画
          if (textBox.text) {
            await renderTextToCanvas(
              textBox.text,
              textBox.x,
              textBox.y,
              textBox.anchorDirection,
              textBox.textSize,
            )
          }
        }

        setStatus("描画完了")
      } catch (error) {
        console.error("Canvas再描画エラー:", error)
        setStatus("描画エラー")
      }
    },
    [renderTextToCanvas],
  )

  return {
    canvasRef,
    status,
    renderTextToCanvas,
    redrawCanvas,
  }
}
