/**
 * @fileoverview 画像ナビゲーションフック
 * ズーム・位置の状態管理と操作インターフェースを提供
 */
import { useCallback, useState } from "react"

/** 画像の位置 */
interface ImagePosition {
  /** X座標 */
  x: number
  /** Y座標 */
  y: number
}

/** 画像ナビゲーションフックの戻り値 */
interface UseImageNavigationReturn {
  /** 現在のズーム倍率 */
  zoom: number
  /** 現在の位置 */
  position: ImagePosition
  /** ズーム変更ハンドラー */
  onZoomChange: (zoom: number) => void
  /** 位置変更ハンドラー */
  onPositionChange: (position: ImagePosition) => void
}

/** デフォルトのズーム倍率 */
const DEFAULT_ZOOM = 1
/** デフォルトの位置 */
const DEFAULT_POSITION: ImagePosition = { x: 0, y: 0 }

/**
 * 画像ナビゲーションフック
 *
 * @description
 * Individual表示モード専用の画像ナビゲーション状態管理。
 * zoom, positionの状態を内部で管理し、
 * 外部から制御するためのインターフェースを提供する。
 *
 * @returns ナビゲーション状態と操作関数
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
    onZoomChange,
    onPositionChange,
  }
}
