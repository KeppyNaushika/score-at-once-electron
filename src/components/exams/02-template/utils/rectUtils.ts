/**
 * 長方形計算ユーティリティ
 */

import { DetectedRect, DragSelectionResult } from "../types"

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
export function hasIntersection(rect1: Rect, rect2: Rect): boolean {
  return !(
    rect1.x + rect1.width <= rect2.x ||
    rect2.x + rect2.width <= rect1.x ||
    rect1.y + rect1.height <= rect2.y ||
    rect2.y + rect2.height <= rect1.y
  )
}

/**
 * 点が矩形内に含まれるか判定
 */
export function containsPoint(rect: Rect, x: number, y: number): boolean {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  )
}

/**
 * 複数の矩形の外接矩形を計算
 */
export function getBoundingRect(rects: Rect[]): Rect | null {
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
 * 点を含む最小の矩形を取得（入れ子対応）
 */
export function findSmallestContainingRect(
  x: number,
  y: number,
  rects: DetectedRect[]
): DetectedRect | null {
  const containing = rects.filter((rect) => containsPoint(rect, x, y))

  if (containing.length === 0) return null

  // 面積が最小の矩形を返す
  return containing.reduce((smallest, rect) => {
    const smallestArea = smallest.width * smallest.height
    const rectArea = rect.width * rect.height
    return rectArea < smallestArea ? rect : smallest
  })
}

/**
 * 入れ子の矩形を除外（最外周と最内周を除外）
 */
export function removeNestedRects(
  rects: DetectedRect[],
  minAreaRatio: number = 0.0005,
  maxAreaRatio: number = 0.9
): DetectedRect[] {
  return rects.filter((rect) => {
    const area = rect.width * rect.height
    return area >= minAreaRatio && area <= maxAreaRatio
  })
}

/**
 * 矩形Aが矩形Bを含むかどうか判定
 */
export function containsRect(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  )
}

/**
 * 入れ子の外側矩形を除外（内側優先）
 * 「日」のような構造で、内側の矩形が存在する場合は外側を除外
 */
export function removeOuterNestedRects(rects: DetectedRect[]): DetectedRect[] {
  const toRemove = new Set<string>()

  for (let i = 0; i < rects.length; i++) {
    for (let j = 0; j < rects.length; j++) {
      if (i === j) continue

      const outer = rects[i]
      const inner = rects[j]

      // outer が inner を含んでいる場合、outer を除外対象にする
      if (containsRect(outer, inner)) {
        // ただし、ほぼ同じサイズの場合は除外しない（重複検出対策）
        const outerArea = outer.width * outer.height
        const innerArea = inner.width * inner.height
        if (innerArea / outerArea < 0.95) {
          toRemove.add(outer.id)
        }
      }
    }
  }

  return rects.filter((rect) => !toRemove.has(rect.id))
}

/**
 * 矩形がサイズ制限内かどうかを判定
 */
export function isWithinSizeLimits(
  rect: Rect,
  minWidth: number,
  maxWidth: number,
  minHeight: number,
  maxHeight: number
): boolean {
  return (
    rect.width >= minWidth &&
    rect.width <= maxWidth &&
    rect.height >= minHeight &&
    rect.height <= maxHeight
  )
}

/**
 * 矩形が画像端からのマージン内にあるかどうかを判定
 */
export function isWithinMargin(rect: Rect, margin: number): boolean {
  return (
    rect.x > margin &&
    rect.y > margin &&
    rect.x + rect.width < 1 - margin &&
    rect.y + rect.height < 1 - margin
  )
}

/**
 * UUIDを生成
 */
export function generateId(): string {
  return crypto.randomUUID()
}
