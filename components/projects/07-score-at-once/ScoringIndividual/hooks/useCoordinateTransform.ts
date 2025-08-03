import { useCallback } from "react"

export function useCoordinateTransform() {
  // 座標変換：スクリーン座標から画像相対座標へ
  const screenToImageCoords = useCallback(
    (
      screenX: number,
      screenY: number,
      displayWidth: number,
      displayHeight: number,
      offsetX: number,
      offsetY: number,
    ): { x: number; y: number } => {
      return {
        x: (screenX - offsetX) / displayWidth,
        y: (screenY - offsetY) / displayHeight,
      }
    },
    [],
  )

  // 座標変換：画像相対座標からスクリーン座標へ
  const imageToScreenCoords = useCallback(
    (
      imageX: number,
      imageY: number,
      displayWidth: number,
      displayHeight: number,
      offsetX: number,
      offsetY: number,
    ): { x: number; y: number } => {
      return {
        x: imageX * displayWidth + offsetX,
        y: imageY * displayHeight + offsetY,
      }
    },
    [],
  )

  return {
    screenToImageCoords,
    imageToScreenCoords,
  }
}
