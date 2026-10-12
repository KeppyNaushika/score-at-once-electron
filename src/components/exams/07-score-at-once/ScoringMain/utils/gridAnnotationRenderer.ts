/**
 * 一覧（グリッド）の切り抜き画像に、手書き注釈を描く
 *
 * 個別表示のキャンバス（ScoringIndividual/utils/drawMainCanvas）と違い、
 * 切り抜いた範囲だけを描くので、座標は切り抜き範囲に対する比で写す。
 */
import {
  type CanvasRectangle,
  drawAnnotationEllipse,
  drawAnnotationLine,
  drawAnnotationRectangle,
} from "@/lib/annotationShapeCanvas"
import { PAPER_DIMENSIONS } from "@/lib/paperSize"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

import { renderTextElement } from "../../ScoringIndividual/utils/canvasTextRenderer"

/**
 * Grid表示用アノテーション描画
 * アノテーションの0-1相対座標をクロップ領域→Canvasピクセル座標に変換して描画
 * テキストはrenderTextElementを使用してMathJax対応
 */
export async function drawGridAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: DrawingAnnotation[],
  visibleX: number,
  visibleY: number,
  visibleWidth: number,
  visibleHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  imageNaturalWidth: number,
  imageNaturalHeight: number,
  isCancelled: () => boolean,
  pageSize?: string
) {
  // mm→用紙幅比率→canvasピクセルに変換するためのスケール
  // anno.strokeWidth (mm) → anno.strokeWidth / paperWidthMm → × canvasWidth / visibleWidth
  const paper = PAPER_DIMENSIONS[pageSize ?? "A4"] ?? PAPER_DIMENSIONS.A4
  const isLandscape = imageNaturalWidth > imageNaturalHeight
  const paperWidthMm = isLandscape ? paper.height : paper.width
  const scaleFactor = canvasWidth / (visibleWidth * paperWidthMm)

  for (const anno of annotations) {
    if (isCancelled()) return

    ctx.save()
    ctx.strokeStyle = anno.color
    ctx.fillStyle = anno.color
    ctx.lineWidth = anno.strokeWidth * scaleFactor

    switch (anno.type) {
      case "text":
        await drawGridText(
          ctx,
          anno,
          visibleX,
          visibleY,
          visibleWidth,
          visibleHeight,
          canvasWidth,
          canvasHeight,
          scaleFactor
        )
        break
      case "line":
        drawGridLine(
          ctx,
          anno,
          visibleX,
          visibleY,
          visibleWidth,
          visibleHeight,
          canvasWidth,
          canvasHeight,
          scaleFactor
        )
        break
      case "rectangle":
        drawAnnotationRectangle(
          ctx,
          toCanvasRectangle(
            anno,
            visibleX,
            visibleY,
            visibleWidth,
            visibleHeight,
            canvasWidth,
            canvasHeight
          )
        )
        break
      case "ellipse":
        drawAnnotationEllipse(
          ctx,
          toCanvasRectangle(
            anno,
            visibleX,
            visibleY,
            visibleWidth,
            visibleHeight,
            canvasWidth,
            canvasHeight
          )
        )
        break
    }

    ctx.restore()
  }
}

/** 0-1相対座標→Canvasピクセル座標に変換 */
function toCanvasX(
  annoX: number,
  visibleX: number,
  visibleWidth: number,
  canvasWidth: number
): number {
  return ((annoX - visibleX) / visibleWidth) * canvasWidth
}

function toCanvasY(
  annoY: number,
  visibleY: number,
  visibleHeight: number,
  canvasHeight: number
): number {
  return ((annoY - visibleY) / visibleHeight) * canvasHeight
}

/**
 * テキスト描画（テキストレンダラー使用: MathJax/SVG対応）
 */
async function drawGridText(
  ctx: CanvasRenderingContext2D,
  anno: DrawingAnnotation,
  visibleX: number,
  visibleY: number,
  visibleWidth: number,
  visibleHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  scaleFactor: number
) {
  if (!anno.text) return

  // renderTextElementは element.x * canvasWidth でアンカーピクセル位置を計算するため、
  // Grid Canvas空間での0-1座標へ載せ替えた行を渡す（列は落とさない）
  const element: DrawingAnnotation = {
    ...anno,
    id: `grid-${anno.id}`,
    x: (anno.x - visibleX) / visibleWidth,
    y: (anno.y - visibleY) / visibleHeight,
    fontSize: anno.fontSize * scaleFactor,
  }

  await renderTextElement(
    ctx,
    element,
    canvasWidth,
    canvasHeight,
    false, // isSelected
    false, // showAnchor
    1.0 // opacity
  )
}

/** 線描画（全lineStyle対応。形は annotationShapeCanvas が描く） */
function drawGridLine(
  ctx: CanvasRenderingContext2D,
  anno: DrawingAnnotation,
  visibleX: number,
  visibleY: number,
  visibleWidth: number,
  visibleHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  scaleFactor: number
) {
  drawAnnotationLine(
    ctx,
    {
      startX: toCanvasX(anno.x, visibleX, visibleWidth, canvasWidth),
      startY: toCanvasY(anno.y, visibleY, visibleHeight, canvasHeight),
      endX: toCanvasX(anno.endX, visibleX, visibleWidth, canvasWidth),
      endY: toCanvasY(anno.endY, visibleY, visibleHeight, canvasHeight),
    },
    anno.lineStyle,
    anno.strokeWidth * scaleFactor
  )
}

/** 矩形・楕円の外接矩形を Canvas ピクセルへ写す */
function toCanvasRectangle(
  anno: DrawingAnnotation,
  visibleX: number,
  visibleY: number,
  visibleWidth: number,
  visibleHeight: number,
  canvasWidth: number,
  canvasHeight: number
): CanvasRectangle {
  return {
    x: toCanvasX(anno.x, visibleX, visibleWidth, canvasWidth),
    y: toCanvasY(anno.y, visibleY, visibleHeight, canvasHeight),
    width: (anno.width / visibleWidth) * canvasWidth,
    height: (anno.height / visibleHeight) * canvasHeight,
  }
}
