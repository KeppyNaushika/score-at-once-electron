/**
 * @fileoverview 新規描画要素作成フック
 * 線・矩形・楕円・テキストの新規作成を管理
 */
import { useCallback, useRef } from "react"

import type { DrawingElement } from "@/components/exams/07-score-at-once/ScoringIndividual/types"
import type { LineStyle } from "@/types/drawingAnnotation.types"

/** 新規描画作成フックのプロパティ */
export interface UseDrawingCreationProps {
  /** 現在のツール */
  currentTool: string
  /** 描画中フラグ */
  isDrawing: boolean
  /** 描画要素配列 */
  drawingElements: DrawingElement[]
  /** Shiftキー押下状態 */
  isShiftPressed: boolean
  /** 線の色 */
  strokeColor: string
  /** 線の太さ */
  strokeWidth: number
  /** 線のスタイル */
  lineStyle: LineStyle
  /** 画像のアスペクト比（width/height） */
  imageAspectRatio?: number
  /** 描画中フラグ設定 */
  setIsDrawing: (drawing: boolean) => void
  /** 描画要素配列設定 */
  setDrawingElements: (
    elements: DrawingElement[] | ((prev: DrawingElement[]) => DrawingElement[])
  ) => void
  /** 描画要素追加（DB保存付き） */
  addDrawingElement: (element: DrawingElement) => void
  /** テキストアンカークリック時のコールバック */
  onTextAnchorClick?: (position: { x: number; y: number }) => void
}

/** 新規描画作成フックの戻り値 */
export interface UseDrawingCreationReturn {
  /** マウスダウン時の処理 */
  handleNewDrawingMouseDown: (imageCoords: { x: number; y: number }) => boolean
  /** マウス移動時の処理 */
  handleNewDrawingMouseMove: (imageCoords: { x: number; y: number }) => boolean
  /** マウスアップ時の処理 */
  handleNewDrawingMouseUp: () => boolean
}

/**
 * 新規描画要素作成フック
 *
 * @description
 * 線・矩形・楕円の新規描画を管理する。
 * Shiftキーによる制約（水平/垂直線、正方形/正円）をサポート。
 * 描画完了時にDBへ保存する。
 *
 * @param props - フックのプロパティ
 * @returns 描画ハンドラー
 */
export function useDrawingCreation({
  currentTool,
  isDrawing,
  drawingElements,
  isShiftPressed,
  strokeColor,
  strokeWidth,
  lineStyle,
  imageAspectRatio = 1,
  setIsDrawing,
  setDrawingElements,
  addDrawingElement,
  onTextAnchorClick,
}: UseDrawingCreationProps): UseDrawingCreationReturn {
  // 描画中の要素を追跡（描画完了時にDB保存するため）
  const drawingElementRef = useRef<DrawingElement | null>(null)

  /**
   * Shift制約を適用（正方形/正円）
   *
   * @description
   * 正規化座標で同じ値にすると画像のアスペクト比により縦横比が崩れる。
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

      // ピクセル相当サイズで比較（imageHeightを基準に正規化）
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
   * Shift制約を適用（水平・垂直線）
   *
   * @param startX - 開始X座標
   * @param startY - 開始Y座標
   * @param endX - 終了X座標
   * @param endY - 終了Y座標
   * @returns 制約適用後の終了座標
   */
  const applyLineShiftConstraint = useCallback(
    (
      startX: number,
      startY: number,
      endX: number,
      endY: number
    ): { endX: number; endY: number } => {
      if (!isShiftPressed) {
        return { endX, endY }
      }
      const deltaX = Math.abs(endX - startX)
      const deltaY = Math.abs(endY - startY)

      if (deltaX > deltaY) {
        return { endX, endY: startY }
      } else {
        return { endX: startX, endY }
      }
    },
    [isShiftPressed]
  )

  /**
   * マウスダウン時の処理
   *
   * @description
   * 新規要素を作成し、ローカル状態に追加する。
   * テキストツールの場合はアンカークリックコールバックを呼び出す。
   *
   * @param imageCoords - 画像座標（正規化）
   * @returns 処理されたかどうか
   */
  const handleNewDrawingMouseDown = useCallback(
    (imageCoords: { x: number; y: number }): boolean => {
      // テキストツール
      if (currentTool === "text") {
        if (onTextAnchorClick) {
          onTextAnchorClick(imageCoords)
        }
        return true
      }

      // 線の新規作成
      if (currentTool === "line") {
        const newElement: DrawingElement = {
          id: crypto.randomUUID(),
          type: "line",
          x: imageCoords.x,
          y: imageCoords.y,
          endX: imageCoords.x,
          endY: imageCoords.y,
          color: strokeColor,
          strokeWidth,
          lineStyle,
        }
        setDrawingElements((prev) => [...prev, newElement])
        drawingElementRef.current = newElement
        setIsDrawing(true)
        return true
      }

      // 矩形の新規作成
      if (currentTool === "rectangle") {
        const newElement: DrawingElement = {
          id: crypto.randomUUID(),
          type: "rectangle",
          x: imageCoords.x,
          y: imageCoords.y,
          width: 0,
          height: 0,
          color: strokeColor,
          strokeWidth,
        }
        setDrawingElements((prev) => [...prev, newElement])
        drawingElementRef.current = newElement
        setIsDrawing(true)
        return true
      }

      // 楕円の新規作成
      if (currentTool === "ellipse") {
        const newElement: DrawingElement = {
          id: crypto.randomUUID(),
          type: "ellipse",
          x: imageCoords.x,
          y: imageCoords.y,
          width: 0,
          height: 0,
          color: strokeColor,
          strokeWidth,
        }
        setDrawingElements((prev) => [...prev, newElement])
        drawingElementRef.current = newElement
        setIsDrawing(true)
        return true
      }

      return false
    },
    [
      currentTool,
      strokeColor,
      strokeWidth,
      lineStyle,
      setIsDrawing,
      setDrawingElements,
      onTextAnchorClick,
    ]
  )

  /**
   * マウス移動時の処理
   *
   * @description
   * 描画中の要素のサイズ/終点を更新する。
   * Shift制約を適用する。
   *
   * @param imageCoords - 画像座標（正規化）
   * @returns 処理されたかどうか
   */
  const handleNewDrawingMouseMove = useCallback(
    (imageCoords: { x: number; y: number }): boolean => {
      if (!isDrawing || !drawingElementRef.current) return false

      const elementId = drawingElementRef.current.id
      const elementType = drawingElementRef.current.type

      if (elementType === "line") {
        const constrained = applyLineShiftConstraint(
          drawingElementRef.current.x,
          drawingElementRef.current.y,
          imageCoords.x,
          imageCoords.y
        )

        setDrawingElements((prev) =>
          prev.map((element) =>
            element.id === elementId
              ? { ...element, endX: constrained.endX, endY: constrained.endY }
              : element
          )
        )
        return true
      }

      if (elementType === "rectangle" || elementType === "ellipse") {
        const startX = drawingElementRef.current.x
        const startY = drawingElementRef.current.y
        let width = imageCoords.x - startX
        let height = imageCoords.y - startY

        const constrained = applyShiftConstraint(width, height)
        width = constrained.width
        height = constrained.height

        setDrawingElements((prev) =>
          prev.map((element) =>
            element.id === elementId ? { ...element, width, height } : element
          )
        )
        return true
      }

      return false
    },
    [
      isDrawing,
      applyLineShiftConstraint,
      applyShiftConstraint,
      setDrawingElements,
    ]
  )

  /**
   * マウスアップ時の処理
   *
   * @description
   * 描画を完了し、DBへ保存する。
   * ローカル状態の一時要素を削除し、addDrawingElementで再追加。
   *
   * @returns 処理されたかどうか
   */
  const handleNewDrawingMouseUp = useCallback((): boolean => {
    if (!isDrawing || !drawingElementRef.current) return false

    const elementId = drawingElementRef.current.id

    const finalElement = drawingElements.find(
      (element) => element.id === elementId
    )
    if (!finalElement) {
      drawingElementRef.current = null
      setIsDrawing(false)
      return false
    }

    // ローカル状態から一時要素を削除
    setDrawingElements((prev) =>
      prev.filter((element) => element.id !== elementId)
    )

    // addDrawingElementでローカル状態に再追加＆DB保存
    addDrawingElement(finalElement)

    drawingElementRef.current = null
    setIsDrawing(false)
    return true
  }, [
    isDrawing,
    drawingElements,
    setIsDrawing,
    setDrawingElements,
    addDrawingElement,
  ])

  return {
    handleNewDrawingMouseDown,
    handleNewDrawingMouseMove,
    handleNewDrawingMouseUp,
  }
}
