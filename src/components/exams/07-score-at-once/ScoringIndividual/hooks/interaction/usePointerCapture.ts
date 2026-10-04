/**
 * @fileoverview 掴んでいる間のポインターキャプチャ
 * 要素を掴んだらキャンバスにポインターを捕まえさせ、キャンバスの外へ出ても
 * 離すまでの移動を受け取る。
 */
import { useCallback, useState } from "react"

/**
 * ポインターキャプチャの開始・解放
 *
 * @param canvasRef - ポインターを捕まえるキャンバス
 */
export function usePointerCapture(
  canvasRef: React.RefObject<HTMLCanvasElement | null>
) {
  const [capturedPointerId, setCapturedPointerId] = useState<number | null>(
    null
  )

  /** ポインターイベントなら捕まえる（マウスイベントには pointerId が無い） */
  const capturePointer = useCallback(
    (originalEvent?: PointerEvent | MouseEvent) => {
      if (!originalEvent || !("pointerId" in originalEvent)) return
      const canvas = canvasRef.current
      if (!canvas) return
      try {
        canvas.setPointerCapture(originalEvent.pointerId)
        setCapturedPointerId(originalEvent.pointerId)
      } catch {
        // キャプチャ失敗は無視
      }
    },
    [canvasRef]
  )

  /** 捕まえていれば放す。捕まえた記録も消す */
  const releasePointer = useCallback(
    (originalEvent?: PointerEvent | MouseEvent) => {
      if (
        capturedPointerId !== null &&
        originalEvent &&
        "pointerId" in originalEvent
      ) {
        const canvas = canvasRef.current
        if (canvas) {
          try {
            canvas.releasePointerCapture(originalEvent.pointerId)
          } catch {
            // リリース失敗は無視
          }
        }
      }
      setCapturedPointerId(null)
    },
    [canvasRef, capturedPointerId]
  )

  return { capturePointer, releasePointer }
}
