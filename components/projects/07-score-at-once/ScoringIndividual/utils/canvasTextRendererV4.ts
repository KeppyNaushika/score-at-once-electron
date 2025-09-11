/**
 * @fileoverview V4統合テキストCanvas描画ユーティリティ
 * @description 個別採点画面用のV4統合高品質テキスト描画機能
 */

import type { DrawingElement } from "../types/answer-individual-types"
import type { AnchorDirection } from "../../../../../app/textbox-on-canvas-v4/types"
import { convertTextToSvg } from "../../../../../app/textbox-on-canvas-v4/utils/textConversionUtils"
import { 
  renderSvgToCanvas, 
  drawAnchor, 
  getTextPositionFromAnchor,
  isAnchorClicked 
} from "../../../../../app/textbox-on-canvas-v4/utils/canvasUtils"

/**
 * V4統合用のテキスト描画結果
 */
export interface V4TextRenderResult {
  success: boolean
  width: number
  height: number
  anchorPosition: { x: number; y: number }
  textBounds: { x: number; y: number; width: number; height: number }
}

/**
 * DrawingElementをV4 TextBoxのAnchorDirectionに変換
 */
function convertToAnchorDirection(element: DrawingElement): AnchorDirection {
  // anchorDirectionが直接設定されている場合はそれを使用
  if ((element as any).anchorDirection) {
    return (element as any).anchorDirection as AnchorDirection
  }
  
  // レガシー対応: horizontalAlign/verticalAlignから変換
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
  
  return "top-left" // デフォルト
}

/**
 * V4統合: 高品質テキストをCanvasに描画
 * @param ctx Canvas描画コンテキスト
 * @param element 描画するテキスト要素
 * @param canvasWidth Canvasの幅
 * @param canvasHeight Canvasの高さ
 * @param isSelected 選択状態かどうか
 * @returns Promise<V4TextRenderResult> 描画結果
 */
export async function renderTextElementV4(
  ctx: CanvasRenderingContext2D,
  element: DrawingElement,
  canvasWidth: number,
  canvasHeight: number,
  isSelected: boolean = false
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

    // 相対座標を絶対座標に変換
    const anchorX = element.x * canvasWidth
    const anchorY = element.y * canvasHeight
    
    // アンカー方向を取得
    const anchorDirection = convertToAnchorDirection(element)
    
    // V4のconvertTextToSvgを使用してSVGを生成
    const svgElement = await convertTextToSvg(
      element.text,
      canvasWidth,
      canvasHeight,
      "left", // horizontalAlign（V4内でアンカーロジックにより調整される）
      "top"   // verticalAlign
    )
    
    if (!svgElement) {
      return {
        success: false,
        width: 0,
        height: 0,
        anchorPosition: { x: anchorX, y: anchorY },
        textBounds: { x: 0, y: 0, width: 0, height: 0 }
      }
    }

    // V4の高品質Canvas描画機能を使用
    const renderResult = await renderSvgToCanvas(
      svgElement,
      ctx,
      anchorX,
      anchorY,
      anchorDirection
    )

    // テキストの境界を計算
    const textPosition = getTextPositionFromAnchor(
      anchorX,
      anchorY,
      renderResult.width,
      renderResult.height,
      anchorDirection
    )

    // アンカーアイコンを描画
    await drawAnchor(ctx, anchorX, anchorY, isSelected)

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
  } catch (error) {
    console.error("V4テキスト描画エラー:", error)
    return {
      success: false,
      width: 0,
      height: 0,
      anchorPosition: { x: element.x * canvasWidth, y: element.y * canvasHeight },
      textBounds: { x: 0, y: 0, width: 0, height: 0 }
    }
  }
}

/**
 * テキスト要素のアンカーがクリックされたかを判定
 * @param mouseX マウスのX座標（Canvas座標系）
 * @param mouseY マウスのY座標（Canvas座標系）
 * @param element テキスト要素
 * @param canvasWidth Canvasの幅
 * @param canvasHeight Canvasの高さ
 * @returns アンカーがクリックされた場合はtrue
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
 * 複数のテキスト要素を一括描画（V4統合版）
 * @param ctx Canvas描画コンテキスト
 * @param elements 描画する要素配列
 * @param canvasWidth Canvasの幅
 * @param canvasHeight Canvasの高さ
 * @param selectedElementIds 選択中の要素ID配列
 * @returns Promise<V4TextRenderResult[]> 描画結果配列
 */
export async function renderTextElementsV4(
  ctx: CanvasRenderingContext2D,
  elements: DrawingElement[],
  canvasWidth: number,
  canvasHeight: number,
  selectedElementIds: string[] = []
): Promise<V4TextRenderResult[]> {
  const results: V4TextRenderResult[] = []
  
  // テキスト要素のみを抽出
  const textElements = elements.filter(el => el.type === "text" && el.text)
  
  // 各テキスト要素を順次描画
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
 * テキスト要素のヒットテスト（アンカーまたはテキスト領域）
 * @param mouseX マウスのX座標
 * @param mouseY マウスのY座標
 * @param element テキスト要素
 * @param canvasWidth Canvasの幅
 * @param canvasHeight Canvasの高さ
 * @param renderResult 描画結果（テキスト境界情報）
 * @returns ヒット種別（"anchor" | "text" | null）
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
  
  // アンカーヒットテスト
  if (isTextAnchorClicked(mouseX, mouseY, element, canvasWidth, canvasHeight)) {
    return "anchor"
  }
  
  // テキスト領域ヒットテスト
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