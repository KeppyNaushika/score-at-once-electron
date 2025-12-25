import type { DrawingElement } from "../types/answer-individual-types"
import type { AnchorDirection } from "../../../../../app/textbox-on-canvas-v4/types"
import { convertTextToSvg } from "../../../../../app/textbox-on-canvas-v4/utils/textConversionUtils"
import {
  renderSvgToCanvas,
  drawAnchor,
  getTextPositionFromAnchor,
  isAnchorClicked
} from "../../../../../app/textbox-on-canvas-v4/utils/canvasUtils"

const svgCache = new Map<string, { text: string; color: string; svg: SVGSVGElement }>()

export function clearSvgCache(elementId?: string): void {
  if (elementId) {
    svgCache.delete(elementId)
  } else {
    svgCache.clear()
  }
}

function getCachedSvg(elementId: string, text: string, color: string): SVGSVGElement | null {
  const cached = svgCache.get(elementId)
  if (cached && cached.text === text && cached.color === color) {
    return cached.svg.cloneNode(true) as SVGSVGElement
  }
  return null
}

function cacheSvg(elementId: string, text: string, color: string, svg: SVGSVGElement): void {
  svgCache.set(elementId, { text, color, svg: svg.cloneNode(true) as SVGSVGElement })
}

export interface V4TextRenderResult {
  success: boolean
  width: number
  height: number
  anchorPosition: { x: number; y: number }
  textBounds: { x: number; y: number; width: number; height: number }
}

function convertToAnchorDirection(element: DrawingElement): AnchorDirection {
  if ((element as any).anchorDirection) {
    return (element as any).anchorDirection as AnchorDirection
  }

  const horizontal = (element as any).horizontalAlign || "left"
  const vertical = (element as any).verticalAlign || "top"

  if (vertical === "top") {
    if (horizontal === "left") return "top-left"
    if (horizontal === "center") return "top"
    if (horizontal === "right") return "top-right"
  } else if (vertical === "center") {
    if (horizontal === "left") return "left"
    if (horizontal === "center") return "center"
    if (horizontal === "right") return "right"
  } else if (vertical === "bottom") {
    if (horizontal === "left") return "bottom-left"
    if (horizontal === "center") return "bottom"
    if (horizontal === "right") return "bottom-right"
  }

  return "top-left"
}

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
        textBounds: { x: 0, y: 0, width: 0, height: 0 }
      }
    }

    const anchorX = element.x * canvasWidth
    const anchorY = element.y * canvasHeight
    const anchorDirection = convertToAnchorDirection(element)
    const textColor = element.color || "#000000"

    let svgElement = getCachedSvg(element.id, element.text, textColor)

    if (!svgElement) {
      svgElement = await convertTextToSvg(
        element.text,
        canvasWidth,
        canvasHeight,
        "left",
        "top",
        24,
        textColor
      )

      if (svgElement) {
        cacheSvg(element.id, element.text, textColor, svgElement)
      }
    }

    if (!svgElement) {
      return {
        success: false,
        width: 0,
        height: 0,
        anchorPosition: { x: anchorX, y: anchorY },
        textBounds: { x: 0, y: 0, width: 0, height: 0 }
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
        height: renderResult.height
      }
    }
  } catch {
    return {
      success: false,
      width: 0,
      height: 0,
      anchorPosition: { x: element.x * canvasWidth, y: element.y * canvasHeight },
      textBounds: { x: 0, y: 0, width: 0, height: 0 }
    }
  }
}

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

export async function renderTextElementsV4(
  ctx: CanvasRenderingContext2D,
  elements: DrawingElement[],
  canvasWidth: number,
  canvasHeight: number,
  selectedElementIds: string[] = []
): Promise<V4TextRenderResult[]> {
  const results: V4TextRenderResult[] = []
  const textElements = elements.filter(el => el.type === "text" && el.text)

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
      mouseX >= x && mouseX <= x + width &&
      mouseY >= y && mouseY <= y + height
    ) {
      return "text"
    }
  }

  return null
}
