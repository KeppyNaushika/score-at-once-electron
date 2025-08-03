import type { DrawingElement } from "@/components/projects/07-score-at-once/ScoringIndividual/types/answer-individual-types"
import { useCallback } from "react"

interface UseResizeCursorUtilsProps {
  hitTestHandle: (
    element: DrawingElement,
    testX: number,
    testY: number,
  ) => string | null
}

export function useResizeCursorUtils({
  hitTestHandle,
}: UseResizeCursorUtilsProps) {
  // リサイズカーソルの種類を判定
  const getResizeCursor = useCallback(
    (element: DrawingElement, handle: string): string => {
      switch (element.type) {
        case "line":
          if (element.endX === undefined || element.endY === undefined)
            return "move"

          // 線分の方向を計算してリサイズカーソルを決定
          const deltaX = element.endX - element.x
          const deltaY = element.endY - element.y

          // 角度を計算（ラジアン）
          const angle = Math.atan2(deltaY, deltaX)
          // 度数に変換して正規化（0-180度）
          let degrees = (Math.abs(angle) * 180) / Math.PI
          if (degrees > 90) degrees = 180 - degrees

          console.log(`📏 線分リサイズカーソル判定:`, {
            deltaX,
            deltaY,
            angle,
            degrees,
            start: { x: element.x, y: element.y },
            end: { x: element.endX, y: element.endY },
            handle,
          })

          // 角度に基づいてカーソルを決定（±5度で水平・垂直判定）
          if (degrees <= 5) {
            return "ew-resize" // 水平（0-5度）
          } else if (degrees >= 85) {
            return "ns-resize" // 垂直（85-90度）
          } else {
            // 斜め - deltaXとdeltaYの符号で判定（5-85度）
            return deltaX * deltaY > 0 ? "nwse-resize" : "nesw-resize"
          }

        case "rectangle":
        case "text":
          console.log(`⬜ 矩形リサイズカーソル判定:`, {
            handle,
            element: element.type,
          })

          // 矩形の角・辺に基づいてカーソルを決定
          switch (handle) {
            case "top-left":
            case "bottom-right":
              return "nwse-resize"
            case "top-right":
            case "bottom-left":
              return "nesw-resize"
            case "top":
            case "bottom":
              return "ns-resize"
            case "left":
            case "right":
              return "ew-resize"
            default:
              return "move"
          }

        default:
          return "move"
      }
    },
    [],
  )

  // 要素の端点・ハンドルをチェックしてリサイズカーソルを返す
  const checkResizeHandle = useCallback(
    (element: DrawingElement, testX: number, testY: number): string | null => {
      const handle = hitTestHandle(element, testX, testY)

      if (handle) {
        const cursor = getResizeCursor(element, handle)
        console.log(`🎯 リサイズハンドル検出:`, {
          elementType: element.type,
          elementId: element.id,
          handle,
          cursor,
          testPoint: { testX, testY },
        })
        return cursor
      }

      return null
    },
    [hitTestHandle, getResizeCursor],
  )

  return {
    checkResizeHandle,
    getResizeCursor,
  }
}
