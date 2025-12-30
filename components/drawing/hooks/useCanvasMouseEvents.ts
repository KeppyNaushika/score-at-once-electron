/**
 * @fileoverview キャンバスマウスイベントフック
 * @description マウスダウン、移動、アップイベントの処理を行う
 */

import { useCallback, useState, useRef } from "react"
import type {
  DrawingAnnotation,
  DrawingCreateData,
  DrawingType,
  DrawingUpdateData,
} from "@/types/drawingAnnotation.types"
import type { DrawingTool } from "@/hooks/useDrawingAnnotations"
import { getRelativeCoordinates } from "../utils/coordinateUtils"
import { isPointInAnnotation } from "../utils/hitDetection"

/**
 * フックのパラメータ
 */
export interface UseCanvasMouseEventsParams {
  /** キャンバスRef */
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  /** 読み取り専用モード */
  readOnly: boolean
  /** 現在のツール */
  currentTool: DrawingTool
  /** 描画色 */
  drawingColor: string
  /** 線の太さ */
  strokeWidth: number
  /** QuestionScoreのID */
  questionScoreId: string
  /** アノテーション一覧 */
  annotations: DrawingAnnotation[]
  /** 描画開始関数 */
  startDrawing: (data: Partial<DrawingCreateData>) => void
  /** 描画更新関数 */
  updateDrawing: (data: Partial<DrawingCreateData>) => void
  /** 描画完了関数 */
  finishDrawing: () => Promise<DrawingAnnotation | null>
  /** 描画キャンセル関数 */
  cancelDrawing: () => void
  /** アノテーション選択関数 */
  selectAnnotation: (id: string | null) => void
  /** アノテーション更新関数 */
  updateAnnotation: (
    id: string,
    data: DrawingUpdateData
  ) => Promise<DrawingAnnotation | null>
  /** テキストサイズ測定関数 */
  measureTextSize: (
    text: string,
    maxWidth: number,
    maxHeight: number
  ) => Promise<{ width: number; height: number }>
  /** 描画完了コールバック */
  onDrawingComplete?: (annotation: DrawingAnnotation) => void
  /** ローカルアノテーション更新関数 */
  setLocalAnnotations: React.Dispatch<React.SetStateAction<DrawingAnnotation[]>>
  /** 再描画関数 */
  redrawCanvas: () => void
}

/**
 * フックの戻り値
 */
export interface UseCanvasMouseEventsReturn {
  /** マウスダウンハンドラ */
  handleMouseDown: (event: React.MouseEvent) => void
  /** マウス移動ハンドラ */
  handleMouseMove: (event: React.MouseEvent) => void
  /** マウスアップハンドラ */
  handleMouseUp: (event: React.MouseEvent) => Promise<void>
  /** 描画開始点 */
  startPoint: { x: number; y: number } | null
  /** 現在のマウス位置 */
  currentPoint: { x: number; y: number } | null
  /** マウスダウン状態 */
  isMouseDown: boolean
}

/**
 * キャンバスマウスイベント処理フック
 */
export function useCanvasMouseEvents(
  params: UseCanvasMouseEventsParams
): UseCanvasMouseEventsReturn {
  const {
    canvasRef,
    readOnly,
    currentTool,
    drawingColor,
    strokeWidth,
    questionScoreId,
    annotations,
    startDrawing,
    updateDrawing,
    finishDrawing,
    cancelDrawing,
    selectAnnotation,
    updateAnnotation,
    measureTextSize,
    onDrawingComplete,
    setLocalAnnotations,
    redrawCanvas,
  } = params

  // 状態管理
  const [isMouseDown, setIsMouseDown] = useState(false)
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(
    null
  )
  const [currentPoint, setCurrentPoint] = useState<{
    x: number
    y: number
  } | null>(null)

  // 編集状態管理
  const [isEditingAnnotation, setIsEditingAnnotation] = useState(false)
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(
    null
  )
  const originalAnnotationRef = useRef<DrawingAnnotation | null>(null)

  /**
   * アノテーション編集開始
   */
  const startEditingAnnotation = useCallback(
    (annotation: DrawingAnnotation) => {
      console.log("Edit annotation start:", annotation.id)
      setIsEditingAnnotation(true)
      setEditingAnnotationId(annotation.id)
      originalAnnotationRef.current = annotation
      selectAnnotation(annotation.id)
    },
    [selectAnnotation]
  )

  /**
   * アノテーション編集完了
   */
  const finishEditingAnnotation = useCallback(
    async (updatedData: DrawingUpdateData) => {
      if (!editingAnnotationId || !originalAnnotationRef.current) return

      try {
        console.log("Save annotation:", editingAnnotationId, updatedData)
        await updateAnnotation(editingAnnotationId, updatedData)

        // 編集状態リセット
        setIsEditingAnnotation(false)
        setEditingAnnotationId(null)
        originalAnnotationRef.current = null
      } catch (error) {
        console.error("Annotation update failed:", error)
      }
    },
    [editingAnnotationId, updateAnnotation]
  )

  /**
   * アノテーション編集キャンセル
   */
  const cancelEditingAnnotation = useCallback(() => {
    console.log("Cancel annotation edit")
    setIsEditingAnnotation(false)
    setEditingAnnotationId(null)
    originalAnnotationRef.current = null
    selectAnnotation(null)
  }, [selectAnnotation])

  /**
   * マウスダウンイベント
   */
  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const relativeCoords = getRelativeCoordinates(event, canvas)

      // 選択モードでアノテーションヒット判定
      if (readOnly || currentTool === "select") {
        const hitAnnotation = annotations.find((annotation) => {
          return isPointInAnnotation(relativeCoords, annotation)
        })

        if (hitAnnotation) {
          // アノテーション編集開始
          setIsMouseDown(true)
          setStartPoint(relativeCoords)
          setCurrentPoint(relativeCoords)
          startEditingAnnotation(hitAnnotation)
        } else {
          // アノテーションが選択されていない場合は編集をキャンセル
          if (isEditingAnnotation) {
            cancelEditingAnnotation()
          }
          selectAnnotation(null)
        }
        return
      }

      // 新規描画開始
      setIsMouseDown(true)
      setStartPoint(relativeCoords)
      setCurrentPoint(relativeCoords)

      // questionScoreIdのバリデーション
      if (!questionScoreId) {
        console.error("questionScoreId is not set")
        return
      }

      console.log("Drawing start:", { questionScoreId, currentTool })

      // 描画開始
      const drawingData = {
        questionScoreId: questionScoreId,
        type: currentTool as DrawingType,
        x: relativeCoords.x,
        y: relativeCoords.y,
        color: drawingColor,
        strokeWidth,
        endX: relativeCoords.x,
        endY: relativeCoords.y,
        width: 0,
        height: 0,
        text: "",
        fontSize: 16,
        textBoxWidth: 0,
        textBoxHeight: 0,
        horizontalAlign: "left" as const,
        verticalAlign: "top" as const,
        displayX: relativeCoords.x,
        displayY: relativeCoords.y,
        lineStyle: "solid" as const,
      }

      startDrawing(drawingData)
    },
    [
      canvasRef,
      readOnly,
      currentTool,
      drawingColor,
      strokeWidth,
      startDrawing,
      annotations,
      selectAnnotation,
      questionScoreId,
      startEditingAnnotation,
      isEditingAnnotation,
      cancelEditingAnnotation,
    ]
  )

  /**
   * マウス移動イベント
   */
  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const relativeCoords = getRelativeCoordinates(event, canvas)

      // アノテーション編集中の場合
      if (
        isEditingAnnotation &&
        editingAnnotationId &&
        originalAnnotationRef.current
      ) {
        const deltaX = relativeCoords.x - startPoint!.x
        const deltaY = relativeCoords.y - startPoint!.y
        const originalAnnotation = originalAnnotationRef.current

        // 編集中のアノテーションの位置を更新
        const updatedData: DrawingUpdateData = {
          x: originalAnnotation.x + deltaX,
          y: originalAnnotation.y + deltaY,
        }

        // 線分の場合は終点も移動
        if (
          originalAnnotation.type === "line" &&
          originalAnnotation.endX !== undefined &&
          originalAnnotation.endY !== undefined
        ) {
          updatedData.endX = originalAnnotation.endX + deltaX
          updatedData.endY = originalAnnotation.endY + deltaY
        }

        // テキストの場合は表示位置も更新
        if (originalAnnotation.type === "text") {
          updatedData.displayX = originalAnnotation.displayX + deltaX
          updatedData.displayY = originalAnnotation.displayY + deltaY
        }

        // 矩形・楕円の場合は表示位置を更新
        if (
          originalAnnotation.type === "rectangle" ||
          originalAnnotation.type === "ellipse"
        ) {
          updatedData.displayX = originalAnnotation.displayX + deltaX
          updatedData.displayY = originalAnnotation.displayY + deltaY
        }

        // 他のアノテーションに影響しないよう、個別にローカル状態で更新
        setLocalAnnotations((prev) =>
          prev.map((ann) =>
            ann.id === editingAnnotationId ? { ...ann, ...updatedData } : ann
          )
        )
        redrawCanvas()
        return
      }

      // 新規描画中の場合
      if (!isMouseDown || !startPoint) return

      setCurrentPoint(relativeCoords)

      // 描画更新
      const width = Math.abs(relativeCoords.x - startPoint.x)
      const height = Math.abs(relativeCoords.y - startPoint.y)
      const displayX = Math.min(startPoint.x, relativeCoords.x)
      const displayY = Math.min(startPoint.y, relativeCoords.y)

      const updateData = {
        endX: relativeCoords.x,
        endY: relativeCoords.y,
        width,
        height,
        textBoxWidth: width,
        textBoxHeight: height,
        displayX,
        displayY,
      }

      updateDrawing(updateData)
      redrawCanvas()
    },
    [
      canvasRef,
      isMouseDown,
      startPoint,
      updateDrawing,
      redrawCanvas,
      isEditingAnnotation,
      editingAnnotationId,
      setLocalAnnotations,
    ]
  )

  /**
   * マウスアップイベント
   */
  const handleMouseUp = useCallback(
    async (event: React.MouseEvent) => {
      // アノテーション編集完了の場合
      if (
        isEditingAnnotation &&
        editingAnnotationId &&
        originalAnnotationRef.current
      ) {
        const canvas = canvasRef.current
        if (!canvas) return

        const relativeCoords = getRelativeCoordinates(event, canvas)
        const deltaX = relativeCoords.x - startPoint!.x
        const deltaY = relativeCoords.y - startPoint!.y
        const originalAnnotation = originalAnnotationRef.current

        // 最終的な位置データを計算
        const finalData: DrawingUpdateData = {
          x: originalAnnotation.x + deltaX,
          y: originalAnnotation.y + deltaY,
        }

        // 線分の場合は終点も移動
        if (
          originalAnnotation.type === "line" &&
          originalAnnotation.endX !== undefined &&
          originalAnnotation.endY !== undefined
        ) {
          finalData.endX = originalAnnotation.endX + deltaX
          finalData.endY = originalAnnotation.endY + deltaY
        }

        // テキストの場合は表示位置も更新
        if (originalAnnotation.type === "text") {
          finalData.displayX = originalAnnotation.displayX + deltaX
          finalData.displayY = originalAnnotation.displayY + deltaY
        }

        // 矩形・楕円の場合は表示位置を更新
        if (
          originalAnnotation.type === "rectangle" ||
          originalAnnotation.type === "ellipse"
        ) {
          finalData.displayX = originalAnnotation.displayX + deltaX
          finalData.displayY = originalAnnotation.displayY + deltaY
        }

        // データベースに保存
        await finishEditingAnnotation(finalData)
        setStartPoint(null)
        setCurrentPoint(null)
        return
      }

      // 新規描画完了の場合
      if (!isMouseDown || !startPoint || !currentPoint) return

      setIsMouseDown(false)

      // 最小サイズチェック
      const minSize = 0.01 // 1% of canvas
      const width = Math.abs(currentPoint.x - startPoint.x)
      const height = Math.abs(currentPoint.y - startPoint.y)

      if (currentTool !== "line" && (width < minSize || height < minSize)) {
        cancelDrawing()
        setStartPoint(null)
        setCurrentPoint(null)
        redrawCanvas()
        return
      }

      // テキストツールの場合はプロンプト表示
      if (currentTool === "text") {
        const text = prompt(
          "テキストを入力してください（LaTeX数式対応: $数式$）:"
        )
        if (!text) {
          cancelDrawing()
          setStartPoint(null)
          setCurrentPoint(null)
          redrawCanvas()
          return
        }

        // MathJaxサイズ測定
        try {
          const measuredSize = await measureTextSize(
            text,
            width * width,
            height * height
          )
          updateDrawing({
            text,
            textBoxWidth: measuredSize.width / width,
            textBoxHeight: measuredSize.height / height,
          })
        } catch (error) {
          console.warn("Text size measurement failed:", error)
          updateDrawing({ text })
        }
      }

      // 描画完了
      const annotation = await finishDrawing()
      if (annotation && onDrawingComplete) {
        onDrawingComplete(annotation)
      }

      setStartPoint(null)
      setCurrentPoint(null)
      redrawCanvas()
    },
    [
      canvasRef,
      isMouseDown,
      startPoint,
      currentPoint,
      currentTool,
      cancelDrawing,
      measureTextSize,
      updateDrawing,
      finishDrawing,
      onDrawingComplete,
      redrawCanvas,
      isEditingAnnotation,
      editingAnnotationId,
      finishEditingAnnotation,
    ]
  )

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    startPoint,
    currentPoint,
    isMouseDown,
  }
}
