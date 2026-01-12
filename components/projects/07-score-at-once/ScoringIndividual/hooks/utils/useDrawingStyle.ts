/**
 * @fileoverview 描画スタイルフック
 * 線種（実線・波線・ジグザグ・二重線）の描画機能を提供
 */
import { useCallback } from "react"

import type { LineStyle } from "@/components/projects/07-score-at-once/ScoringIndividual/types/answerIndividualTypes"

/**
 * 描画スタイルフック
 *
 * @description
 * 様々な線種（solid, wave, zigzag, double）を
 * Canvasに描画するためのユーティリティを提供する。
 *
 * @returns 描画スタイル関数
 */
export function useDrawingStyleUtils() {
  /**
   * 指定されたスタイルで線を描画
   *
   * @param ctx - Canvasコンテキスト
   * @param x1 - 開始点X座標
   * @param y1 - 開始点Y座標
   * @param x2 - 終了点X座標
   * @param y2 - 終了点Y座標
   * @param style - 線のスタイル
   * @param strokeWidth - 線の太さ
   */
  const drawLineWithStyle = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      style: LineStyle,
      strokeWidth: number
    ) => {
      const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
      const angle = Math.atan2(y2 - y1, x2 - x1)

      ctx.save()
      ctx.translate(x1, y1)
      ctx.rotate(angle)

      switch (style) {
        case "solid":
          ctx.setLineDash([])
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.lineTo(length, 0)
          ctx.stroke()
          break
        case "wave": {
          ctx.setLineDash([])
          ctx.beginPath()
          ctx.moveTo(0, 0)
          const waveHeight = strokeWidth * 2
          const waveLength = 20
          for (let i = 0; i <= length; i += 2) {
            const y = Math.sin((i / waveLength) * Math.PI * 2) * waveHeight
            ctx.lineTo(i, y)
          }
          ctx.stroke()
          break
        }
        case "zigzag": {
          ctx.setLineDash([])
          ctx.beginPath()
          ctx.moveTo(0, 0)
          const zigHeight = strokeWidth * 3
          const zigLength = 15
          for (let i = 0; i <= length; i += zigLength) {
            const y = (i / zigLength) % 2 === 0 ? 0 : zigHeight
            ctx.lineTo(i, y)
          }
          ctx.lineTo(length, 0)
          ctx.stroke()
          break
        }
        case "double": {
          ctx.setLineDash([])
          const offset = strokeWidth + 2
          ctx.beginPath()
          ctx.moveTo(0, -offset / 2)
          ctx.lineTo(length, -offset / 2)
          ctx.moveTo(0, offset / 2)
          ctx.lineTo(length, offset / 2)
          ctx.stroke()
          break
        }
      }

      ctx.restore()
    },
    []
  )

  return {
    drawLineWithStyle,
  }
}
