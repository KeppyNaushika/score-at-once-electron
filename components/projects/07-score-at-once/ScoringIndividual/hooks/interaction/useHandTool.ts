/**
 * @fileoverview ハンドツールフック
 * コンテナのドラッグスクロール（パン操作）を管理
 */
import { useCallback } from "react"

/** ハンドツールフックのプロパティ */
interface UseHandToolHandlersProps {
  /** コンテナ参照 */
  containerRef: React.RefObject<HTMLDivElement | null>
  /** 現在のツール */
  currentTool: string
  /** ドラッグ中フラグ */
  isDraggingElement: boolean
  /** ドラッグオフセット */
  dragElementOffset: { x: number; y: number }
  /** ドラッグ状態設定関数 */
  setIsDraggingElement: (dragging: boolean) => void
  /** ドラッグオフセット設定関数 */
  setDragElementOffset: (offset: { x: number; y: number }) => void
}

/**
 * ハンドツールフック
 *
 * @description
 * ハンドツール選択時のドラッグ操作で
 * コンテナをスクロールさせる（パン操作）機能を提供する。
 *
 * @param props - フックのプロパティ
 * @returns マウスイベントハンドラー
 */
export function useHandTool({
  containerRef,
  currentTool,
  isDraggingElement,
  dragElementOffset,
  setIsDraggingElement,
  setDragElementOffset,
}: UseHandToolHandlersProps) {
  // handツールのマウスダウン処理
  const handleHandToolMouseDown = useCallback(
    (screenCoords: { x: number; y: number }) => {
      if (currentTool !== "hand") return false

      // コンテナのスクロール移動を開始
      setIsDraggingElement(true)
      setDragElementOffset({
        x: screenCoords.x,
        y: screenCoords.y,
      })
      return true
    },
    [currentTool, setIsDraggingElement, setDragElementOffset],
  )

  // handツールのマウス移動処理
  const handleHandToolMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDraggingElement || currentTool !== "hand") return false

      const container = containerRef.current
      if (!container) return false

      // スクリーン座標の差分を計算
      const deltaX = e.clientX - dragElementOffset.x
      const deltaY = e.clientY - dragElementOffset.y

      // コンテナのスクロール位置を更新（逆方向）
      container.scrollLeft -= deltaX
      container.scrollTop -= deltaY

      // 次回計算用に現在位置を更新
      setDragElementOffset({
        x: e.clientX,
        y: e.clientY,
      })
      return true
    },
    [
      isDraggingElement,
      currentTool,
      containerRef,
      dragElementOffset.x,
      dragElementOffset.y,
      setDragElementOffset,
    ],
  )

  // handツールのマウスアップ処理
  const handleHandToolMouseUp = useCallback(() => {
    if (!isDraggingElement || currentTool !== "hand") return false

    setIsDraggingElement(false)
    return true
  }, [isDraggingElement, currentTool, setIsDraggingElement])

  return {
    handleHandToolMouseDown,
    handleHandToolMouseMove,
    handleHandToolMouseUp,
  }
}
