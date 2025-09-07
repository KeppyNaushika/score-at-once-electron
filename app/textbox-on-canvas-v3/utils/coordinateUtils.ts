/**
 * @fileoverview 座標変換・マウス操作ユーティリティ
 * @description Canvas座標系とマウス座標系の変換、テキストボックス操作
 */

import type { DragState, Point, TextBox } from "../types"

/**
 * マウス座標をCanvas座標に変換する
 * @param clientX マウスのクライアントX座標
 * @param clientY マウスのクライアントY座標
 * @param canvas Canvas要素
 * @param zoom ズーム倍率
 * @returns Canvas座標
 */
export function getCanvasCoordinates(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  zoom: number,
): Point {
  const rect = canvas.getBoundingClientRect()
  const x = (clientX - rect.left) / zoom
  const y = (clientY - rect.top) / zoom

  return { x, y }
}

/**
 * 点が矩形内にあるかどうかを判定する
 * @param point 判定する点
 * @param rect 矩形（x, y, width, height）
 * @returns 矩形内にある場合はtrue
 */
export function isPointInRect(
  point: Point,
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  )
}

/**
 * 指定座標にあるテキストボックスを検索する
 * @param textBoxes テキストボックスの配列
 * @param point 検索する座標
 * @returns 見つかったテキストボックス、なければnull
 */
export function findTextBoxAtPoint(
  textBoxes: TextBox[],
  point: Point,
): TextBox | null {
  return textBoxes.find((textBox) => isPointInRect(point, textBox)) || null
}

/**
 * ドラッグ状態から矩形を生成する
 * @param dragState ドラッグ状態
 * @returns 正規化された矩形
 */
export function createRectFromDrag(dragState: DragState): {
  x: number
  y: number
  width: number
  height: number
} {
  const x = Math.min(dragState.startX, dragState.currentX)
  const y = Math.min(dragState.startY, dragState.currentY)
  const width = Math.abs(dragState.currentX - dragState.startX)
  const height = Math.abs(dragState.currentY - dragState.startY)

  return { x, y, width, height }
}

/**
 * 新しいテキストボックスのIDを生成する
 * @returns 一意のID文字列
 */
export function generateTextBoxId(): string {
  return `textbox-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * ドラッグ状態からテキストボックスを作成する
 * @param dragState ドラッグ状態
 * @param text 初期テキスト（デフォルト: 空文字列）
 * @returns 新しいテキストボックス
 */
export function createTextBoxFromDrag(
  dragState: DragState,
  text: string = "",
): TextBox {
  const rect = createRectFromDrag(dragState)

  return {
    id: generateTextBoxId(),
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    text,
    isSelected: false,
    horizontalAlign: 'left',
    verticalAlign: 'top',
  }
}

/**
 * テキストボックス配列の選択状態を更新する
 * @param textBoxes 既存のテキストボックス配列
 * @param selectedId 選択するテキストボックスのID（nullで全て非選択）
 * @returns 更新されたテキストボックス配列
 */
export function updateTextBoxSelection(
  textBoxes: TextBox[],
  selectedId: string | null,
): TextBox[] {
  return textBoxes.map((textBox) => ({
    ...textBox,
    isSelected: textBox.id === selectedId,
  }))
}

/**
 * テキストボックスのテキスト内容を更新する
 * @param textBoxes 既存のテキストボックス配列
 * @param id 更新するテキストボックスのID
 * @param newText 新しいテキスト内容
 * @returns 更新されたテキストボックス配列
 */
export function updateTextBoxContent(
  textBoxes: TextBox[],
  id: string,
  newText: string,
): TextBox[] {
  return textBoxes.map((textBox) =>
    textBox.id === id ? { ...textBox, text: newText } : textBox,
  )
}

/**
 * テキストボックスを削除する
 * @param textBoxes 既存のテキストボックス配列
 * @param id 削除するテキストボックスのID
 * @returns 更新されたテキストボックス配列
 */
export function removeTextBox(textBoxes: TextBox[], id: string): TextBox[] {
  return textBoxes.filter((textBox) => textBox.id !== id)
}

/**
 * 最小サイズのテキストボックスかどうかを判定する
 * @param rect 矩形オブジェクト
 * @param minWidth 最小幅（デフォルト: 10）
 * @param minHeight 最小高さ（デフォルト: 10）
 * @returns 最小サイズ以上の場合はtrue
 */
export function isValidTextBoxSize(
  rect: { width: number; height: number },
  minWidth: number = 10,
  minHeight: number = 10,
): boolean {
  return rect.width >= minWidth && rect.height >= minHeight
}

/**
 * ドラッグ状態が有効なテキストボックスサイズかどうかを判定する
 * @param dragState ドラッグ状態
 * @param minWidth 最小幅（デフォルト: 10）
 * @param minHeight 最小高さ（デフォルト: 10）
 * @returns 有効なサイズの場合はtrue
 */
export function isValidDragForTextBox(
  dragState: DragState,
  minWidth: number = 10,
  minHeight: number = 10,
): boolean {
  const rect = createRectFromDrag(dragState)
  return isValidTextBoxSize(rect, minWidth, minHeight)
}
