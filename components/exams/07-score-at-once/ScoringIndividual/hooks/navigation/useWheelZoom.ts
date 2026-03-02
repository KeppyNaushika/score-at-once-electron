/**
 * @fileoverview ホイールズームフック
 * Ctrl/Meta + ホイールでマウス位置を基準にズームする
 */
import { useEffect } from "react"

import { ZOOM_SETTINGS } from "@/components/exams/07-score-at-once/ScoringIndividual/constants/drawingConstants"

/** ホイールズームフックのプロパティ */
interface UseWheelZoomProps {
  /** コンテナ参照 */
  containerRef: React.RefObject<HTMLDivElement | null>
  /** 現在のズーム倍率 */
  zoom: number
  /** ズーム変更時のコールバック */
  onZoomChange: (zoom: number) => void
}

/**
 * ホイールズームフック
 *
 * @description
 * Ctrl/Meta + マウスホイールでズームを制御する。
 * マウス位置を基準にズームすることで、
 * ユーザーが注目している箇所を維持する。
 *
 * @param props - フックのプロパティ
 */
export function useWheelZoom({
  containerRef,
  zoom,
  onZoomChange,
}: UseWheelZoomProps) {
  // Passive event listener回避のためのwheel処理
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheelCapture = (e: WheelEvent) => {
      // Ctrl + ホイール: ズーム（マウス位置を基準）
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault() // passive: falseなので動作する

        const rect = container.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top

        // ズーム適用
        const zoomDelta =
          e.deltaY > 0 ? ZOOM_SETTINGS.wheelDelta : ZOOM_SETTINGS.zoomInDelta
        const newZoom = Math.min(
          Math.max(zoom * zoomDelta, ZOOM_SETTINGS.min),
          ZOOM_SETTINGS.max
        )

        // マウス位置を基準とした座標計算
        const currentScrollMouseX = container.scrollLeft + mouseX
        const currentScrollMouseY = container.scrollTop + mouseY

        // スケール前の画像上の座標
        const imageMouseX = currentScrollMouseX / zoom
        const imageMouseY = currentScrollMouseY / zoom

        // 新しいズームでの同じ画像位置の画面座標
        const newScrollMouseX = imageMouseX * newZoom
        const newScrollMouseY = imageMouseY * newZoom

        // マウス位置を維持するための新しいスクロール位置
        const newScrollLeft = newScrollMouseX - mouseX
        const newScrollTop = newScrollMouseY - mouseY

        onZoomChange(newZoom)

        // スクロール位置を調整（次のフレームで実行）
        requestAnimationFrame(() => {
          container.scrollTo(newScrollLeft, newScrollTop)
        })
      }
      // その他のホイール操作はネイティブスクロールに委ねる（preventDefault不要）
    }

    // passive: false を明示指定
    container.addEventListener("wheel", handleWheelCapture, { passive: false })

    return () => {
      container.removeEventListener("wheel", handleWheelCapture)
    }
  }, [containerRef, zoom, onZoomChange])
}
