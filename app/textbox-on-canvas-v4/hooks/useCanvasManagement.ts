/**
 * @fileoverview Canvas管理カスタムフック
 * @description Canvas操作と描画管理のロジックを集約
 */

"use client"

import { useCallback, useRef, useState } from "react"
import type { TextBox } from "../types"
import { drawBackgroundImage, renderSvgToCanvas, drawTextBoxBorder, drawCreatingTextBox } from "../utils/canvasUtils"
import { convertTextToSvg } from "../utils/textConversionUtils"

/**
 * Canvas管理フック
 */
export function useCanvasManagement() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<string>("待機中")

  /**
   * テキストをCanvasに描画する
   */
  const renderTextToCanvas = useCallback(
    async (
      text: string,
      x: number,
      y: number,
      width: number,
      height: number,
      horizontalAlign: 'left' | 'center' | 'right' = 'left',
      verticalAlign: 'top' | 'center' | 'bottom' = 'top'
    ): Promise<void> => {
      const canvas = canvasRef.current
      if (!canvas || !text.trim()) return

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      try {
        setStatus("SVG生成中...")
        const svgElement = await convertTextToSvg(
          text,
          width,
          height,
          horizontalAlign,
          verticalAlign
        )

        if (svgElement) {
          setStatus("Canvas描画中...")
          await renderSvgToCanvas(svgElement, ctx, x, y, width, height)
          setStatus("描画完了")
        } else {
          setStatus("SVG生成失敗")
        }
      } catch (error) {
        console.error("Canvas描画エラー:", error)
        setStatus("描画エラー")
      }
    },
    []
  )

  /**
   * Canvas全体を再描画
   */
  const redrawCanvas = useCallback(
    async (
      textBoxes: TextBox[],
      currentDrag: any,
      isCreatingTextBox: boolean,
      backgroundImageUrl?: string
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

        // テキストボックスを描画
        for (const textBox of textBoxes) {
          // テキストボックス枠を描画
          drawTextBoxBorder(
            ctx,
            textBox.x,
            textBox.y,
            textBox.width,
            textBox.height,
            textBox.isSelected
          )

          // テキスト内容を描画
          if (textBox.text) {
            await renderTextToCanvas(
              textBox.text,
              textBox.x,
              textBox.y,
              textBox.width,
              textBox.height,
              textBox.horizontalAlign || 'left',
              textBox.verticalAlign || 'top'
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
    },
    [renderTextToCanvas]
  )

  return {
    canvasRef,
    status,
    renderTextToCanvas,
    redrawCanvas
  }
}