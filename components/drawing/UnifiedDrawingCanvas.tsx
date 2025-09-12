/**
 * @fileoverview 統合描画キャンバスコンポーネント
 * @description すべての描画ツールを統合したキャンバスコンポーネント（MathJax対応）
 */

"use client"

import {
  useDrawingAnnotations,
  type DrawingTool,
} from "@/hooks/useDrawingAnnotations"
import type {
  DrawingAnnotation,
  DrawingType,
} from "@/types/drawing-annotation.types"
import React, { useCallback, useEffect, useRef, useState } from "react"

// textbox-on-canvas-v3のユーティリティを統合
import { CANVAS_SETTINGS } from "@/app/textbox-on-canvas-v3/constants"

/**
 * コンポーネントのプロパティ
 */
export interface UnifiedDrawingCanvasProps {
  /** 背景画像のURL */
  backgroundImageUrl: string
  /** QuestionScoreのID */
  questionScoreId: string
  /** キャンバスの幅 */
  width: number
  /** キャンバスの高さ */
  height: number
  /** 現在選択中のツール */
  currentTool?: DrawingTool
  /** 読み取り専用モード */
  readOnly?: boolean
  /** 描画色 */
  drawingColor?: string
  /** 線の太さ */
  strokeWidth?: number
  /** クラス名 */
  className?: string
  /** 描画完了コールバック */
  onDrawingComplete?: (annotation: DrawingAnnotation) => void
  /** 選択変更コールバック */
  onSelectionChange?: (annotationId: string | null) => void
}

/**
 * マウス座標を相対座標に変換
 */
function getRelativeCoordinates(
  event: React.MouseEvent,
  canvas: HTMLCanvasElement,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  const x = (event.clientX - rect.left) / rect.width
  const y = (event.clientY - rect.top) / rect.height
  return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) }
}

/**
 * 相対座標を絶対座標に変換
 */
function getAbsoluteCoordinates(
  relativeX: number,
  relativeY: number,
  canvas: HTMLCanvasElement,
): { x: number; y: number } {
  return {
    x: relativeX * canvas.width,
    y: relativeY * canvas.height,
  }
}

/**
 * 統合描画キャンバスコンポーネント
 */
export const UnifiedDrawingCanvas: React.FC<UnifiedDrawingCanvasProps> = ({
  backgroundImageUrl,
  questionScoreId,
  width,
  height,
  currentTool = "select",
  readOnly = false,
  drawingColor = "#ef4444",
  strokeWidth = 3,
  className = "",
  onDrawingComplete,
  onSelectionChange,
}) => {
  // 参照
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const backgroundImageRef = useRef<HTMLImageElement | null>(null)

  // 状態管理
  const [isMouseDown, setIsMouseDown] = useState(false)
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(
    null,
  )
  const [currentPoint, setCurrentPoint] = useState<{
    x: number
    y: number
  } | null>(null)
  
  // 編集状態管理
  const [isEditingAnnotation, setIsEditingAnnotation] = useState(false)
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null)
  const [originalAnnotation, setOriginalAnnotation] = useState<DrawingAnnotation | null>(null)

  // 描画管理フック
  const {
    annotations,
    drawingState,
    loadAnnotations,
    setCurrentTool,
    selectAnnotation,
    startDrawing,
    updateDrawing,
    updateAnnotation,
    finishDrawing,
    cancelDrawing,
    deleteAnnotation,
    processMathJaxText,
    measureTextSize,
    clearAnnotations,
  } = useDrawingAnnotations()
  
  // ローカル状態でのアノテーション管理（編集中のリアルタイム更新用）
  const [localAnnotations, setLocalAnnotations] = useState<DrawingAnnotation[]>([])
  
  // annotations が変更されたときにローカル状態を同期
  useEffect(() => {
    setLocalAnnotations(annotations)
  }, [annotations])

  // ツール変更の同期
  useEffect(() => {
    setCurrentTool(currentTool)
  }, [currentTool, setCurrentTool])

  // questionScoreId変更時の手動読み込み
  useEffect(() => {
    if (questionScoreId) {
      console.log('🎨 UnifiedDrawingCanvas: questionScoreId変更で読み込み:', questionScoreId)
      loadAnnotations(questionScoreId)
    }
  }, [questionScoreId, loadAnnotations])

  /**
   * アノテーション編集開始
   */
  const startEditingAnnotation = useCallback((annotation: DrawingAnnotation) => {
    console.log('✏️ アノテーション編集開始:', annotation.id)
    setIsEditingAnnotation(true)
    setEditingAnnotationId(annotation.id)
    setOriginalAnnotation(annotation)
    selectAnnotation(annotation.id)
  }, [selectAnnotation])

  /**
   * アノテーション編集完了
   */
  const finishEditingAnnotation = useCallback(async (updatedData: Partial<DrawingAnnotation>) => {
    if (!editingAnnotationId || !originalAnnotation) return

    try {
      console.log('💾 アノテーション更新:', editingAnnotationId, updatedData)
      await updateAnnotation(editingAnnotationId, updatedData)
      
      // 編集状態リセット
      setIsEditingAnnotation(false)
      setEditingAnnotationId(null)
      setOriginalAnnotation(null)
    } catch (error) {
      console.error('❌ アノテーション更新失敗:', error)
    }
  }, [editingAnnotationId, originalAnnotation, updateAnnotation])

  /**
   * アノテーション編集キャンセル
   */
  const cancelEditingAnnotation = useCallback(() => {
    console.log('❌ アノテーション編集キャンセル')
    setIsEditingAnnotation(false)
    setEditingAnnotationId(null)
    setOriginalAnnotation(null)
    selectAnnotation(null)
  }, [selectAnnotation])
  /**
   * 波線描画
   */
  const drawWaveLine = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      startX: number,
      startY: number,
      endX: number,
      endY: number,
    ) => {
      const dx = endX - startX
      const dy = endY - startY
      const distance = Math.sqrt(dx * dx + dy * dy)
      const waveLength = 20
      const amplitude = 10

      for (let i = 0; i <= distance; i += 2) {
        const progress = i / distance
        const x = startX + dx * progress
        const y =
          startY +
          dy * progress +
          Math.sin((i / waveLength) * Math.PI * 2) * amplitude

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }
    },
    [],
  )

  /**
   * ジグザグ線描画
   */
  const drawZigzagLine = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      startX: number,
      startY: number,
      endX: number,
      endY: number,
    ) => {
      const segments = 10
      const amplitude = 15

      for (let i = 0; i <= segments; i++) {
        const progress = i / segments
        const x = startX + (endX - startX) * progress
        const baseY = startY + (endY - startY) * progress
        const y = baseY + (i % 2 === 0 ? amplitude : -amplitude)

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }
    },
    [],
  )

  /**
   * 矢印の頭部分描画
   */
  const drawArrowHead = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      fromX: number,
      fromY: number,
      toX: number,
      toY: number,
    ) => {
      const angle = Math.atan2(toY - fromY, toX - fromX)
      const arrowLength = 15
      const arrowAngle = Math.PI / 6

      ctx.beginPath()
      ctx.moveTo(toX, toY)
      ctx.lineTo(
        toX - arrowLength * Math.cos(angle - arrowAngle),
        toY - arrowLength * Math.sin(angle - arrowAngle),
      )
      ctx.moveTo(toX, toY)
      ctx.lineTo(
        toX - arrowLength * Math.cos(angle + arrowAngle),
        toY - arrowLength * Math.sin(angle + arrowAngle),
      )
      ctx.stroke()
    },
    [],
  )

  /**
   * アノテーション描画
   */
  const drawAnnotation = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      annotation: DrawingAnnotation,
      canvas: HTMLCanvasElement,
    ) => {
      const absStart = getAbsoluteCoordinates(
        annotation.x,
        annotation.y,
        canvas,
      )

      ctx.strokeStyle = annotation.color
      ctx.lineWidth = annotation.strokeWidth
      ctx.fillStyle = annotation.color

      // 選択状態の表示
      const isSelected = drawingState.selectedAnnotationId === annotation.id
      if (isSelected) {
        ctx.strokeStyle = CANVAS_SETTINGS.SELECTED_BORDER_COLOR
        ctx.lineWidth = annotation.strokeWidth + 2
      }

      switch (annotation.type as DrawingType) {
        case "line": {
          const absEnd = getAbsoluteCoordinates(
            annotation.endX,
            annotation.endY,
            canvas,
          )

          ctx.beginPath()
          ctx.moveTo(absStart.x, absStart.y)

          // 線のスタイルに応じた描画
          switch (annotation.lineStyle) {
            case "wave":
              drawWaveLine(ctx, absStart.x, absStart.y, absEnd.x, absEnd.y)
              break
            case "zigzag":
              drawZigzagLine(ctx, absStart.x, absStart.y, absEnd.x, absEnd.y)
              break
            case "double":
              ctx.lineTo(absEnd.x, absEnd.y)
              ctx.stroke()
              ctx.beginPath()
              const offset = annotation.strokeWidth + 2
              ctx.moveTo(absStart.x, absStart.y + offset)
              ctx.lineTo(absEnd.x, absEnd.y + offset)
              break
            case "arrow":
              ctx.lineTo(absEnd.x, absEnd.y)
              ctx.stroke()
              drawArrowHead(ctx, absStart.x, absStart.y, absEnd.x, absEnd.y)
              break
            case "both_arrow":
              ctx.lineTo(absEnd.x, absEnd.y)
              ctx.stroke()
              drawArrowHead(ctx, absStart.x, absStart.y, absEnd.x, absEnd.y)
              drawArrowHead(ctx, absEnd.x, absEnd.y, absStart.x, absStart.y)
              break
            default:
              ctx.lineTo(absEnd.x, absEnd.y)
          }
          ctx.stroke()
          break
        }

        case "rectangle": {
          const absWidth = annotation.width * canvas.width
          const absHeight = annotation.height * canvas.height

          ctx.beginPath()
          ctx.rect(absStart.x, absStart.y, absWidth, absHeight)
          ctx.stroke()

          if (isSelected) {
            ctx.fillStyle = CANVAS_SETTINGS.SELECTED_BACKGROUND_COLOR
            ctx.fill()
          }
          break
        }

        case "ellipse": {
          const absWidth = annotation.width * canvas.width
          const absHeight = annotation.height * canvas.height
          const centerX = absStart.x + absWidth / 2
          const centerY = absStart.y + absHeight / 2

          ctx.beginPath()
          ctx.ellipse(
            centerX,
            centerY,
            absWidth / 2,
            absHeight / 2,
            0,
            0,
            2 * Math.PI,
          )
          ctx.stroke()

          if (isSelected) {
            ctx.fillStyle = CANVAS_SETTINGS.SELECTED_BACKGROUND_COLOR
            ctx.fill()
          }
          break
        }

        case "text": {
          // テキストボックスの境界線描画
          if (annotation.textBoxWidth > 0 && annotation.textBoxHeight > 0) {
            const absWidth = annotation.textBoxWidth * canvas.width
            const absHeight = annotation.textBoxHeight * canvas.height

            ctx.strokeStyle = isSelected
              ? CANVAS_SETTINGS.SELECTED_BORDER_COLOR
              : CANVAS_SETTINGS.UNSELECTED_BORDER_COLOR
            ctx.lineWidth = 1
            ctx.setLineDash([5, 5])
            ctx.strokeRect(absStart.x, absStart.y, absWidth, absHeight)
            ctx.setLineDash([])
          }

          // テキスト描画（MathJax処理済みの場合はSVGとして描画）
          if (annotation.text) {
            ctx.fillStyle = annotation.color
            ctx.font = `${annotation.fontSize}px Arial`
            ctx.fillText(
              annotation.text,
              absStart.x,
              absStart.y + annotation.fontSize,
            )
          }
          break
        }
      }
    },
    [
      drawArrowHead,
      drawWaveLine,
      drawZigzagLine,
      drawingState.selectedAnnotationId,
    ],
  )

  /**
   * 一時的なアノテーション描画（描画中）
   */
  const drawTemporaryAnnotation = useCallback(
    (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
      if (!startPoint || !currentPoint || !drawingState.drawingAnnotation)
        return

      const absStart = getAbsoluteCoordinates(
        startPoint.x,
        startPoint.y,
        canvas,
      )
      const absCurrent = getAbsoluteCoordinates(
        currentPoint.x,
        currentPoint.y,
        canvas,
      )

      ctx.strokeStyle = CANVAS_SETTINGS.CREATING_BORDER_COLOR
      ctx.lineWidth = strokeWidth
      ctx.setLineDash([5, 5])

      const width = Math.abs(absCurrent.x - absStart.x)
      const height = Math.abs(absCurrent.y - absStart.y)

      switch (currentTool) {
        case "line":
          ctx.beginPath()
          ctx.moveTo(absStart.x, absStart.y)
          ctx.lineTo(absCurrent.x, absCurrent.y)
          ctx.stroke()
          break

        case "rectangle":
          ctx.strokeRect(
            Math.min(absStart.x, absCurrent.x),
            Math.min(absStart.y, absCurrent.y),
            width,
            height,
          )
          break

        case "ellipse":
          const centerX = (absStart.x + absCurrent.x) / 2
          const centerY = (absStart.y + absCurrent.y) / 2
          ctx.beginPath()
          ctx.ellipse(
            centerX,
            centerY,
            width / 2,
            height / 2,
            0,
            0,
            2 * Math.PI,
          )
          ctx.stroke()
          break

        case "text":
          ctx.strokeRect(
            Math.min(absStart.x, absCurrent.x),
            Math.min(absStart.y, absCurrent.y),
            width,
            height,
          )
          break
      }

      ctx.setLineDash([])
    },
    [
      startPoint,
      currentPoint,
      drawingState.drawingAnnotation,
      currentTool,
      strokeWidth,
    ],
  )

  /**
   * ポイントがアノテーション内にあるかチェック
   */
  const isPointInAnnotation = useCallback(
    (
      point: { x: number; y: number },
      annotation: DrawingAnnotation,
    ): boolean => {
      switch (annotation.type as DrawingType) {
        case "rectangle":
        case "text":
          return (
            point.x >= annotation.displayX &&
            point.x <= annotation.displayX + annotation.width &&
            point.y >= annotation.displayY &&
            point.y <= annotation.displayY + annotation.height
          )

        case "ellipse": {
          const centerX = annotation.displayX + annotation.width / 2
          const centerY = annotation.displayY + annotation.height / 2
          const radiusX = annotation.width / 2
          const radiusY = annotation.height / 2

          const dx = (point.x - centerX) / radiusX
          const dy = (point.y - centerY) / radiusY
          return dx * dx + dy * dy <= 1
        }

        case "line": {
          // 線分との距離計算（簡略化）
          const threshold = 0.02 // 2% tolerance
          const dx = annotation.endX - annotation.x
          const dy = annotation.endY - annotation.y
          const length = Math.sqrt(dx * dx + dy * dy)

          if (length === 0) return false

          const t = Math.max(
            0,
            Math.min(
              1,
              ((point.x - annotation.x) * dx + (point.y - annotation.y) * dy) /
                (length * length),
            ),
          )

          const projectionX = annotation.x + t * dx
          const projectionY = annotation.y + t * dy
          const distance = Math.sqrt(
            (point.x - projectionX) ** 2 + (point.y - projectionY) ** 2,
          )

          return distance < threshold
        }

        default:
          return false
      }
    },
    [],
  )

  /**
   * キャンバス再描画
   */
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // キャンバスクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 背景画像描画
    if (backgroundImageRef.current) {
      ctx.drawImage(
        backgroundImageRef.current,
        0,
        0,
        canvas.width,
        canvas.height,
      )
    }

    // 描画アノテーション描画（ローカル状態を使用）
    localAnnotations.forEach((annotation) => {
      const absStart = getAbsoluteCoordinates(
        annotation.x,
        annotation.y,
        canvas,
      )

      ctx.strokeStyle = annotation.color
      ctx.lineWidth = annotation.strokeWidth
      ctx.fillStyle = annotation.color

      // 選択状態の表示
      const isSelected = drawingState.selectedAnnotationId === annotation.id
      if (isSelected) {
        ctx.strokeStyle = CANVAS_SETTINGS.SELECTED_BORDER_COLOR
        ctx.lineWidth = annotation.strokeWidth + 2
      }

      // アノテーション種類別の描画（MathJax処理なし）
      switch (annotation.type as DrawingType) {
        case "line": {
          const absEnd = getAbsoluteCoordinates(
            annotation.endX,
            annotation.endY,
            canvas,
          )

          ctx.beginPath()
          ctx.moveTo(absStart.x, absStart.y)

          // 線のスタイルに応じた描画
          switch (annotation.lineStyle) {
            case "wave":
              drawWaveLine(ctx, absStart.x, absStart.y, absEnd.x, absEnd.y)
              break
            case "zigzag":
              drawZigzagLine(ctx, absStart.x, absStart.y, absEnd.x, absEnd.y)
              break
            case "double":
              ctx.lineTo(absEnd.x, absEnd.y)
              ctx.stroke()
              ctx.beginPath()
              const offset = annotation.strokeWidth + 2
              ctx.moveTo(absStart.x, absStart.y + offset)
              ctx.lineTo(absEnd.x, absEnd.y + offset)
              break
            case "arrow":
              ctx.lineTo(absEnd.x, absEnd.y)
              ctx.stroke()
              drawArrowHead(ctx, absStart.x, absStart.y, absEnd.x, absEnd.y)
              break
            case "both_arrow":
              ctx.lineTo(absEnd.x, absEnd.y)
              ctx.stroke()
              drawArrowHead(ctx, absStart.x, absStart.y, absEnd.x, absEnd.y)
              drawArrowHead(ctx, absEnd.x, absEnd.y, absStart.x, absStart.y)
              break
            default:
              ctx.lineTo(absEnd.x, absEnd.y)
          }
          ctx.stroke()
          break
        }

        case "rectangle": {
          const absWidth = annotation.width * canvas.width
          const absHeight = annotation.height * canvas.height

          ctx.beginPath()
          ctx.rect(absStart.x, absStart.y, absWidth, absHeight)
          ctx.stroke()

          if (isSelected) {
            ctx.fillStyle = CANVAS_SETTINGS.SELECTED_BACKGROUND_COLOR
            ctx.fill()
          }
          break
        }

        case "ellipse": {
          const absWidth = annotation.width * canvas.width
          const absHeight = annotation.height * canvas.height
          const centerX = absStart.x + absWidth / 2
          const centerY = absStart.y + absHeight / 2

          ctx.beginPath()
          ctx.ellipse(
            centerX,
            centerY,
            absWidth / 2,
            absHeight / 2,
            0,
            0,
            2 * Math.PI,
          )
          ctx.stroke()

          if (isSelected) {
            ctx.fillStyle = CANVAS_SETTINGS.SELECTED_BACKGROUND_COLOR
            ctx.fill()
          }
          break
        }

        case "text": {
          // テキストボックスの境界線描画
          if (annotation.textBoxWidth > 0 && annotation.textBoxHeight > 0) {
            const absWidth = annotation.textBoxWidth * canvas.width
            const absHeight = annotation.textBoxHeight * canvas.height

            ctx.strokeStyle = isSelected
              ? CANVAS_SETTINGS.SELECTED_BORDER_COLOR
              : CANVAS_SETTINGS.UNSELECTED_BORDER_COLOR
            ctx.lineWidth = 1
            ctx.setLineDash([5, 5])
            ctx.strokeRect(absStart.x, absStart.y, absWidth, absHeight)
            ctx.setLineDash([])
          }

          // テキスト描画（シンプルなテキストレンダリング、MathJax処理なし）
          if (annotation.text) {
            ctx.fillStyle = annotation.color
            ctx.font = `${annotation.fontSize}px Arial`
            ctx.fillText(
              annotation.text,
              absStart.x,
              absStart.y + annotation.fontSize,
            )
          }
          break
        }
      }
    })

    // 現在描画中のアノテーション描画
    if (
      drawingState.isDrawing &&
      drawingState.drawingAnnotation &&
      startPoint &&
      currentPoint
    ) {
      const absStart = getAbsoluteCoordinates(
        startPoint.x,
        startPoint.y,
        canvas,
      )
      const absCurrent = getAbsoluteCoordinates(
        currentPoint.x,
        currentPoint.y,
        canvas,
      )

      ctx.strokeStyle = CANVAS_SETTINGS.CREATING_BORDER_COLOR
      ctx.lineWidth = strokeWidth
      ctx.setLineDash([5, 5])

      const width = Math.abs(absCurrent.x - absStart.x)
      const height = Math.abs(absCurrent.y - absStart.y)

      switch (currentTool) {
        case "line":
          ctx.beginPath()
          ctx.moveTo(absStart.x, absStart.y)
          ctx.lineTo(absCurrent.x, absCurrent.y)
          ctx.stroke()
          break

        case "rectangle":
          ctx.strokeRect(
            Math.min(absStart.x, absCurrent.x),
            Math.min(absStart.y, absCurrent.y),
            width,
            height,
          )
          break

        case "ellipse":
          const centerX = (absStart.x + absCurrent.x) / 2
          const centerY = (absStart.y + absCurrent.y) / 2
          ctx.beginPath()
          ctx.ellipse(
            centerX,
            centerY,
            width / 2,
            height / 2,
            0,
            0,
            2 * Math.PI,
          )
          ctx.stroke()
          break

        case "text":
          ctx.strokeRect(
            Math.min(absStart.x, absCurrent.x),
            Math.min(absStart.y, absCurrent.y),
            width,
            height,
          )
          break
      }

      ctx.setLineDash([])
    }
  }, [
    localAnnotations,
    drawingState.isDrawing,
    drawingState.drawingAnnotation,
    drawingState.selectedAnnotationId,
    startPoint,
    currentPoint,
    currentTool,
    strokeWidth,
    drawArrowHead,
    drawWaveLine, 
    drawZigzagLine,
  ])

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
        const hitAnnotation = localAnnotations.find((annotation) => {
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
        console.error('❌ questionScoreId が設定されていません')
        return
      }

      console.log('🎨 描画開始:', { questionScoreId, currentTool })

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
      readOnly,
      currentTool,
      drawingColor,
      strokeWidth,
      startDrawing,
      localAnnotations,
      selectAnnotation,
      isPointInAnnotation,
      questionScoreId,
      startEditingAnnotation,
      isEditingAnnotation,
      cancelEditingAnnotation,
    ],
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
      if (isEditingAnnotation && editingAnnotationId && originalAnnotation) {
        const deltaX = relativeCoords.x - startPoint!.x
        const deltaY = relativeCoords.y - startPoint!.y

        // 編集中のアノテーションの位置を更新
        const updatedData: Partial<DrawingAnnotation> = {
          x: originalAnnotation.x + deltaX,
          y: originalAnnotation.y + deltaY,
        }

        // 線分の場合は終点も移動
        if (originalAnnotation.type === 'line' && originalAnnotation.endX !== undefined && originalAnnotation.endY !== undefined) {
          updatedData.endX = originalAnnotation.endX + deltaX
          updatedData.endY = originalAnnotation.endY + deltaY
        }

        // テキストの場合は表示位置も更新
        if (originalAnnotation.type === 'text') {
          updatedData.displayX = originalAnnotation.displayX + deltaX
          updatedData.displayY = originalAnnotation.displayY + deltaY
        }

        // 矩形・楕円の場合は表示位置を更新
        if (originalAnnotation.type === 'rectangle' || originalAnnotation.type === 'ellipse') {
          updatedData.displayX = originalAnnotation.displayX + deltaX
          updatedData.displayY = originalAnnotation.displayY + deltaY
        }

        // 他のアノテーションに影響しないよう、個別にローカル状態で更新
        setLocalAnnotations(prev => prev.map(ann => 
          ann.id === editingAnnotationId ? { ...ann, ...updatedData } : ann
        ))
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
      isMouseDown, 
      startPoint, 
      updateDrawing, 
      redrawCanvas, 
      isEditingAnnotation, 
      editingAnnotationId, 
      originalAnnotation,
      setLocalAnnotations
    ],
  )

  /**
   * マウスアップイベント
   */
  const handleMouseUp = useCallback(
    async (event: React.MouseEvent) => {
      // アノテーション編集完了の場合
      if (isEditingAnnotation && editingAnnotationId && originalAnnotation) {
        const canvas = canvasRef.current
        if (!canvas) return

        const relativeCoords = getRelativeCoordinates(event, canvas)
        const deltaX = relativeCoords.x - startPoint!.x
        const deltaY = relativeCoords.y - startPoint!.y

        // 最終的な位置データを計算
        const finalData: Partial<DrawingAnnotation> = {
          x: originalAnnotation.x + deltaX,
          y: originalAnnotation.y + deltaY,
        }

        // 線分の場合は終点も移動
        if (originalAnnotation.type === 'line' && originalAnnotation.endX !== undefined && originalAnnotation.endY !== undefined) {
          finalData.endX = originalAnnotation.endX + deltaX
          finalData.endY = originalAnnotation.endY + deltaY
        }

        // テキストの場合は表示位置も更新
        if (originalAnnotation.type === 'text') {
          finalData.displayX = originalAnnotation.displayX + deltaX
          finalData.displayY = originalAnnotation.displayY + deltaY
        }

        // 矩形・楕円の場合は表示位置を更新
        if (originalAnnotation.type === 'rectangle' || originalAnnotation.type === 'ellipse') {
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
          "テキストを入力してください（LaTeX数式対応: $数式$）:",
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
            height * height,
          )
          updateDrawing({
            text,
            textBoxWidth: measuredSize.width / width,
            textBoxHeight: measuredSize.height / height,
          })
        } catch (error) {
          console.warn("テキストサイズ測定失敗:", error)
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
      originalAnnotation,
      finishEditingAnnotation,
    ],
  )

  // キーボードイベント（削除）
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Delete" && drawingState.selectedAnnotationId) {
        deleteAnnotation(drawingState.selectedAnnotationId)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [drawingState.selectedAnnotationId, deleteAnnotation])

  /**
   * 背景画像読み込み
   */
  useEffect(() => {
    if (!backgroundImageUrl) return

    const img = new Image()
    img.onload = () => {
      backgroundImageRef.current = img
      redrawCanvas()
    }
    img.src = backgroundImageUrl
  }, [backgroundImageUrl, redrawCanvas])

  // キャンバス再描画トリガー
  useEffect(() => {
    redrawCanvas()
  }, [redrawCanvas])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`cursor-${currentTool === "select" ? "pointer" : "crosshair"} ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        border: "1px solid #ccc",
        maxWidth: "100%",
        maxHeight: "100%",
      }}
    />
  )
}

export default UnifiedDrawingCanvas
