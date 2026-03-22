/**
 * @fileoverview 座標変換ユーティリティ（個別採点画面統合用）
 * @description 絶対座標（ピクセル）と相対座標（0-1）間の変換を行う
 */

import type {
  CoordinateConversionOptions,
  CoordinateConversionUtils,
  Point,
  TextBox,
} from "../types"

/**
 * 相対座標を絶対座標に変換
 * @param point 相対座標（0.0-1.0）
 * @param options 変換オプション
 * @returns 絶対座標（px）
 */
export function relativeToAbsolute(
  point: Point,
  options: CoordinateConversionOptions
): Point {
  return {
    x: point.x * options.canvasWidth,
    y: point.y * options.canvasHeight,
  }
}

/**
 * 絶対座標を相対座標に変換
 * @param point 絶対座標（px）
 * @param options 変換オプション
 * @returns 相対座標（0.0-1.0）
 */
export function absoluteToRelative(
  point: Point,
  options: CoordinateConversionOptions
): Point {
  return {
    x: options.canvasWidth > 0 ? point.x / options.canvasWidth : 0,
    y: options.canvasHeight > 0 ? point.y / options.canvasHeight : 0,
  }
}

/**
 * TextBoxを相対座標系に変換
 * @param textBox 変換対象のTextBox
 * @param options 変換オプション
 * @returns 相対座標系のTextBox
 */
export function textBoxToRelative(
  textBox: TextBox,
  options: CoordinateConversionOptions
): TextBox {
  // 既に相対座標系の場合はそのまま返す
  if (textBox.coordinateSystem === "relative") {
    return textBox
  }

  const relativePoint = absoluteToRelative(
    { x: textBox.x, y: textBox.y },
    options
  )

  return {
    ...textBox,
    x: relativePoint.x,
    y: relativePoint.y,
    coordinateSystem: "relative",
  }
}

/**
 * TextBoxを絶対座標系に変換
 * @param textBox 変換対象のTextBox
 * @param options 変換オプション
 * @returns 絶対座標系のTextBox
 */
export function textBoxToAbsolute(
  textBox: TextBox,
  options: CoordinateConversionOptions
): TextBox {
  // 既に絶対座標系の場合、またはcoordinateSystemが未定義（デフォルト）の場合はそのまま返す
  if (textBox.coordinateSystem === "absolute" || !textBox.coordinateSystem) {
    return textBox
  }

  const absolutePoint = relativeToAbsolute(
    { x: textBox.x, y: textBox.y },
    options
  )

  return {
    ...textBox,
    x: absolutePoint.x,
    y: absolutePoint.y,
    coordinateSystem: "absolute",
  }
}

/**
 * 座標変換ユーティリティオブジェクト
 */
export const coordinateConversionUtils: CoordinateConversionUtils = {
  relativeToAbsolute,
  absoluteToRelative,
  textBoxToRelative,
  textBoxToAbsolute,
}

/**
 * 個別採点画面のDrawingElementからTextBoxに変換
 * @param drawingElement 個別採点画面のDrawingElement
 * @param options 変換オプション
 * @returns TextBox
 */
export function drawingElementToTextBox(
  drawingElement: {
    id: string
    x: number // 0.0-1.0
    y: number // 0.0-1.0
    text?: string
    fontSize?: number
    color?: string
  },
  options: CoordinateConversionOptions
): TextBox {
  const absolutePoint = relativeToAbsolute(
    { x: drawingElement.x, y: drawingElement.y },
    options
  )

  return {
    id: drawingElement.id,
    x: absolutePoint.x,
    y: absolutePoint.y,
    text: drawingElement.text || "",
    isSelected: false,
    anchorDirection: "top-left", // デフォルト値
    textSize: drawingElement.fontSize || 16,
    coordinateSystem: "absolute",
  }
}

/**
 * TextBoxを個別採点画面のDrawingElement形式に変換
 * @param textBox TextBox
 * @param options 変換オプション
 * @returns DrawingElement形式のオブジェクト
 */
export function textBoxToDrawingElement(
  textBox: TextBox,
  options: CoordinateConversionOptions
): {
  id: string
  type: "text"
  x: number // 0.0-1.0
  y: number // 0.0-1.0
  text: string
  fontSize: number
  color: string
} {
  const relativeTextBox = textBoxToRelative(textBox, options)

  return {
    id: textBox.id,
    type: "text",
    x: relativeTextBox.x,
    y: relativeTextBox.y,
    text: textBox.text,
    fontSize: textBox.textSize,
    color: "#000000", // デフォルト色
  }
}
