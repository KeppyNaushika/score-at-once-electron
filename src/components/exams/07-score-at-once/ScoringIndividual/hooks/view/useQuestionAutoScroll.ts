/**
 * @fileoverview 設問変更時自動スクロールフック
 * 設問が変更されたとき、選択設問を画面内で中央寄せ表示する
 */
import { useEffect } from "react"

import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import {
  locateQuestionOnCanvas,
  scrollCenteringCanvasPoint,
} from "./scrollGeometry"

/** 設問変更時自動スクロールフックのパラメータ */
interface UseQuestionAutoScrollParams {
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
  currentCropRegion?: QuestionAnswerRegionRow | null
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

    const questionLocation = locateQuestionOnCanvas(
      currentCropRegion,
      loadedImages,
      pageSpacing
    )
    if (!questionLocation) return

    // 次のフレームでスクロール位置を調整
    requestAnimationFrame(() => {
      // 理想的なスクロール位置（設問を中央に）
      const idealScroll = scrollCenteringCanvasPoint(
        container,
        splitMode,
        { x: questionLocation.centerX, y: questionLocation.centerY },
        zoom
      )

      // はみ出さないように制限
      const maxScrollLeft = container.scrollWidth - container.offsetWidth
      const maxScrollTop = container.scrollHeight - container.offsetHeight
      const scrollLeft = Math.max(0, Math.min(idealScroll.left, maxScrollLeft))
      const scrollTop = Math.max(0, Math.min(idealScroll.top, maxScrollTop))

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
