/**
 * @fileoverview 当たり判定ユーティリティ
 * @description アノテーションに対するポイントのヒット判定ロジック
 */

import type {
  DrawingAnnotation,
  DrawingType,
} from "@/types/drawing-annotation.types"

/**
 * ポイントがアノテーション内にあるかチェック
 * @param point 判定するポイントの相対座標
 * @param annotation 判定対象のアノテーション
 * @returns アノテーション内にある場合true
 */
export function isPointInAnnotation(
  point: { x: number; y: number },
  annotation: DrawingAnnotation
): boolean {
  switch (annotation.type as DrawingType) {
    case "rectangle":
    case "text":
      return (
        point.x >= annotation.displayX &&
        point.x <= annotation.displayX + annotation.width &&
        point.y >= annotation.displayY &&
        point.y <= annotation.displayY + annotation.height
      )

    case "ellipse": {
      const centerX = annotation.displayX + annotation.width / 2
      const centerY = annotation.displayY + annotation.height / 2
      const radiusX = annotation.width / 2
      const radiusY = annotation.height / 2

      const dx = (point.x - centerX) / radiusX
      const dy = (point.y - centerY) / radiusY
      return dx * dx + dy * dy <= 1
    }

    case "line": {
      // 線分との距離計算（簡略化）
      const threshold = 0.02 // 2% tolerance
      const lineDx = annotation.endX - annotation.x
      const lineDy = annotation.endY - annotation.y
      const length = Math.sqrt(lineDx * lineDx + lineDy * lineDy)

      if (length === 0) return false

      const t = Math.max(
        0,
        Math.min(
          1,
          ((point.x - annotation.x) * lineDx +
            (point.y - annotation.y) * lineDy) /
            (length * length)
        )
      )

      const projectionX = annotation.x + t * lineDx
      const projectionY = annotation.y + t * lineDy
      const distance = Math.sqrt(
        (point.x - projectionX) ** 2 + (point.y - projectionY) ** 2
      )

      return distance < threshold
    }

    default:
      return false
  }
}
