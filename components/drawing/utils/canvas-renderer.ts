/**
 * @fileoverview キャンバス描画エンジン
 * @description アノテーションの描画とプレビュー表示を行う
 */

import type { DrawingAnnotation, DrawingCreateData, DrawingType } from "@/types/drawing-annotation.types"
import type { DrawingTool } from "@/hooks/useDrawingAnnotations"
import { CANVAS_SETTINGS } from "@/app/textbox-on-canvas-v3/constants"
import { getAbsoluteCoordinates } from "./coordinate-utils"
import { drawWaveLine, drawZigzagLine, drawArrowHead } from "./line-rendering"

/**
 * キャンバス描画パラメータ
 */
export interface CanvasDrawParams {
  /** キャンバス要素 */
  canvas: HTMLCanvasElement
  /** 背景画像 */
  backgroundImage: HTMLImageElement | null
  /** 描画済みアノテーション一覧 */
  annotations: DrawingAnnotation[]
  /** 選択中のアノテーションID */
  selectedAnnotationId: string | null
  /** 描画中フラグ */
  isDrawing: boolean
  /** 描画中のアノテーション（DrawingCreateDataの部分型） */
  drawingAnnotation: Partial<DrawingCreateData> | null
  /** 描画開始点 */
  startPoint: { x: number; y: number } | null
  /** 現在のマウス位置 */
  currentPoint: { x: number; y: number } | null
  /** 現在のツール */
  currentTool: DrawingTool
  /** 線の太さ */
  strokeWidth: number
}

/**
 * 既存アノテーションを描画
 * @param ctx キャンバスの2Dコンテキスト
 * @param canvas キャンバス要素
 * @param annotation 描画するアノテーション
 * @param isSelected 選択状態かどうか
 */
function drawAnnotation(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  annotation: DrawingAnnotation,
  isSelected: boolean,
): void {
  const absStart = getAbsoluteCoordinates(annotation.x, annotation.y, canvas)

  ctx.strokeStyle = annotation.color
  ctx.lineWidth = annotation.strokeWidth
  ctx.fillStyle = annotation.color

  // 選択状態の表示
  if (isSelected) {
    ctx.strokeStyle = CANVAS_SETTINGS.SELECTED_BORDER_COLOR
    ctx.lineWidth = annotation.strokeWidth + 2
  }

  // アノテーション種類別の描画（MathJax処理なし）
  switch (annotation.type as DrawingType) {
    case "line": {
      const absEnd = getAbsoluteCoordinates(annotation.endX, annotation.endY, canvas)

      ctx.beginPath()
      ctx.moveTo(absStart.x, absStart.y)

      // 線のスタイルに応じた描画
      switch (annotation.lineStyle) {
        case "wave":
          drawWaveLine(ctx, absStart.x, absStart.y, absEnd.x, absEnd.y)
          break
        case "zigzag":
          drawZigzagLine(ctx, absStart.x, absStart.y, absEnd.x, absEnd.y)
          break
        case "double": {
          ctx.lineTo(absEnd.x, absEnd.y)
          ctx.stroke()
          ctx.beginPath()
          const offset = annotation.strokeWidth + 2
          ctx.moveTo(absStart.x, absStart.y + offset)
          ctx.lineTo(absEnd.x, absEnd.y + offset)
          break
        }
        case "arrow":
          ctx.lineTo(absEnd.x, absEnd.y)
          ctx.stroke()
          drawArrowHead(ctx, absStart.x, absStart.y, absEnd.x, absEnd.y)
          break
        case "both_arrow":
          ctx.lineTo(absEnd.x, absEnd.y)
          ctx.stroke()
          drawArrowHead(ctx, absStart.x, absStart.y, absEnd.x, absEnd.y)
          drawArrowHead(ctx, absEnd.x, absEnd.y, absStart.x, absStart.y)
          break
        default:
          ctx.lineTo(absEnd.x, absEnd.y)
      }
      ctx.stroke()
      break
    }

    case "rectangle": {
      const absWidth = annotation.width * canvas.width
      const absHeight = annotation.height * canvas.height

      ctx.beginPath()
      ctx.rect(absStart.x, absStart.y, absWidth, absHeight)
      ctx.stroke()

      if (isSelected) {
        ctx.fillStyle = CANVAS_SETTINGS.SELECTED_BACKGROUND_COLOR
        ctx.fill()
      }
      break
    }

    case "ellipse": {
      const absWidth = annotation.width * canvas.width
      const absHeight = annotation.height * canvas.height
      const centerX = absStart.x + absWidth / 2
      const centerY = absStart.y + absHeight / 2

      ctx.beginPath()
      ctx.ellipse(
        centerX,
        centerY,
        absWidth / 2,
        absHeight / 2,
        0,
        0,
        2 * Math.PI,
      )
      ctx.stroke()

      if (isSelected) {
        ctx.fillStyle = CANVAS_SETTINGS.SELECTED_BACKGROUND_COLOR
        ctx.fill()
      }
      break
    }

    case "text": {
      // テキストボックスの境界線描画
      if (annotation.textBoxWidth > 0 && annotation.textBoxHeight > 0) {
        const absWidth = annotation.textBoxWidth * canvas.width
        const absHeight = annotation.textBoxHeight * canvas.height

        ctx.strokeStyle = isSelected
          ? CANVAS_SETTINGS.SELECTED_BORDER_COLOR
          : CANVAS_SETTINGS.UNSELECTED_BORDER_COLOR
        ctx.lineWidth = 1
        ctx.setLineDash([5, 5])
        ctx.strokeRect(absStart.x, absStart.y, absWidth, absHeight)
        ctx.setLineDash([])
      }

      // テキスト描画（シンプルなテキストレンダリング、MathJax処理なし）
      if (annotation.text) {
        ctx.fillStyle = annotation.color
        ctx.font = `${annotation.fontSize}px Arial`
        ctx.fillText(annotation.text, absStart.x, absStart.y + annotation.fontSize)
      }
      break
    }
  }
}

/**
 * 描画中のアノテーションプレビューを描画
 * @param ctx キャンバスの2Dコンテキスト
 * @param canvas キャンバス要素
 * @param startPoint 描画開始点
 * @param currentPoint 現在のマウス位置
 * @param currentTool 現在のツール
 * @param strokeWidth 線の太さ
 */
function drawDrawingPreview(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  startPoint: { x: number; y: number },
  currentPoint: { x: number; y: number },
  currentTool: DrawingTool,
  strokeWidth: number,
): void {
  const absStart = getAbsoluteCoordinates(startPoint.x, startPoint.y, canvas)
  const absCurrent = getAbsoluteCoordinates(currentPoint.x, currentPoint.y, canvas)

  ctx.strokeStyle = CANVAS_SETTINGS.CREATING_BORDER_COLOR
  ctx.lineWidth = strokeWidth
  ctx.setLineDash([5, 5])

  const width = Math.abs(absCurrent.x - absStart.x)
  const height = Math.abs(absCurrent.y - absStart.y)

  switch (currentTool) {
    case "line":
      ctx.beginPath()
      ctx.moveTo(absStart.x, absStart.y)
      ctx.lineTo(absCurrent.x, absCurrent.y)
      ctx.stroke()
      break

    case "rectangle":
      ctx.strokeRect(
        Math.min(absStart.x, absCurrent.x),
        Math.min(absStart.y, absCurrent.y),
        width,
        height,
      )
      break

    case "ellipse": {
      const centerX = (absStart.x + absCurrent.x) / 2
      const centerY = (absStart.y + absCurrent.y) / 2
      ctx.beginPath()
      ctx.ellipse(centerX, centerY, width / 2, height / 2, 0, 0, 2 * Math.PI)
      ctx.stroke()
      break
    }

    case "text":
      ctx.strokeRect(
        Math.min(absStart.x, absCurrent.x),
        Math.min(absStart.y, absCurrent.y),
        width,
        height,
      )
      break
  }

  ctx.setLineDash([])
}

/**
 * キャンバス全体を再描画
 * @param params 描画パラメータ
 */
export function redrawCanvas(params: CanvasDrawParams): void {
  const { canvas, backgroundImage, annotations, selectedAnnotationId } = params
  const { isDrawing, drawingAnnotation, startPoint, currentPoint, currentTool, strokeWidth } = params

  const ctx = canvas.getContext("2d")
  if (!ctx) return

  // キャンバスクリア
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // 背景画像描画
  if (backgroundImage) {
    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height)
  }

  // 描画アノテーション描画
  annotations.forEach((annotation) => {
    const isSelected = selectedAnnotationId === annotation.id
    drawAnnotation(ctx, canvas, annotation, isSelected)
  })

  // 現在描画中のアノテーション描画
  if (isDrawing && drawingAnnotation && startPoint && currentPoint) {
    drawDrawingPreview(ctx, canvas, startPoint, currentPoint, currentTool, strokeWidth)
  }
}
