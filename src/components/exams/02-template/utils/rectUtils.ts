/**
 * 長方形計算ユーティリティ
 */

import type { DetectedRect, DragSelectionResult } from "../types"

/**
 * 矩形座標のインターフェース
 */
interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * 2つの矩形が交差しているか判定
 */
function hasIntersection(rect1: Rect, rect2: Rect): boolean {
  return !(
    rect1.x + rect1.width <= rect2.x ||
    rect2.x + rect2.width <= rect1.x ||
    rect1.y + rect1.height <= rect2.y ||
    rect2.y + rect2.height <= rect1.y
  )
}

/**
 * 複数の矩形の外接矩形を計算
 */
function getBoundingRect(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null

  const minX = Math.min(...rects.map((rect) => rect.x))
  const minY = Math.min(...rects.map((rect) => rect.y))
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width))
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.height))

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

/**
 * ドラッグ領域と交差する検出枠を取得し、マージされた領域を返す
 */
export function findIntersectingRects(
  dragRect: Rect,
  detectedRects: DetectedRect[]
): DragSelectionResult {
  const intersecting = detectedRects.filter((rect) =>
    hasIntersection(dragRect, rect)
  )

  if (intersecting.length === 0) {
    return {
      selectedRects: [],
      mergedBounds: dragRect,
    }
  }

  const boundingRect = getBoundingRect(intersecting)!

  return {
    selectedRects: intersecting,
    mergedBounds: boundingRect,
  }
}

/**
 * UUIDを生成
 */
export function generateId(): string {
  return crypto.randomUUID()
}
