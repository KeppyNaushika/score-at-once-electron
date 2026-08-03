import {
  drawAnchor,
  getTextPositionFromAnchor,
  renderSvgToCanvas,
} from "@/lib/textbox-canvas/canvasUtils"
import { convertTextToSvg } from "@/lib/textbox-canvas/textConversionUtils"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

/** SVGキャッシュ（elementId → {text, color, fontSize, svg}） */
const svgCache = new Map<
  string,
  { text: string; color: string; fontSize: number; svg: SVGSVGElement }
>()

/**
 * SVGキャッシュをクリアする
 * @param elementId 特定の要素のみクリアする場合はそのID
 */
export function clearSvgCache(elementId?: string): void {
  if (elementId) {
    svgCache.delete(elementId)
  } else {
    svgCache.clear()
  }
}

/**
 * キャッシュからSVGを取得する
 */
function getCachedSvg(
  elementId: string,
  text: string,
  color: string,
  fontSize: number
): SVGSVGElement | null {
  const cached = svgCache.get(elementId)
  if (
    cached &&
    cached.text === text &&
    cached.color === color &&
    cached.fontSize === fontSize
  ) {
    return cached.svg.cloneNode(true) as SVGSVGElement
  }
  return null
}

/**
 * SVGをキャッシュに保存する
 */
function cacheSvg(
  elementId: string,
  text: string,
  color: string,
  fontSize: number,
  svg: SVGSVGElement
): void {
  svgCache.set(elementId, {
    text,
    color,
    fontSize,
    svg: svg.cloneNode(true) as SVGSVGElement,
  })
}

interface TextRenderResult {
  success: boolean
  width: number
  height: number
  anchorPosition: { x: number; y: number }
  textBounds: { x: number; y: number; width: number; height: number }
}

/**
 * テキスト要素をCanvasに描画する
 * @param ctx Canvas描画コンテキスト
 * @param element 描画する要素
 * @param canvasWidth Canvasの幅
 * @param canvasHeight Canvasの高さ
 * @param isSelected 選択状態かどうか
 * @param showAnchor アンカーを表示するかどうか
 * @param opacity 透明度（0.0-1.0）
 * @returns 描画結果
 */
export async function renderTextElement(
  ctx: CanvasRenderingContext2D,
  element: DrawingAnnotation,
  canvasWidth: number,
  canvasHeight: number,
  isSelected: boolean = false,
  showAnchor: boolean = true,
  opacity: number = 1.0
): Promise<TextRenderResult> {
  try {
    if (element.type !== "text" || !element.text) {
      return {
        success: false,
        width: 0,
        height: 0,
        anchorPosition: { x: 0, y: 0 },
        textBounds: { x: 0, y: 0, width: 0, height: 0 },
      }
    }

    const anchorX = element.x * canvasWidth
    const anchorY = element.y * canvasHeight
    const anchorDirection = element.anchorDirection
    const textColor = element.color
    const fontSize = element.fontSize

    let svgElement = getCachedSvg(element.id, element.text, textColor, fontSize)

    if (!svgElement) {
      svgElement = await convertTextToSvg(
        element.text,
        canvasWidth,
        canvasHeight,
        "left",
        "top",
        fontSize,
        textColor
      )

      if (svgElement) {
        cacheSvg(element.id, element.text, textColor, fontSize, svgElement)
      }
    }

    if (!svgElement) {
      return {
        success: false,
        width: 0,
        height: 0,
        anchorPosition: { x: anchorX, y: anchorY },
        textBounds: { x: 0, y: 0, width: 0, height: 0 },
      }
    }

    const renderResult = await renderSvgToCanvas(
      svgElement,
      ctx,
      anchorX,
      anchorY,
      anchorDirection,
      showAnchor,
      opacity
    )

    const textPosition = getTextPositionFromAnchor(
      anchorX,
      anchorY,
      renderResult.width,
      renderResult.height,
      anchorDirection
    )

    if (showAnchor) {
      await drawAnchor(ctx, anchorX, anchorY, isSelected)
    }

    return {
      success: renderResult.width > 0 && renderResult.height > 0,
      width: renderResult.width,
      height: renderResult.height,
      anchorPosition: { x: anchorX, y: anchorY },
      textBounds: {
        x: textPosition.x,
        y: textPosition.y,
        width: renderResult.width,
        height: renderResult.height,
      },
    }
  } catch {
    return {
      success: false,
      width: 0,
      height: 0,
      anchorPosition: {
        x: element.x * canvasWidth,
        y: element.y * canvasHeight,
      },
      textBounds: { x: 0, y: 0, width: 0, height: 0 },
    }
  }
}
