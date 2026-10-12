/**
 * @fileoverview ズーム・スクロールの位置計算
 * 設問表示（useZoomAndScroll）と設問変更時の自動スクロール（useQuestionAutoScroll）が
 * 同じ式で設問の位置とスクロール位置を求めるための純粋関数
 */
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import {
  loadedPageIndexOfCropRegion,
  pagePlacementAt,
} from "../../utils/canvasPageLayout"

/** ズームを変えてもビューポート中心の画像上の位置が動かないスクロール位置 */
export function scrollKeepingViewportCenter(
  container: HTMLDivElement,
  zoom: number,
  newZoom: number
): { left: number; top: number } {
  const viewportCenterX = container.offsetWidth / 2
  const viewportCenterY = container.offsetHeight / 2

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
  return {
    left: newScrollCenterX - viewportCenterX,
    top: newScrollCenterY - viewportCenterY,
  }
}

/**
 * 設問が載っているページの画像と、設問の中心のキャンバス上の座標（ズーム前）
 *
 * ページは描画側と同じ `loadedPageIndexOfCropRegion`（examPageId で同定）で決める。
 * その生徒の答案に設問のページが無ければ null（スクロールしない）。
 * 画像の大きさ・縦横のずれもそのページのものを使う。
 */
export function locateQuestionOnCanvas(
  cropRegion: QuestionAnswerRegionRow,
  loadedImages: HTMLImageElement[],
  loadedExamPageIds: readonly string[],
  pageSpacing: number
): {
  questionImage: HTMLImageElement
  centerX: number
  centerY: number
} | null {
  // 設問が属するページ（描画と同じ添字）
  const questionPageIndex = loadedPageIndexOfCropRegion(
    cropRegion,
    loadedExamPageIds
  )
  if (questionPageIndex === null || !loadedImages[questionPageIndex]) {
    return null
  }
  const {
    pageImage: questionImage,
    offsetX,
    offsetY,
  } = pagePlacementAt(loadedImages, questionPageIndex, pageSpacing)

  // 設問領域の中心座標（設問ページの画像内の実際のピクセル座標）に、
  // ページの左上（幅の狭いページの中央寄せ・前のページの高さと余白）を足す
  return {
    questionImage,
    centerX:
      (cropRegion.x + cropRegion.width / 2) * questionImage.naturalWidth +
      offsetX,
    centerY:
      (cropRegion.y + cropRegion.height / 2) * questionImage.naturalHeight +
      offsetY,
  }
}

/** キャンバス上の点（ズーム前）を、ズーム後にコンテナの中心へ置くスクロール位置（範囲の制限なし） */
export function scrollCenteringCanvasPoint(
  container: HTMLDivElement,
  canvasPoint: { x: number; y: number },
  zoom: number
): { left: number; top: number } {
  // 点の実際のCanvas上での位置（ズーム適用後）
  const screenX = canvasPoint.x * zoom
  const screenY = canvasPoint.y * zoom

  return {
    left: screenX - container.offsetWidth / 2,
    top: screenY - container.offsetHeight / 2,
  }
}
