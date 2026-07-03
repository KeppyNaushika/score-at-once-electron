/**
 * @fileoverview 設問変更時自動スクロールフック
 * 設問が変更されたとき、選択設問を画面内で中央寄せ表示する
 */
import { useEffect } from "react"

import type { CropRegionWithExamPage } from "@/components/exams/07-score-at-once/types"

/** 設問変更時自動スクロールフックのパラメータ */
export interface UseQuestionAutoScrollParams {
  /** コンテナ要素のRef */
  containerRef: React.RefObject<HTMLDivElement | null>
  /** 現在のズーム倍率 */
  zoom: number
  /** 画像読み込み完了フラグ */
  imageLoaded: boolean
  /** 読み込み済み画像配列 */
  loadedImages: HTMLImageElement[]
  /** ページ間隔 */
  pageSpacing?: number
  /** 現在の設問領域 */
  currentCropRegion?: CropRegionWithExamPage | null
  /** split表示モード（スクロール中心の補正用） */
  splitMode?: "horizontal" | "vertical" | null
}

/**
 * 設問変更時自動スクロールフック
 *
 * @description
 * currentCropRegion（現在の設問）が変更されたとき、
 * 選択された設問を画面内で中央寄せ表示する。
 * ズームは維持したまま、スクロール位置のみ調整する。
 *
 * @param params - フックパラメータ
 */
export function useQuestionAutoScroll({
  containerRef,
  zoom,
  imageLoaded,
  loadedImages,
  pageSpacing = 20,
  currentCropRegion,
  splitMode,
}: UseQuestionAutoScrollParams): void {
  useEffect(() => {
    if (
      !currentCropRegion ||
      !containerRef.current ||
      !imageLoaded ||
      loadedImages.length === 0
    )
      return

    const container = containerRef.current

    // 設問が属するページの画像を使用
    const questionPageNumber = currentCropRegion.examPage?.pageNumber || 1
    const questionPageIndex = questionPageNumber - 1

    const questionImage = loadedImages[questionPageIndex] || loadedImages[0]
    if (!questionImage) return

    // 設問領域の中心座標（設問ページの画像内の実際のピクセル座標）
    const questionCenterX =
      (currentCropRegion.x + currentCropRegion.width / 2) *
      questionImage.naturalWidth
    const questionCenterY =
      (currentCropRegion.y + currentCropRegion.height / 2) *
      questionImage.naturalHeight

    // 複数ページ表示の場合、設問が属するページのオフセットを計算
    let pageOffsetY = 0
    if (loadedImages.length > 1) {
      for (let i = 0; i < questionPageIndex; i++) {
        if (i < loadedImages.length) {
          pageOffsetY += loadedImages[i].naturalHeight + pageSpacing
        }
      }
    }

    // 画像の中央配置オフセットを考慮
    const canvasWidth = loadedImages[0].naturalWidth
    const imageOffsetX = (canvasWidth - questionImage.naturalWidth) / 2

    // 次のフレームでスクロール位置を調整
    requestAnimationFrame(() => {
      // 設問の実際のCanvas上での位置（ズーム適用後）
      const questionCenterScreenX = (questionCenterX + imageOffsetX) * zoom
      const questionCenterScreenY = (questionCenterY + pageOffsetY) * zoom

      // コンテナ中心座標（split時は1セル分の中心）
      const cellWidth =
        splitMode === "horizontal"
          ? (container.offsetWidth - 2) / 2
          : container.offsetWidth
      const cellHeight =
        splitMode === "vertical"
          ? (container.offsetHeight - 2) / 2
          : container.offsetHeight
      const containerCenterX = cellWidth / 2
      const containerCenterY = cellHeight / 2

      // 理想的なスクロール位置（設問を中央に）
      const idealScrollLeft = questionCenterScreenX - containerCenterX
      const idealScrollTop = questionCenterScreenY - containerCenterY

      // はみ出さないように制限
      const maxScrollLeft = container.scrollWidth - container.offsetWidth
      const maxScrollTop = container.scrollHeight - container.offsetHeight
      const scrollLeft = Math.max(0, Math.min(idealScrollLeft, maxScrollLeft))
      const scrollTop = Math.max(0, Math.min(idealScrollTop, maxScrollTop))

      container.scrollTo({
        left: scrollLeft,
        top: scrollTop,
        behavior: "smooth",
      })
    })
  }, [
    currentCropRegion,
    containerRef,
    imageLoaded,
    loadedImages,
    pageSpacing,
    zoom,
    splitMode,
  ])
}
