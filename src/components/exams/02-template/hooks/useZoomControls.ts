/**
 * Custom hook for managing zoom functionality
 *
 * Features:
 * - Keyboard zoom controls (Ctrl + +/-, Ctrl + 0)
 * - Mouse wheel zoom with Ctrl key
 * - Zoom level management (0.1 to 5.0 range)
 *
 * @returns Object containing zoom state and handlers, and refs for the
 *   focusable scroll container and the image container
 */

import { useEffect, useRef, useState } from "react"

/** キーボード・マウスホイールによるズーム操作を管理するフック */
export function useZoomControls() {
  // フォーカスを受けるのは外側のスクロール枠（tabIndex を持つ）。内側の画像の枠は
  // フォーカスを受けないので、キーボードのズームはスクロール枠で判定する
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const imageContainerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [showZoomHelp, setShowZoomHelp] = useState(true)

  /**
   * Handle keyboard zoom controls
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ズーム機能（ImageCanvasがフォーカスされているとき）
      if (
        scrollContainerRef.current &&
        scrollContainerRef.current.contains(document.activeElement)
      ) {
        switch (e.key) {
          case "+":
          case "=":
            if (e.ctrlKey) {
              e.preventDefault()
              e.stopPropagation()
              setZoom((prev) => Math.min(5, prev + 0.1))
            }
            break
          case "-":
            if (e.ctrlKey) {
              e.preventDefault()
              e.stopPropagation()
              setZoom((prev) => Math.max(0.1, prev - 0.1))
            }
            break
          case "0":
            if (e.ctrlKey) {
              e.preventDefault()
              e.stopPropagation()
              setZoom(1)
            }
            break
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  /**
   * Handle mouse wheel zoom
   */
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault()
        const zoomSpeed = 0.005
        const newZoom = zoom - e.deltaY * zoomSpeed
        setZoom(Math.max(0.1, Math.min(5, newZoom)))
      }
    }

    const container = imageContainerRef.current
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false })
    }

    return () => {
      if (container) {
        container.removeEventListener("wheel", handleWheel)
      }
    }
  }, [zoom, imageContainerRef])

  return {
    zoom,
    showZoomHelp,
    setShowZoomHelp,
    scrollContainerRef,
    imageContainerRef,
  }
}
