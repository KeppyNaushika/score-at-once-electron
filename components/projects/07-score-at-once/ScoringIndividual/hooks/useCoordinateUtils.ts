import { useCallback } from "react"

interface UseCoordinateUtilsProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  imageRef: React.RefObject<HTMLImageElement | null>
  zoom: number
}

export function useCoordinateUtils({
  canvasRef,
  imageRef,
  zoom,
}: UseCoordinateUtilsProps) {
  // マウスイベントから画像座標（正規化）を取得
  const getImageCoordinatesFromEvent = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current
      const img = imageRef.current

      if (!canvas || !img) {
        return null
      }

      // 画像が読み込まれていない場合は処理をスキップ
      if (!img.naturalWidth || !img.naturalHeight) {
        return null
      }

      const rect = canvas.getBoundingClientRect()
      const canvasX = e.clientX - rect.left
      const canvasY = e.clientY - rect.top

      // CSS scale方式：Canvas要素がzoom倍サイズなので、Canvas内部座標に変換するためzoomで割る
      const actualX = canvasX / zoom
      const actualY = canvasY / zoom

      // Canvasでの画像中央配置オフセットを考慮
      const canvasElement = canvasRef.current
      if (!canvasElement) return null

      const canvasWidth = canvasElement.width
      const imageOffsetX = (canvasWidth - img.naturalWidth) / 2

      // 実際の画像座標に変換（中央配置オフセットを引く）
      const imageX = actualX - imageOffsetX
      const imageY = actualY

      // 画像サイズで正規化（0-1の範囲）
      return {
        x: imageX / img.naturalWidth,
        y: imageY / img.naturalHeight,
      }
    },
    [canvasRef, imageRef, zoom],
  )

  // スクリーン座標を取得（handツール用）
  const getScreenCoordinatesFromEvent = useCallback((e: React.MouseEvent) => {
    return {
      x: e.clientX,
      y: e.clientY,
    }
  }, [])

  return {
    getImageCoordinatesFromEvent,
    getScreenCoordinatesFromEvent,
  }
}
