import {
  drawAnchor,
  getTextPositionFromAnchor,
  isAnchorClicked,
  renderSvgToCanvas,
} from "@/lib/textbox-canvas/canvasUtils"
import { convertTextToSvg } from "@/lib/textbox-canvas/textConversionUtils"
import type { AnchorDirection } from "@/lib/textbox-canvas/types"

import type { DrawingElement } from "../types/answerIndividualTypes"

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

export interface V4TextRenderResult {
  success: boolean
  width: number
  height: number
  anchorPosition: { x: number; y: number }
  textBounds: { x: number; y: number; width: number; height: number }
}

/**
 * DrawingElementからAnchorDirectionを取得する
 * anchorDirectionが未設定の場合はデフォルト値を返す
 */
function getAnchorDirection(element: DrawingElement): AnchorDirection {
  return element.anchorDirection ?? "top-left"
}

/**
 * V4テキスト要素をCanvasに描画する
 * @param ctx Canvas描画コンテキスト
 * @param element 描画する要素
 * @param canvasWidth Canvasの幅
 * @param canvasHeight Canvasの高さ
 * @param isSelected 選択状態かどうか
 * @param showAnchor アンカーを表示するかどうか
 * @param opacity 透明度（0.0-1.0）
 * @returns 描画結果
 */
export async function renderTextElementV4(
  ctx: CanvasRenderingContext2D,
  element: DrawingElement,
  canvasWidth: number,
  canvasHeight: number,
  isSelected: boolean = false,
  showAnchor: boolean = true,
  opacity: number = 1.0
): Promise<V4TextRenderResult> {
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
    const anchorDirection = getAnchorDirection(element)
    const textColor = element.color || "#000000"
    const fontSize = element.fontSize ?? 16

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

/**
 * テキスト要素のアンカーがクリックされたかどうかを判定する
 */
export function isTextAnchorClicked(
  mouseX: number,
  mouseY: number,
  element: DrawingElement,
  canvasWidth: number,
  canvasHeight: number
): boolean {
  if (element.type !== "text") return false

  const anchorX = element.x * canvasWidth
  const anchorY = element.y * canvasHeight

  return isAnchorClicked(mouseX, mouseY, anchorX, anchorY)
}

/**
 * 複数のV4テキスト要素をCanvasに描画する
 */
export async function renderTextElementsV4(
  ctx: CanvasRenderingContext2D,
  elements: DrawingElement[],
  canvasWidth: number,
  canvasHeight: number,
  selectedElementIds: string[] = []
): Promise<V4TextRenderResult[]> {
  const results: V4TextRenderResult[] = []
  const textElements = elements.filter((el) => el.type === "text" && el.text)

  for (const element of textElements) {
    const isSelected = selectedElementIds.includes(element.id)
    const result = await renderTextElementV4(
      ctx,
      element,
      canvasWidth,
      canvasHeight,
      isSelected
    )
    results.push(result)
  }

  return results
}

/**
 * テキスト要素のヒットテストを行う
 * @returns "anchor" | "text" | null
 */
export function hitTestTextElement(
  mouseX: number,
  mouseY: number,
  element: DrawingElement,
  canvasWidth: number,
  canvasHeight: number,
  renderResult?: V4TextRenderResult
): "anchor" | "text" | null {
  if (element.type !== "text") return null

  if (isTextAnchorClicked(mouseX, mouseY, element, canvasWidth, canvasHeight)) {
    return "anchor"
  }

  if (renderResult && renderResult.success) {
    const { x, y, width, height } = renderResult.textBounds
    if (
      mouseX >= x &&
      mouseX <= x + width &&
      mouseY >= y &&
      mouseY <= y + height
    ) {
      return "text"
    }
  }

  return null
}
