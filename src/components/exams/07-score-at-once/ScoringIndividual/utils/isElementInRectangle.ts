/**
 * 範囲選択の矩形に描画要素が掛かっているか
 */
import type { SelectionRectangle } from "@/components/exams/07-score-at-once/ScoringIndividual/types"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

/**
 * 矩形と図形が重なっているかを判定する（境界に触れていれば重なりとみなす）
 *
 * @param element - 描画要素（0-1正規化座標）
 * @param rect - 選択範囲（幅・高さは負でもよい）
 */
export function isElementInRectangle(
  element: DrawingAnnotation,
  rect: SelectionRectangle
): boolean {
  // 要素の境界ボックスを取得
  let elementLeft = element.x
  let elementTop = element.y
  let elementRight = element.x
  let elementBottom = element.y

  switch (element.type) {
    case "line":
      elementLeft = Math.min(element.x, element.endX)
      elementTop = Math.min(element.y, element.endY)
      elementRight = Math.max(element.x, element.endX)
      elementBottom = Math.max(element.y, element.endY)
      break
    case "rectangle":
      elementRight = element.x + element.width
      elementBottom = element.y + element.height
      break
    case "text":
      // テキストボックスの大きさは既定 0.0（＝リサイズされていない）。
      // その場合は小さな矩形として扱う
      if (element.textBoxWidth > 0 && element.textBoxHeight > 0) {
        elementRight = element.x + element.textBoxWidth
        elementBottom = element.y + element.textBoxHeight
      } else {
        elementRight = element.x + 0.05
        elementBottom = element.y + 0.03
      }
      break
  }

  // 選択範囲の境界ボックス
  const rectLeft = Math.min(rect.x, rect.x + rect.width)
  const rectTop = Math.min(rect.y, rect.y + rect.height)
  const rectRight = Math.max(rect.x, rect.x + rect.width)
  const rectBottom = Math.max(rect.y, rect.y + rect.height)

  // 重複判定（境界も含む）
  return !(
    elementRight < rectLeft ||
    elementLeft > rectRight ||
    elementBottom < rectTop ||
    elementTop > rectBottom
  )
}
