import { useCallback, useMemo } from "react"

import { DRAWING_TOLERANCES } from "@/components/exams/07-score-at-once/ScoringIndividual/constants/drawingConstants"
import type {
  AnchorDirection,
  DrawingElement,
} from "@/components/exams/07-score-at-once/ScoringIndividual/types/answerIndividualTypes"

/**
 * アンカー方向に基づいてテキストの左上位置を計算
 * canvasUtils.tsのgetTextPositionFromAnchorと同じロジック
 */
function getTextBoundsFromAnchor(
  anchorX: number,
  anchorY: number,
  textWidth: number,
  textHeight: number,
  anchorDirection: AnchorDirection
): { left: number; top: number } {
  let left = anchorX
  let top = anchorY

  // 水平方向の調整
  switch (anchorDirection) {
    case "top-left":
    case "left":
    case "bottom-left":
      // アンカーがテキストの左端
      break
    case "top":
    case "center":
    case "bottom":
      // アンカーがテキストの中央
      left = anchorX - textWidth / 2
      break
    case "top-right":
    case "right":
    case "bottom-right":
      // アンカーがテキストの右端
      left = anchorX - textWidth
      break
  }

  // 垂直方向の調整
  switch (anchorDirection) {
    case "top-left":
    case "top":
    case "top-right":
      // アンカーがテキストの上端
      break
    case "left":
    case "center":
    case "right":
      // アンカーがテキストの中央
      top = anchorY - textHeight / 2
      break
    case "bottom-left":
    case "bottom":
    case "bottom-right":
      // アンカーがテキストの下端
      top = anchorY - textHeight
      break
  }

  return { left, top }
}

/**
 * 当たり判定の結果
 * - "handle:xxx" : 端点/角のハンドル（リサイズ用）
 * - "body" : 要素本体（移動用）
 * - null : ヒットなし
 */
export type HitTestResult = string | null

interface UseHitTestUtilsProps {
  /** 現在のズーム倍率（画面上のピクセルサイズを一定にするため） */
  zoom?: number
  /** テキスト要素の境界キャッシュ（レンダリング結果から取得） */
  textBoundsCache?: Map<
    string,
    { x: number; y: number; width: number; height: number }
  >
}

export function useHitTestUtils({
  zoom = 1,
  textBoundsCache,
}: UseHitTestUtilsProps = {}) {
  // ズームを考慮した許容値を計算（画面上で一定サイズになるように）
  const { handleRadius, lineWidth } = useMemo(() => {
    // zoomで割ることで、画面上のピクセルサイズが一定になる
    return {
      handleRadius: DRAWING_TOLERANCES.handleRadius / zoom,
      lineWidth: DRAWING_TOLERANCES.lineDistance / zoom,
    }
  }, [zoom])

  // 端点/角ハンドルの許容半径（ズーム調整済み）
  const HANDLE_RADIUS = handleRadius

  // 線の幅（当たり判定用、ズーム調整済み）
  const LINE_WIDTH = lineWidth

  /**
   * 2点間の距離を計算
   */
  const distance = useCallback(
    (x1: number, y1: number, x2: number, y2: number): number => {
      return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    },
    []
  )

  /**
   * 点が円内にあるかチェック
   */
  const isPointInCircle = useCallback(
    (
      testX: number,
      testY: number,
      centerX: number,
      centerY: number,
      radius: number
    ): boolean => {
      return distance(testX, testY, centerX, centerY) <= radius
    },
    [distance]
  )

  /**
   * 点から線分への最短距離を計算
   */
  const distanceToLineSegment = useCallback(
    (
      testX: number,
      testY: number,
      x1: number,
      y1: number,
      x2: number,
      y2: number
    ): number => {
      const dx = x2 - x1
      const dy = y2 - y1
      const lengthSquared = dx * dx + dy * dy

      if (lengthSquared === 0) {
        return distance(testX, testY, x1, y1)
      }

      // 線分上の最近点のパラメータ t (0-1にクランプ)
      const t = Math.max(
        0,
        Math.min(1, ((testX - x1) * dx + (testY - y1) * dy) / lengthSquared)
      )

      // 最近点の座標
      const nearestX = x1 + t * dx
      const nearestY = y1 + t * dy

      return distance(testX, testY, nearestX, nearestY)
    },
    [distance]
  )

  /**
   * 統合ヒットテスト: 端点ハンドル優先、次に本体
   * @returns "handle:start", "handle:end", "handle:top-left", etc. or "body" or null
   */
  const hitTestElementWithHandle = useCallback(
    (element: DrawingElement, testX: number, testY: number): HitTestResult => {
      switch (element.type) {
        case "line": {
          if (element.endX === undefined || element.endY === undefined) {
            return null
          }

          // 1. 端点ハンドル判定（優先）
          if (
            isPointInCircle(testX, testY, element.x, element.y, HANDLE_RADIUS)
          ) {
            return "handle:start"
          }
          if (
            isPointInCircle(
              testX,
              testY,
              element.endX,
              element.endY,
              HANDLE_RADIUS
            )
          ) {
            return "handle:end"
          }

          // 2. 線分本体判定（幅あり）
          const dist = distanceToLineSegment(
            testX,
            testY,
            element.x,
            element.y,
            element.endX,
            element.endY
          )
          if (dist <= LINE_WIDTH) {
            return "body"
          }

          return null
        }

        case "rectangle": {
          if (element.width === undefined || element.height === undefined) {
            return null
          }

          const left = Math.min(element.x, element.x + element.width)
          const right = Math.max(element.x, element.x + element.width)
          const top = Math.min(element.y, element.y + element.height)
          const bottom = Math.max(element.y, element.y + element.height)

          // 1. 4角のハンドル判定（優先）
          const corners = [
            { x: left, y: top, handle: "handle:top-left" },
            { x: right, y: top, handle: "handle:top-right" },
            { x: left, y: bottom, handle: "handle:bottom-left" },
            { x: right, y: bottom, handle: "handle:bottom-right" },
          ]

          for (const corner of corners) {
            if (
              isPointInCircle(testX, testY, corner.x, corner.y, HANDLE_RADIUS)
            ) {
              return corner.handle
            }
          }

          // 2. 内部判定
          if (
            testX >= left &&
            testX <= right &&
            testY >= top &&
            testY <= bottom
          ) {
            return "body"
          }

          return null
        }

        case "ellipse": {
          if (element.width === undefined || element.height === undefined) {
            return null
          }

          const left = Math.min(element.x, element.x + element.width)
          const right = Math.max(element.x, element.x + element.width)
          const top = Math.min(element.y, element.y + element.height)
          const bottom = Math.max(element.y, element.y + element.height)

          // 1. 4角のハンドル判定（優先）
          const corners = [
            { x: left, y: top, handle: "handle:top-left" },
            { x: right, y: top, handle: "handle:top-right" },
            { x: left, y: bottom, handle: "handle:bottom-left" },
            { x: right, y: bottom, handle: "handle:bottom-right" },
          ]

          for (const corner of corners) {
            if (
              isPointInCircle(testX, testY, corner.x, corner.y, HANDLE_RADIUS)
            ) {
              return corner.handle
            }
          }

          // 2. 楕円内部判定
          const centerX = element.x + element.width / 2
          const centerY = element.y + element.height / 2
          const radiusX = Math.abs(element.width) / 2
          const radiusY = Math.abs(element.height) / 2

          if (radiusX > 0 && radiusY > 0) {
            const normalizedX = (testX - centerX) / radiusX
            const normalizedY = (testY - centerY) / radiusY
            if (normalizedX * normalizedX + normalizedY * normalizedY <= 1) {
              return "body"
            }
          }

          return null
        }

        case "text": {
          // 1. 単一アンカーポイント判定（移動用）- 優先
          if (
            isPointInCircle(testX, testY, element.x, element.y, HANDLE_RADIUS)
          ) {
            return "handle:anchor" // テキストアンカーポイント（移動用）
          }

          // 2. キャッシュされた境界を使用（レンダリング結果と完全一致）
          const cachedBounds = textBoundsCache?.get(element.id)
          if (cachedBounds) {
            const left = cachedBounds.x
            const top = cachedBounds.y
            const right = left + cachedBounds.width
            const bottom = top + cachedBounds.height

            if (
              testX >= left &&
              testX <= right &&
              testY >= top &&
              testY <= bottom
            ) {
              return "body"
            }
            return null
          }

          // 3. キャッシュがない場合のフォールバック（概算）
          let boxWidth: number
          let boxHeight: number

          if (
            element.textBoxWidth !== undefined &&
            element.textBoxHeight !== undefined
          ) {
            boxWidth = element.textBoxWidth
            boxHeight = element.textBoxHeight
          } else if (element.text) {
            // fontSizeを考慮したサイズ計算（正規化座標で）
            const fontSize = element.fontSize ?? 16
            const lines = element.text.split("\n")
            const maxLineLength = Math.max(...lines.map((line) => line.length))
            // fontSizeをピクセルから正規化座標に変換（画像幅1000pxを基準）
            const charWidthRatio = (fontSize * 0.6) / 1000 // 1文字の幅（fontSizeの約60%）
            const lineHeightRatio = (fontSize * 1.4) / 1000 // 行の高さ（fontSizeの約140%）
            boxWidth = Math.max(maxLineLength * charWidthRatio, 0.03)
            boxHeight = Math.max(lines.length * lineHeightRatio, 0.02)
          } else {
            return null
          }

          // アンカー方向に基づいてバウンディングボックスの位置を計算
          const anchorDirection = element.anchorDirection ?? "top-left"
          const { left, top } = getTextBoundsFromAnchor(
            element.x,
            element.y,
            boxWidth,
            boxHeight,
            anchorDirection
          )
          const right = left + boxWidth
          const bottom = top + boxHeight

          // 内部判定（テキスト編集用）
          if (
            testX >= left &&
            testX <= right &&
            testY >= top &&
            testY <= bottom
          ) {
            return "body"
          }

          return null
        }

        default:
          return null
      }
    },
    [
      isPointInCircle,
      distanceToLineSegment,
      HANDLE_RADIUS,
      LINE_WIDTH,
      textBoundsCache,
    ]
  )

  /**
   * 要素のヒットテスト（後方互換性のため維持）
   * ハンドルまたは本体にヒットすればtrue
   */
  const hitTestElement = useCallback(
    (element: DrawingElement, testX: number, testY: number): boolean => {
      return hitTestElementWithHandle(element, testX, testY) !== null
    },
    [hitTestElementWithHandle]
  )

  /**
   * ハンドルの当たり判定（後方互換性のため維持）
   */
  const hitTestHandle = useCallback(
    (element: DrawingElement, testX: number, testY: number): string | null => {
      const result = hitTestElementWithHandle(element, testX, testY)
      if (result && result.startsWith("handle:")) {
        return result.replace("handle:", "")
      }
      return null
    },
    [hitTestElementWithHandle]
  )

  return {
    hitTestElement,
    hitTestHandle,
  }
}
