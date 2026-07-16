/**
 * @fileoverview カーソル管理フック
 * キャンバス上のカーソルスタイル管理とリサイズカーソル判定
 */
import { useCallback } from "react"

import type { DrawingElement } from "@/components/exams/07-score-at-once/ScoringIndividual/types"

/** カーソルスタイルの種類 */
export type CursorStyle =
  | "normal"
  | "move"
  | "crosshair"
  | "pointer"
  | "grab"
  | "grabbing"
  | "text"
  | "ns-resize"
  | "ew-resize"
  | "nesw-resize"
  | "nwse-resize"

/** カーソル管理フックのプロパティ */
export interface UseCursorProps {
  /** キャンバス参照 */
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  /** ヒットテストハンドル関数（オプション） */
  hitTestHandle?: (
    element: DrawingElement,
    x: number,
    y: number
  ) => string | null
}

/** カーソル管理フックの戻り値 */
export interface UseCursorReturn {
  /** カーソルスタイルを設定 */
  setCursor: (cursorStyle: CursorStyle) => void
  /** カーソルをリセット（normalに戻す） */
  resetCursor: () => void
  /** リサイズカーソルの種類を取得 */
  getResizeCursor: (
    element: DrawingElement | null,
    handle: string
  ) => CursorStyle
}

/**
 * カーソル管理フック
 *
 * @description
 * キャンバス上のカーソルスタイルを管理する。
 * リサイズハンドルに応じた適切なカーソルを判定する。
 *
 * @param props - フックのプロパティ
 * @returns カーソル管理関数
 */
export function useCursor({ canvasRef }: UseCursorProps): UseCursorReturn {
  /**
   * カーソルスタイルを設定
   *
   * @param cursorStyle - 設定するカーソルスタイル
   */
  const setCursor = useCallback(
    (cursorStyle: CursorStyle) => {
      const canvas = canvasRef.current
      if (canvas) {
        canvas.style.cursor = cursorStyle
      }
    },
    [canvasRef]
  )

  /**
   * カーソルをリセット（normalに戻す）
   */
  const resetCursor = useCallback(() => {
    setCursor("normal")
  }, [setCursor])

  /**
   * リサイズカーソルの種類を取得
   *
   * @description
   * 要素タイプとハンドル位置に応じて適切なカーソルを返す。
   * 線の場合は方向に応じたカーソル、矩形の場合は角に応じたカーソル。
   *
   * @param element - 対象要素（nullの場合はデフォルト）
   * @param handle - ハンドル名
   * @returns カーソルスタイル
   */
  const getResizeCursor = useCallback(
    (element: DrawingElement | null, handle: string): CursorStyle => {
      if (!element) {
        // 要素がない場合はハンドル名から推測
        const cursorMap: Record<string, CursorStyle> = {
          "top-left": "nwse-resize",
          "top-right": "nesw-resize",
          "bottom-left": "nesw-resize",
          "bottom-right": "nwse-resize",
          top: "ns-resize",
          bottom: "ns-resize",
          left: "ew-resize",
          right: "ew-resize",
        }
        return cursorMap[handle] || "nwse-resize"
      }

      switch (element.type) {
        case "line": {
          if (element.endX === undefined || element.endY === undefined) {
            return "move"
          }
          // 線分の方向を計算してリサイズカーソルを決定
          const deltaX = element.endX - element.x
          const deltaY = element.endY - element.y
          const angle = Math.atan2(deltaY, deltaX)
          let degrees = (Math.abs(angle) * 180) / Math.PI
          if (degrees > 90) degrees = 180 - degrees

          if (degrees <= 5) {
            return "ew-resize" // 水平
          } else if (degrees >= 85) {
            return "ns-resize" // 垂直
          } else {
            return deltaX * deltaY > 0 ? "nwse-resize" : "nesw-resize"
          }
        }

        case "rectangle":
        case "ellipse":
        case "text":
          switch (handle) {
            case "top-left":
            case "bottom-right":
              return "nwse-resize"
            case "top-right":
            case "bottom-left":
              return "nesw-resize"
            case "top":
            case "bottom":
              return "ns-resize"
            case "left":
            case "right":
              return "ew-resize"
            default:
              return "move"
          }

        default:
          return "move"
      }
    },
    []
  )

  return {
    setCursor,
    resetCursor,
    getResizeCursor,
  }
}
