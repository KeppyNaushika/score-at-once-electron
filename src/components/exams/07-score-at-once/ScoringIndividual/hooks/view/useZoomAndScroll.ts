/**
 * @fileoverview ズーム・スクロール操作フック
 * ズームイン/アウト、全体表示、設問表示などの画面位置制御ロジックを提供
 */
import { useCallback } from "react"

import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import { ZOOM_SETTINGS } from "../../constants/drawingConstants"
import {
  locateQuestionOnCanvas,
  scrollCenteringCanvasPoint,
  scrollKeepingViewportCenter,
} from "./scrollGeometry"

/** ズーム・スクロール操作フックのパラメータ */
interface UseZoomAndScrollParams {
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
  /** loadedImages と同じ並びの、各画像のページ（ExamPage.id） */
  loadedExamPageIds: string[]
  /** ページ間隔 */
  pageSpacing?: number
  /** 現在の設問領域 */
  currentCropRegion?: QuestionAnswerRegionRow | null
}

/** ズーム・スクロール操作フックの戻り値 */
interface UseZoomAndScrollReturn {
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
  loadedExamPageIds,
  pageSpacing = 20,
  currentCropRegion,
}: UseZoomAndScrollParams): UseZoomAndScrollReturn {
  // ズームイン（CSS scale + scroll 方式）
  const handleZoomIn = useCallback(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const newZoom = Math.min(
      zoom * ZOOM_SETTINGS.zoomInDelta,
      ZOOM_SETTINGS.max
    )
    const newScroll = scrollKeepingViewportCenter(container, zoom, newZoom)

    onZoomChange(newZoom)

    // スクロール位置を調整（次のフレームで実行）
    requestAnimationFrame(() => {
      container.scrollTo(newScroll.left, newScroll.top)
    })
  }, [zoom, onZoomChange, containerRef])

  // ズームアウト（CSS scale + scroll 方式）
  const handleZoomOut = useCallback(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const newZoom = Math.max(zoom * ZOOM_SETTINGS.wheelDelta, ZOOM_SETTINGS.min)
    const newScroll = scrollKeepingViewportCenter(container, zoom, newZoom)

    onZoomChange(newZoom)

    // スクロール位置を調整（次のフレームで実行）
    requestAnimationFrame(() => {
      container.scrollTo(newScroll.left, newScroll.top)
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
    const firstImage = loadedImages[0]
    const totalWidth = firstImage.naturalWidth
    const totalHeight = loadedImages.reduce(
      (total, image, index) =>
        total +
        image.naturalHeight +
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

    const questionLocation = locateQuestionOnCanvas(
      currentCropRegion,
      loadedImages,
      loadedExamPageIds,
      pageSpacing
    )
    if (!questionLocation) {
      return
    }
    const { questionImage } = questionLocation

    // 設問領域の実際のサイズ（ピクセル）
    const questionWidth = currentCropRegion.width * questionImage.naturalWidth
    const questionHeight =
      currentCropRegion.height * questionImage.naturalHeight

    // 設問領域をコンテナに収めるためのズームを計算
    const zoomByWidth = effectiveWidth / questionWidth
    const zoomByHeight = effectiveHeight / questionHeight
    let newZoom = Math.min(zoomByWidth, zoomByHeight)

    // ズーム制限を適用
    newZoom = Math.min(newZoom, ZOOM_SETTINGS.max)
    newZoom = Math.max(newZoom, ZOOM_SETTINGS.min)

    onZoomChange(newZoom)

    // ズーム変更後に正しいCanvas座標で再計算（次のフレームで実行）
    requestAnimationFrame(() => {
      // 設問中心をコンテナ中心に配置するためのスクロール位置
      const centeredScroll = scrollCenteringCanvasPoint(
        container,
        { x: questionLocation.centerX, y: questionLocation.centerY },
        newZoom
      )
      container.scrollTo(centeredScroll.left, centeredScroll.top)
    })
  }, [
    currentCropRegion,
    containerRef,
    imageLoaded,
    loadedImages,
    loadedExamPageIds,
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
