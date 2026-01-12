/**
 * @fileoverview ズーム・スクロール操作フック
 * ズームイン/アウト、全体表示、設問表示などの画面位置制御ロジックを提供
 */
import { useCallback } from "react"

import type { CropRegionWithProjectPage } from "@/components/projects/07-score-at-once/types"

import { ZOOM_SETTINGS } from "../../constants/drawingConstants"

/** ズーム・スクロール操作フックのパラメータ */
export interface UseZoomAndScrollParams {
  /** コンテナ要素のRef */
  containerRef: React.RefObject<HTMLDivElement | null>
  /** 現在のズーム倍率 */
  zoom: number
  /** ズーム変更ハンドラー */
  onZoomChange: (zoom: number) => void
  /** 画像読み込み完了フラグ */
  imageLoaded: boolean
  /** 読み込み済み画像配列 */
  loadedImages: HTMLImageElement[]
  /** ページ間隔 */
  pageSpacing?: number
  /** 現在の設問領域 */
  currentCropRegion?: CropRegionWithProjectPage | null
}

/** ズーム・スクロール操作フックの戻り値 */
export interface UseZoomAndScrollReturn {
  /** ズームイン */
  handleZoomIn: () => void
  /** ズームアウト */
  handleZoomOut: () => void
  /** 全体表示 */
  handleMaximizeView: () => void
  /** 設問表示 */
  handleCropView: () => void
}

/**
 * ズーム・スクロール操作フック
 *
 * @description
 * 画像のズームおよびスクロール操作を管理するフック。
 * ビューポート中心を維持したズーム、全体表示、設問フィット表示などの機能を提供。
 *
 * @param params - フックパラメータ
 * @returns ズーム・スクロール操作関数
 */
export function useZoomAndScroll({
  containerRef,
  zoom,
  onZoomChange,
  imageLoaded,
  loadedImages,
  pageSpacing = 20,
  currentCropRegion,
}: UseZoomAndScrollParams): UseZoomAndScrollReturn {
  // ズームイン（CSS scale + scroll 方式）
  const handleZoomIn = useCallback(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const viewportCenterX = container.offsetWidth / 2
    const viewportCenterY = container.offsetHeight / 2

    const newZoom = Math.min(
      zoom * ZOOM_SETTINGS.zoomInDelta,
      ZOOM_SETTINGS.max
    )

    // 現在のスクロール位置から、ビューポート中心の画像上の座標を計算
    const currentScrollCenterX = container.scrollLeft + viewportCenterX
    const currentScrollCenterY = container.scrollTop + viewportCenterY

    // スケール前の画像上の座標（zoom倍される前の実座標）
    const imageCenterX = currentScrollCenterX / zoom
    const imageCenterY = currentScrollCenterY / zoom

    // 新しいズームでの同じ画像位置の画面座標
    const newScrollCenterX = imageCenterX * newZoom
    const newScrollCenterY = imageCenterY * newZoom

    // ビューポート中心を維持するための新しいスクロール位置
    const newScrollLeft = newScrollCenterX - viewportCenterX
    const newScrollTop = newScrollCenterY - viewportCenterY

    onZoomChange(newZoom)

    // スクロール位置を調整（次のフレームで実行）
    requestAnimationFrame(() => {
      container.scrollTo(newScrollLeft, newScrollTop)
    })
  }, [zoom, onZoomChange, containerRef])

  // ズームアウト（CSS scale + scroll 方式）
  const handleZoomOut = useCallback(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const viewportCenterX = container.offsetWidth / 2
    const viewportCenterY = container.offsetHeight / 2

    const newZoom = Math.max(zoom * ZOOM_SETTINGS.wheelDelta, ZOOM_SETTINGS.min)

    // 現在のスクロール位置から、ビューポート中心の画像上の座標を計算
    const currentScrollCenterX = container.scrollLeft + viewportCenterX
    const currentScrollCenterY = container.scrollTop + viewportCenterY

    // スケール前の画像上の座標（zoom倍される前の実座標）
    const imageCenterX = currentScrollCenterX / zoom
    const imageCenterY = currentScrollCenterY / zoom

    // 新しいズームでの同じ画像位置の画面座標
    const newScrollCenterX = imageCenterX * newZoom
    const newScrollCenterY = imageCenterY * newZoom

    // ビューポート中心を維持するための新しいスクロール位置
    const newScrollLeft = newScrollCenterX - viewportCenterX
    const newScrollTop = newScrollCenterY - viewportCenterY

    onZoomChange(newZoom)

    // スクロール位置を調整（次のフレームで実行）
    requestAnimationFrame(() => {
      container.scrollTo(newScrollLeft, newScrollTop)
    })
  }, [zoom, onZoomChange, containerRef])

  // 全体表示（CSS scale + scroll 方式）
  const handleMaximizeView = useCallback(() => {
    if (!containerRef.current || !imageLoaded || loadedImages.length === 0)
      return

    const container = containerRef.current
    const availableWidth = container.offsetWidth
    const availableHeight = container.offsetHeight

    // パディングを考慮
    const padding = 40
    const effectiveWidth = availableWidth - padding
    const effectiveHeight = availableHeight - padding

    // 全画像の合計サイズを計算
    const firstImg = loadedImages[0]
    const totalWidth = firstImg.naturalWidth
    const totalHeight = loadedImages.reduce(
      (total, img, index) =>
        total +
        img.naturalHeight +
        (index < loadedImages.length - 1 ? pageSpacing : 0),
      0
    )

    // 全体をコンテナに収めるためのズームを計算
    const zoomByWidth = effectiveWidth / totalWidth
    const zoomByHeight = effectiveHeight / totalHeight
    const newZoom = Math.min(zoomByWidth, zoomByHeight)

    // ズーム制限を適用
    const constrainedZoom = Math.min(
      Math.max(newZoom, ZOOM_SETTINGS.min),
      ZOOM_SETTINGS.max
    )

    onZoomChange(constrainedZoom)

    // 中央に配置するためのスクロール位置を計算
    const scaledWidth = totalWidth * constrainedZoom
    const scaledHeight = totalHeight * constrainedZoom
    const scrollLeft = (scaledWidth - availableWidth) / 2
    const scrollTop = (scaledHeight - availableHeight) / 2

    // スクロール位置を設定（次のフレームで実行）
    requestAnimationFrame(() => {
      container.scrollTo(Math.max(0, scrollLeft), Math.max(0, scrollTop))
    })
  }, [containerRef, imageLoaded, loadedImages, pageSpacing, onZoomChange])

  // 設問表示（CSS scale + scroll 方式）
  const handleCropView = useCallback(() => {
    if (
      !currentCropRegion ||
      !containerRef.current ||
      !imageLoaded ||
      loadedImages.length === 0
    )
      return

    const container = containerRef.current
    const availableWidth = container.offsetWidth
    const availableHeight = container.offsetHeight

    // 余白の比率: 2:6:2（左右/上下に20%ずつの余白、中央60%に設問を表示）
    const marginRatio = 0.2
    const contentRatio = 1 - marginRatio * 2 // 0.6
    const effectiveWidth = availableWidth * contentRatio
    const effectiveHeight = availableHeight * contentRatio

    // 設問が属するページの画像を使用
    const questionPageNumber = currentCropRegion.projectPage?.pageNumber || 1
    const questionPageIndex = questionPageNumber - 1 // 1ベース→0ベースに変換

    const questionImg = loadedImages[questionPageIndex] || loadedImages[0]
    if (!questionImg) {
      return
    }

    // 設問領域の実際のサイズ（ピクセル）
    const questionWidth = currentCropRegion.width * questionImg.naturalWidth
    const questionHeight = currentCropRegion.height * questionImg.naturalHeight

    // 設問領域をコンテナに収めるためのズームを計算
    const zoomByWidth = effectiveWidth / questionWidth
    const zoomByHeight = effectiveHeight / questionHeight
    let newZoom = Math.min(zoomByWidth, zoomByHeight)

    // ズーム制限を適用
    newZoom = Math.min(newZoom, ZOOM_SETTINGS.max)
    newZoom = Math.max(newZoom, ZOOM_SETTINGS.min)

    // 設問領域の中心座標（設問ページの画像内の実際のピクセル座標）
    const questionCenterX =
      (currentCropRegion.x + currentCropRegion.width / 2) *
      questionImg.naturalWidth
    const questionCenterY =
      (currentCropRegion.y + currentCropRegion.height / 2) *
      questionImg.naturalHeight

    // 複数ページ表示の場合、設問が属するページのオフセットを計算
    let pageOffsetY = 0

    if (loadedImages.length > 1) {
      for (let i = 0; i < questionPageIndex; i++) {
        if (i < loadedImages.length) {
          pageOffsetY += loadedImages[i].naturalHeight + pageSpacing
        }
      }
    }

    // 画像の中央配置オフセットを考慮（Canvas幅は最初の画像幅）
    const canvasWidth = loadedImages[0].naturalWidth
    const imageOffsetX = (canvasWidth - questionImg.naturalWidth) / 2

    onZoomChange(newZoom)

    // ズーム変更後に正しいCanvas座標で再計算（次のフレームで実行）
    requestAnimationFrame(() => {
      // 設問の実際のCanvas上での位置（ズーム適用後）
      const questionCenterScreenX = (questionCenterX + imageOffsetX) * newZoom
      const questionCenterScreenY = (questionCenterY + pageOffsetY) * newZoom

      // コンテナ中心座標（現在のコンテナサイズを使用）
      const containerCenterX = container.offsetWidth / 2
      const containerCenterY = container.offsetHeight / 2

      // 設問中心をコンテナ中心に配置するためのスクロール位置
      const scrollLeft = questionCenterScreenX - containerCenterX
      const scrollTop = questionCenterScreenY - containerCenterY

      // スクロール位置を設定
      container.scrollTo(scrollLeft, scrollTop)
    })
  }, [
    currentCropRegion,
    containerRef,
    imageLoaded,
    loadedImages,
    onZoomChange,
    pageSpacing,
  ])

  return {
    handleZoomIn,
    handleZoomOut,
    handleMaximizeView,
    handleCropView,
  }
}
