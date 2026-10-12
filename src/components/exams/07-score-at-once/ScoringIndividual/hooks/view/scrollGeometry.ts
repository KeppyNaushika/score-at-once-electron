/**
 * @fileoverview ズーム・スクロールの位置計算
 * 設問表示（useZoomAndScroll）と設問変更時の自動スクロール（useQuestionAutoScroll）が
 * 同じ式で設問の位置とスクロール位置を求めるための純粋関数
 */
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import { pageOffsetX, pageOffsetY } from "../../utils/canvasPageLayout"

/** 表示に使える大きさ（split時はgridの1セル分、そうでなければコンテナ全体） */
export function splitCellSize(
  container: HTMLDivElement,
  splitMode: "horizontal" | "vertical" | null | undefined
): { width: number; height: number } {
  return {
    width:
      splitMode === "horizontal"
        ? (container.offsetWidth - 2) / 2
        : container.offsetWidth,
    height:
      splitMode === "vertical"
        ? (container.offsetHeight - 2) / 2
        : container.offsetHeight,
  }
}

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
 * ページ番号がページ数を超えるときは、画像は1ページ目で代用し、縦のずれは全ページ分を
 * 足す（描画側の `pageIndexOfCropRegion` は最後のページに丸めるので、ここと食い違う）。
 */
export function locateQuestionOnCanvas(
  cropRegion: QuestionAnswerRegionRow,
  loadedImages: HTMLImageElement[],
  pageSpacing: number
): {
  questionImage: HTMLImageElement
  centerX: number
  centerY: number
} | null {
  // 設問が属するページの画像を使用
  const questionPageNumber = cropRegion.examPage?.pageNumber || 1
  const questionPageIndex = questionPageNumber - 1 // 1ベース→0ベースに変換

  const questionImage = loadedImages[questionPageIndex] || loadedImages[0]
  if (!questionImage) return null

  // 設問領域の中心座標（設問ページの画像内の実際のピクセル座標）
  const questionCenterX =
    (cropRegion.x + cropRegion.width / 2) * questionImage.naturalWidth
  const questionCenterY =
    (cropRegion.y + cropRegion.height / 2) * questionImage.naturalHeight

  // 複数ページ表示の場合、設問が属するページのオフセットを計算
  // （1ページだけのときは、ページ番号が範囲外でもずらさない）
  const questionPageOffsetY =
    loadedImages.length > 1
      ? pageOffsetY(loadedImages, Math.max(0, questionPageIndex), pageSpacing)
      : 0

  // 画像の中央配置オフセットを考慮（Canvas幅は最初の画像幅）
  const questionPageOffsetX = pageOffsetX(
    loadedImages[0].naturalWidth,
    questionImage
  )

  return {
    questionImage,
    centerX: questionCenterX + questionPageOffsetX,
    centerY: questionCenterY + questionPageOffsetY,
  }
}

/** キャンバス上の点（ズーム前）を、ズーム後にセルの中心へ置くスクロール位置（範囲の制限なし） */
export function scrollCenteringCanvasPoint(
  container: HTMLDivElement,
  splitMode: "horizontal" | "vertical" | null | undefined,
  canvasPoint: { x: number; y: number },
  zoom: number
): { left: number; top: number } {
  // 点の実際のCanvas上での位置（ズーム適用後）
  const screenX = canvasPoint.x * zoom
  const screenY = canvasPoint.y * zoom

  // コンテナ中心座標（split時は1セル分の中心）
  const cellSize = splitCellSize(container, splitMode)

  return {
    left: screenX - cellSize.width / 2,
    top: screenY - cellSize.height / 2,
  }
}
