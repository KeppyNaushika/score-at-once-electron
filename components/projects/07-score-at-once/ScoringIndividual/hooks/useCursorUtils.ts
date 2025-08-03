import { useCallback } from "react"

interface UseCursorUtilsProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
}

export function useCursorUtils({ canvasRef }: UseCursorUtilsProps) {
  // カーソルスタイルを設定
  const setCursor = useCallback(
    (
      cursorStyle:
        | "normal"
        | "move"
        | "crosshair"
        | "pointer"
        | "grab"
        | "grabbing"
        | "ns-resize"
        | "ew-resize"
        | "nesw-resize"
        | "nwse-resize",
    ) => {
      const canvas = canvasRef.current
      if (canvas) {
        canvas.style.cursor = cursorStyle
      }
    },
    [canvasRef],
  )

  // カーソルをリセット（normal に戻す）
  const resetCursor = useCallback(() => {
    setCursor("normal")
  }, [setCursor])

  return {
    setCursor,
    resetCursor,
  }
}
