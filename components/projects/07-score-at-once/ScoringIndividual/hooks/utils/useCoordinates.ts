/**
 * @fileoverview 座標変換・座標取得フック
 * イベントからの座標取得と座標変換ユーティリティ
 */
import { useCallback } from "react"

/** 座標フックのプロパティ */
export interface UseCoordinatesProps {
  /** キャンバス参照 */
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  /** 画像参照 */
  imageRef: React.RefObject<HTMLImageElement | null>
  /** ズーム倍率 */
  zoom: number
}

/** 座標フックの戻り値 */
export interface UseCoordinatesReturn {
  /** イベントから画像座標（正規化）を取得 */
  getImageCoordinatesFromEvent: (
    e: React.MouseEvent | React.PointerEvent,
  ) => { x: number; y: number } | null
  /** イベントからスクリーン座標を取得 */
  getScreenCoordinatesFromEvent: (e: React.MouseEvent | React.PointerEvent) => {
    x: number
    y: number
  }
  /** スクリーン座標から画像相対座標へ変換 */
  screenToImageCoords: (
    screenX: number,
    screenY: number,
    displayWidth: number,
    displayHeight: number,
    offsetX: number,
    offsetY: number,
  ) => { x: number; y: number }
  /** 画像相対座標からスクリーン座標へ変換 */
  imageToScreenCoords: (
    imageX: number,
    imageY: number,
    displayWidth: number,
    displayHeight: number,
    offsetX: number,
    offsetY: number,
  ) => { x: number; y: number }
}

/**
 * 座標変換・座標取得フック
 *
 * @description
 * ポインターイベントから画像座標を取得し、
 * スクリーン座標と画像座標の相互変換を行う。
 * CSS scale方式に対応。
 *
 * @param props - フックのプロパティ
 * @returns 座標変換関数
 */
export function useCoordinates({
  canvasRef,
  imageRef,
  zoom,
}: UseCoordinatesProps): UseCoordinatesReturn {
  /**
   * イベントから画像座標（正規化）を取得
   *
   * @description
   * ポインターイベントからCSS scale方式を考慮して
   * 0-1の正規化座標を計算する。
   *
   * @param e - マウス/ポインターイベント
   * @returns 正規化座標またはnull
   */
  const getImageCoordinatesFromEvent = useCallback(
    (e: React.MouseEvent | React.PointerEvent) => {
      const canvas = canvasRef.current
      const img = imageRef.current

      if (!canvas || !img) {
        return null
      }

      if (!img.naturalWidth || !img.naturalHeight) {
        return null
      }

      const rect = canvas.getBoundingClientRect()
      const canvasX = e.clientX - rect.left
      const canvasY = e.clientY - rect.top

      // CSS scale方式：Canvas要素がzoom倍サイズなので、Canvas内部座標に変換
      const actualX = canvasX / zoom
      const actualY = canvasY / zoom

      // Canvasでの画像中央配置オフセットを考慮
      const canvasElement = canvasRef.current
      if (!canvasElement) return null

      const canvasWidth = canvasElement.width
      const imageOffsetX = (canvasWidth - img.naturalWidth) / 2

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

  /**
   * イベントからスクリーン座標を取得
   *
   * @param e - マウス/ポインターイベント
   * @returns スクリーン座標
   */
  const getScreenCoordinatesFromEvent = useCallback(
    (e: React.MouseEvent | React.PointerEvent) => {
      return {
        x: e.clientX,
        y: e.clientY,
      }
    },
    [],
  )

  /**
   * スクリーン座標から画像相対座標へ変換
   *
   * @param screenX - スクリーンX座標
   * @param screenY - スクリーンY座標
   * @param displayWidth - 表示幅
   * @param displayHeight - 表示高さ
   * @param offsetX - Xオフセット
   * @param offsetY - Yオフセット
   * @returns 画像相対座標（0-1）
   */
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

  /**
   * 画像相対座標からスクリーン座標へ変換
   *
   * @param imageX - 画像X座標（0-1）
   * @param imageY - 画像Y座標（0-1）
   * @param displayWidth - 表示幅
   * @param displayHeight - 表示高さ
   * @param offsetX - Xオフセット
   * @param offsetY - Yオフセット
   * @returns スクリーン座標
   */
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
    getImageCoordinatesFromEvent,
    getScreenCoordinatesFromEvent,
    screenToImageCoords,
    imageToScreenCoords,
  }
}
