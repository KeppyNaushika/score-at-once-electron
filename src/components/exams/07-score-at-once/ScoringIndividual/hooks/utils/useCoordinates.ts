/**
 * @fileoverview 座標変換・座標取得フック
 * イベントからの座標取得と座標変換ユーティリティ
 */
import { useCallback } from "react"

import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import {
  canvasPointToPageCoordinates,
  loadedPageIndexOfCropRegion,
} from "../../utils/canvasPageLayout"

/** 座標フックのプロパティ */
interface UseCoordinatesProps {
  /** キャンバス参照 */
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  /** ズーム倍率 */
  zoom: number
  /** 読み込み済み画像配列（複数ページ対応用） */
  loadedImages?: HTMLImageElement[]
  /** loadedImages と同じ並びの、各画像のページ（ExamPage.id） */
  loadedExamPageIds?: string[]
  /** 現在の設問領域（描画要素はこの設問のページに属する） */
  currentCropRegion?: QuestionAnswerRegionRow | null
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

/** 既定値（毎レンダー新しい配列を作ると useCallback が作り直されるので定数で持つ） */
const NO_IMAGES: HTMLImageElement[] = []
const NO_EXAM_PAGE_IDS: string[] = []

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
  zoom,
  loadedImages = NO_IMAGES,
  loadedExamPageIds = NO_EXAM_PAGE_IDS,
  currentCropRegion,
  pageSpacing = 20,
}: UseCoordinatesProps): UseCoordinatesReturn {
  /**
   * イベントから画像座標（正規化）を取得
   *
   * @description
   * ポインターイベントからCSS scale方式を考慮して、**現在の設問のページ**の中の
   * 正規化座標（0-1。ページの外を指せば範囲を外れる）を計算する。
   * 描画要素は現在の設問に属し、そのページに描かれるので、クリックしたページでは
   * なく設問のページ（examPageId で同定）を基準にする。
   * その生徒の答案に設問のページが無ければ null（描画・選択を始めない）。
   *
   * @param e - マウス/ポインターイベント
   * @returns 正規化座標またはnull
   */
  const getImageCoordinatesFromEvent = useCallback(
    (e: React.MouseEvent | React.PointerEvent) => {
      const canvas = canvasRef.current
      if (!canvas || loadedImages.length === 0) return null

      const pageIndex = loadedPageIndexOfCropRegion(
        currentCropRegion,
        loadedExamPageIds
      )
      if (pageIndex === null) return null

      // CSS scale方式：Canvas要素がzoom倍サイズなので、Canvas内部座標に変換
      const rect = canvas.getBoundingClientRect()
      return canvasPointToPageCoordinates(
        {
          x: (e.clientX - rect.left) / zoom,
          y: (e.clientY - rect.top) / zoom,
        },
        loadedImages,
        pageIndex,
        pageSpacing
      )
    },
    [
      canvasRef,
      zoom,
      loadedImages,
      loadedExamPageIds,
      currentCropRegion,
      pageSpacing,
    ]
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
