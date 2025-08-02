import { useCallback, useState } from "react"

interface ImagePosition {
  x: number
  y: number
}

export interface UseImageNavigationReturn {
  zoom: number
  position: ImagePosition
  setZoom: (zoom: number) => void
  setPosition: (position: ImagePosition) => void
  onZoomChange: (zoom: number) => void
  onPositionChange: (position: ImagePosition) => void
}

const DEFAULT_ZOOM = 1
const DEFAULT_POSITION: ImagePosition = { x: 0, y: 0 }

/**
 * Individual表示モード専用の画像ナビゲーション状態管理フック
 * zoom, positionの状態を内部で管理し、外部から制御するためのインターフェースを提供
 */
export function useImageNavigation(): UseImageNavigationReturn {
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM)
  const [position, setPosition] = useState<ImagePosition>(DEFAULT_POSITION)

  const onZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom)
  }, [])

  const onPositionChange = useCallback((newPosition: ImagePosition) => {
    setPosition(newPosition)
  }, [])

  return {
    zoom,
    position,
    setZoom,
    setPosition,
    onZoomChange,
    onPositionChange,
  }
}
