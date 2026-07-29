/**
 * @fileoverview 座標変換・座標取得フック
 * イベントからの座標取得と座標変換ユーティリティ
 */
import { useCallback } from "react"

/** 座標フックのプロパティ */
interface UseCoordinatesProps {
  /** キャンバス参照 */
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  /** 画像参照 */
  imageRef: React.RefObject<HTMLImageElement | null>
  /** ズーム倍率 */
  zoom: number
  /** 読み込み済み画像配列（複数ページ対応用） */
  loadedImages?: HTMLImageElement[]
  /** ページ間のスペーシング */
  pageSpacing?: number
}

/** 座標フックの戻り値 */
interface UseCoordinatesReturn {
  /** イベントから画像座標（正規化）を取得 */
  getImageCoordinatesFromEvent: (
    e: React.MouseEvent | React.PointerEvent
  ) => { x: number; y: number } | null
  /** イベントからスクリーン座標を取得 */
  getScreenCoordinatesFromEvent: (e: React.MouseEvent | React.PointerEvent) => {
    x: number
    y: number
  }
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
  loadedImages = [],
  pageSpacing = 20,
}: UseCoordinatesProps): UseCoordinatesReturn {
  /**
   * イベントから画像座標（正規化）を取得
   *
   * @description
   * ポインターイベントからCSS scale方式を考慮して
   * 0-1の正規化座標を計算する。
   * 複数ページ対応：クリック位置がどのページに属するかを判断し、
   * そのページ内の相対座標（0-1）を返す。
   *
   * @param e - マウス/ポインターイベント
   * @returns 正規化座標またはnull
   */
  const getImageCoordinatesFromEvent = useCallback(
    (e: React.MouseEvent | React.PointerEvent) => {
      const canvas = canvasRef.current
      const image = imageRef.current

      if (!canvas || !image) {
        return null
      }

      if (!image.naturalWidth || !image.naturalHeight) {
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
      const imageOffsetX = (canvasWidth - image.naturalWidth) / 2

      const imageX = actualX - imageOffsetX
      let imageY = actualY

      // 複数ページ対応：クリック位置がどのページに属するかを判断
      // loadedImagesが2枚以上ある場合、Y座標をページ内座標に変換
      if (loadedImages.length > 1) {
        let pageOffsetY = 0
        let targetPageHeight = image.naturalHeight // デフォルトは1ページ目の高さ

        for (let i = 0; i < loadedImages.length; i++) {
          const pageHeight = loadedImages[i].naturalHeight
          const pageBottom = pageOffsetY + pageHeight

          if (actualY < pageBottom || i === loadedImages.length - 1) {
            // このページに属する
            imageY = actualY - pageOffsetY
            targetPageHeight = pageHeight
            break
          }

          // 次のページへ
          pageOffsetY += pageHeight + pageSpacing
        }

        // ページ内座標で正規化（0-1の範囲）
        return {
          x: imageX / image.naturalWidth,
          y: imageY / targetPageHeight,
        }
      }

      // 単一ページの場合：従来通りの正規化（0-1の範囲）
      return {
        x: imageX / image.naturalWidth,
        y: imageY / image.naturalHeight,
      }
    },
    [canvasRef, imageRef, zoom, loadedImages, pageSpacing]
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
    []
  )

  return {
    getImageCoordinatesFromEvent,
    getScreenCoordinatesFromEvent,
  }
}
