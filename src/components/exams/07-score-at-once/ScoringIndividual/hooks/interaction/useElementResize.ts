/**
 * @fileoverview 要素リサイズフック
 * 矩形・楕円・テキストボックスのリサイズを管理
 */
import { useCallback } from "react"

import type { DrawingElement } from "@/components/exams/07-score-at-once/ScoringIndividual/types"

/** リサイズの元の境界 */
export interface ResizeOriginalBounds {
  x: number
  y: number
  width: number
  height: number
}

/** 要素リサイズフックのプロパティ */
interface UseElementResizeProps {
  /** Shiftキー押下状態 */
  isShiftPressed: boolean
  /** 画像のアスペクト比（width/height） */
  imageAspectRatio?: number
  /** 描画要素配列設定 */
  setDrawingElements: (
    elements: DrawingElement[] | ((prev: DrawingElement[]) => DrawingElement[])
  ) => void
  /** ヒットテストハンドル関数 */
  hitTestHandle: (
    element: DrawingElement,
    x: number,
    y: number
  ) => string | null
}

/** 要素リサイズフックの戻り値 */
interface UseElementResizeReturn {
  /** リサイズハンドルを取得 */
  getResizeHandle: (
    normalizedX: number,
    normalizedY: number,
    element: DrawingElement
  ) => string | null
  /** 要素をリサイズ */
  handleElementResize: (
    normalizedX: number,
    normalizedY: number,
    handle: string,
    element: DrawingElement,
    originalBounds: ResizeOriginalBounds
  ) => void
}

/**
 * 要素リサイズフック
 *
 * @description
 * 矩形・楕円・テキストボックスのリサイズを管理する。
 * Shiftキーによる正方形/正円制約をサポート。
 * 座標は0-1の正規化座標で処理する。
 *
 * @param props - フックのプロパティ
 * @returns リサイズハンドラー
 */
export function useElementResize({
  isShiftPressed,
  imageAspectRatio = 1,
  setDrawingElements,
  hitTestHandle,
}: UseElementResizeProps): UseElementResizeReturn {
  /**
   * 負値の幅・高さを正規化
   *
   * @param x - X座標
   * @param y - Y座標
   * @param width - 幅
   * @param height - 高さ
   * @returns 正規化された座標とサイズ
   */
  const normalizeNegativeDimensions = useCallback(
    (x: number, y: number, width: number, height: number) => {
      let normalizedX = x
      let normalizedY = y
      let normalizedWidth = width
      let normalizedHeight = height

      if (width < 0) {
        normalizedX = x + width
        normalizedWidth = Math.abs(width)
      }

      if (height < 0) {
        normalizedY = y + height
        normalizedHeight = Math.abs(height)
      }

      return {
        x: normalizedX,
        y: normalizedY,
        width: normalizedWidth,
        height: normalizedHeight,
      }
    },
    []
  )

  /**
   * 正規化座標での境界制限
   *
   * @param x - X座標
   * @param y - Y座標
   * @param width - 幅
   * @param height - 高さ
   * @returns 0-1の範囲に制限された座標とサイズ
   */
  const clampNormalized = useCallback(
    (x: number, y: number, width: number, height: number) => {
      const normalized = normalizeNegativeDimensions(x, y, width, height)

      const clampedX = Math.max(0, Math.min(1, normalized.x))
      const clampedY = Math.max(0, Math.min(1, normalized.y))

      const maxWidth = 1 - clampedX
      const maxHeight = 1 - clampedY
      const clampedWidth = Math.min(maxWidth, normalized.width)
      const clampedHeight = Math.min(maxHeight, normalized.height)

      return {
        x: clampedX,
        y: clampedY,
        width: clampedWidth,
        height: clampedHeight,
      }
    },
    [normalizeNegativeDimensions]
  )

  /**
   * Shift制約を適用（正方形/正円）
   *
   * @description
   * ピクセル単位で同じサイズになるよう変換する。
   *
   * @param width - 幅（正規化座標）
   * @param height - 高さ（正規化座標）
   * @returns 制約適用後の幅と高さ
   */
  const applyShiftConstraint = useCallback(
    (width: number, height: number): { width: number; height: number } => {
      if (!isShiftPressed) {
        return { width, height }
      }
      const absWidth = Math.abs(width)
      const absHeight = Math.abs(height)

      const pixelWidthRelative = absWidth * imageAspectRatio
      const pixelHeightRelative = absHeight

      if (pixelWidthRelative <= pixelHeightRelative) {
        const constrainedHeight = absWidth * imageAspectRatio
        return {
          width: width >= 0 ? absWidth : -absWidth,
          height: height >= 0 ? constrainedHeight : -constrainedHeight,
        }
      } else {
        const constrainedWidth = absHeight / imageAspectRatio
        return {
          width: width >= 0 ? constrainedWidth : -constrainedWidth,
          height: height >= 0 ? absHeight : -absHeight,
        }
      }
    },
    [isShiftPressed, imageAspectRatio]
  )

  /**
   * リサイズハンドルを取得
   *
   * @description
   * hitTestHandleを使用してズーム調整済みの許容値で判定。
   * 線要素はハンドルを持たない。
   *
   * @param normalizedX - X座標（正規化）
   * @param normalizedY - Y座標（正規化）
   * @param element - 対象要素
   * @returns ハンドル名またはnull
   */
  const getResizeHandle = useCallback(
    (
      normalizedX: number,
      normalizedY: number,
      element: DrawingElement
    ): string | null => {
      if (element.type === "line") {
        return null
      }
      return hitTestHandle(element, normalizedX, normalizedY)
    },
    [hitTestHandle]
  )

  /**
   * 要素をリサイズ
   *
   * @description
   * ハンドル位置に応じて要素のサイズと位置を更新する。
   * Shift制約を適用し、座標を0-1にクランプする。
   *
   * @param normalizedX - マウスX座標（正規化）
   * @param normalizedY - マウスY座標（正規化）
   * @param handle - ハンドル名
   * @param element - 対象要素
   * @param originalBounds - 元の境界
   */
  const handleElementResize = useCallback(
    (
      normalizedX: number,
      normalizedY: number,
      handle: string,
      element: DrawingElement,
      originalBounds: ResizeOriginalBounds
    ) => {
      const clampedMouseX = Math.max(0, Math.min(1, normalizedX))
      const clampedMouseY = Math.max(0, Math.min(1, normalizedY))

      let newX = originalBounds.x
      let newY = originalBounds.y
      let newWidth = originalBounds.width
      let newHeight = originalBounds.height

      switch (handle) {
        case "top-left":
          newWidth = originalBounds.x + originalBounds.width - clampedMouseX
          newHeight = originalBounds.y + originalBounds.height - clampedMouseY
          newX = clampedMouseX
          newY = clampedMouseY
          break
        case "top-right":
          newWidth = clampedMouseX - originalBounds.x
          newHeight = originalBounds.y + originalBounds.height - clampedMouseY
          newY = clampedMouseY
          break
        case "bottom-left":
          newWidth = originalBounds.x + originalBounds.width - clampedMouseX
          newHeight = clampedMouseY - originalBounds.y
          newX = clampedMouseX
          break
        case "bottom-right":
          newWidth = clampedMouseX - originalBounds.x
          newHeight = clampedMouseY - originalBounds.y
          break
      }

      // Shift制約を適用
      if (isShiftPressed) {
        const constrained = applyShiftConstraint(newWidth, newHeight)
        if (handle === "top-left") {
          newX =
            originalBounds.x +
            originalBounds.width -
            Math.abs(constrained.width)
          newY =
            originalBounds.y +
            originalBounds.height -
            Math.abs(constrained.height)
        } else if (handle === "top-right") {
          newY =
            originalBounds.y +
            originalBounds.height -
            Math.abs(constrained.height)
        } else if (handle === "bottom-left") {
          newX =
            originalBounds.x +
            originalBounds.width -
            Math.abs(constrained.width)
        }
        newWidth = constrained.width
        newHeight = constrained.height
      }

      const clamped = clampNormalized(newX, newY, newWidth, newHeight)

      setDrawingElements((prev) =>
        prev.map((drawingElement) => {
          if (drawingElement.id === element.id) {
            if (drawingElement.type === "text") {
              return {
                ...drawingElement,
                x: clamped.x,
                y: clamped.y,
                textBoxWidth: clamped.width,
                textBoxHeight: clamped.height,
              }
            } else {
              return {
                ...drawingElement,
                x: clamped.x,
                y: clamped.y,
                width: clamped.width,
                height: clamped.height,
              }
            }
          }
          return drawingElement
        })
      )
    },
    [isShiftPressed, applyShiftConstraint, clampNormalized, setDrawingElements]
  )

  return {
    getResizeHandle,
    handleElementResize,
  }
}
