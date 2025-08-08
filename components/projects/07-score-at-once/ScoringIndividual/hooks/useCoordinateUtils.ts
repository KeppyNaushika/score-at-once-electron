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
  // ポインターイベントから画像座標（正規化）を取得
  const getImageCoordinatesFromEvent = useCallback(
    (e: React.MouseEvent | React.PointerEvent) => {
      const canvas = canvasRef.current
      const img = imageRef.current

      if (!canvas || !img) {
        console.warn("⚠️ Canvas または Image が null です")
        return null
      }

      // 画像が読み込まれていない場合は処理をスキップ
      if (!img.naturalWidth || !img.naturalHeight) {
        console.warn("⚠️ 画像が読み込まれていません")
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

      // デバッグログ（詳細な座標情報）
      const coordinates = {
        clientX: e.clientX,
        clientY: e.clientY,
        canvasX,
        canvasY,
        actualX,
        actualY,
        imageOffsetX,
        imageX,
        imageY,
        zoom,
        canvasWidth,
        imgNaturalWidth: img.naturalWidth,
        imgNaturalHeight: img.naturalHeight,
      }

      // 画像サイズで正規化（0-1の範囲）
      const normalizedCoords = {
        x: imageX / img.naturalWidth,
        y: imageY / img.naturalHeight,
      }

      // 範囲外の座標の場合は警告
      if (
        normalizedCoords.x < -0.1 || normalizedCoords.x > 1.1 ||
        normalizedCoords.y < -0.1 || normalizedCoords.y > 1.1
      ) {
        console.warn("⚠️ 座標が画像範囲外:", coordinates, normalizedCoords)
      }

      return normalizedCoords
    },
    [canvasRef, imageRef, zoom],
  )

  // スクリーン座標を取得（handツール用）
  const getScreenCoordinatesFromEvent = useCallback((e: React.MouseEvent | React.PointerEvent) => {
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
