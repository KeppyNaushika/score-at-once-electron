/**
 * 選択ツールで、ポインターの下にある描画要素のハンドルを調べる
 *
 * ハンドルは要素の種類で3つある。線は始点・終点、テキストはアンカー、
 * 矩形と楕円は四隅のリサイズハンドル。
 */
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

/** ポインターの下にあったハンドル（distance はハンドルの中心までの距離） */
export type HandleHit =
  | {
      type: "line-endpoint"
      element: DrawingAnnotation
      handleName: "start" | "end"
      distance: number
    }
  | {
      type: "text-anchor"
      element: DrawingAnnotation
      handleName: "anchor"
      distance: number
    }
  | {
      type: "resize-handle"
      element: DrawingAnnotation
      handleName: string
      distance: number
    }

/** ハンドルの判定に使う、当たり判定の関数（useHitTest・useElementResize のもの） */
export interface HandleHitTesters {
  getLineEditMode: (
    element: DrawingAnnotation,
    x: number,
    y: number
  ) => "start" | "end" | "move" | null
  getResizeHandle: (
    normalizedX: number,
    normalizedY: number,
    element: DrawingAnnotation
  ) => string | null
}

const distanceBetween = (x1: number, y1: number, x2: number, y2: number) =>
  Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)

/** 1要素について、ポインターの下にハンドルがあれば返す */
function hitHandleOf(
  element: DrawingAnnotation,
  imageCoords: { x: number; y: number },
  { getLineEditMode, getResizeHandle }: HandleHitTesters
): HandleHit | null {
  if (element.type === "line") {
    const editMode = getLineEditMode(element, imageCoords.x, imageCoords.y)
    if (editMode !== "start" && editMode !== "end") return null
    const handleX = editMode === "start" ? element.x : element.endX
    const handleY = editMode === "start" ? element.y : element.endY
    return {
      element,
      type: "line-endpoint",
      handleName: editMode,
      distance: distanceBetween(imageCoords.x, imageCoords.y, handleX, handleY),
    }
  }

  const handleName = getResizeHandle(imageCoords.x, imageCoords.y, element)

  if (element.type === "text") {
    if (handleName !== "anchor") return null
    return {
      element,
      type: "text-anchor",
      handleName: "anchor",
      distance: distanceBetween(
        imageCoords.x,
        imageCoords.y,
        element.x,
        element.y
      ),
    }
  }

  if (!handleName) return null
  const width = element.width || 0
  const height = element.height || 0
  const handleX = element.x + (handleName.includes("right") ? width : 0)
  const handleY = element.y + (handleName.includes("bottom") ? height : 0)
  return {
    element,
    type: "resize-handle",
    handleName,
    distance: distanceBetween(imageCoords.x, imageCoords.y, handleX, handleY),
  }
}

/** ポインターに最も近いハンドル（同じ距離なら後ろ＝前面の要素）。重なっていても掴みたいものを掴めるように */
export function findClosestHandleHit(
  drawingElements: DrawingAnnotation[],
  imageCoords: { x: number; y: number },
  hitTesters: HandleHitTesters
): HandleHit | null {
  return drawingElements
    .map((element) => hitHandleOf(element, imageCoords, hitTesters))
    .filter((handleHit) => handleHit !== null)
    .reduce<HandleHit | null>(
      (closest, handleHit) =>
        closest === null || handleHit.distance <= closest.distance
          ? handleHit
          : closest,
      null
    )
}

/** 前面（配列の後ろ）から見て最初に当たるハンドル。ホバーのカーソル判定用 */
export function findTopmostHandleHit(
  drawingElements: DrawingAnnotation[],
  imageCoords: { x: number; y: number },
  hitTesters: HandleHitTesters
): HandleHit | null {
  return drawingElements.reduceRight<HandleHit | null>(
    (found, element) => found ?? hitHandleOf(element, imageCoords, hitTesters),
    null
  )
}
