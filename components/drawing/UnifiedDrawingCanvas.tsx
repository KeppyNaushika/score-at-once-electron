/**
 * @fileoverview 統合描画キャンバスコンポーネント
 * @description すべての描画ツールを統合したキャンバスコンポーネント（MathJax対応）
 */

"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"

import {
  type DrawingTool,
  useDrawingAnnotations,
} from "@/hooks/useDrawingAnnotations"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

import { useCanvasMouseEvents } from "./hooks/useCanvasMouseEvents"
import { redrawCanvas } from "./utils/canvasRenderer"

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
}) => {
  // 参照
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const backgroundImageRef = useRef<HTMLImageElement | null>(null)

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
    measureTextSize,
  } = useDrawingAnnotations()

  // ローカル状態でのアノテーション管理（編集中のリアルタイム更新用）
  const [localAnnotations, setLocalAnnotations] = useState<DrawingAnnotation[]>(
    []
  )

  // マウスイベントの状態をrefで管理（循環参照を避けるため）
  const mouseStateRef = useRef<{
    startPoint: { x: number; y: number } | null
    currentPoint: { x: number; y: number } | null
  }>({ startPoint: null, currentPoint: null })

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
      console.log(
        "UnifiedDrawingCanvas: questionScoreId changed, loading:",
        questionScoreId
      )
      loadAnnotations(questionScoreId)
    }
  }, [questionScoreId, loadAnnotations])

  /**
   * キャンバス再描画（refを使用して循環参照を回避）
   */
  const handleRedrawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    redrawCanvas({
      canvas,
      backgroundImage: backgroundImageRef.current,
      annotations: localAnnotations,
      selectedAnnotationId: drawingState.selectedAnnotationId,
      isDrawing: drawingState.isDrawing,
      drawingAnnotation: drawingState.drawingAnnotation,
      startPoint: mouseStateRef.current.startPoint,
      currentPoint: mouseStateRef.current.currentPoint,
      currentTool,
      strokeWidth,
    })
  }, [
    localAnnotations,
    drawingState.isDrawing,
    drawingState.drawingAnnotation,
    drawingState.selectedAnnotationId,
    currentTool,
    strokeWidth,
  ])

  // マウスイベントフック
  const mouseEvents = useCanvasMouseEvents({
    canvasRef,
    readOnly,
    currentTool,
    drawingColor,
    strokeWidth,
    questionScoreId,
    annotations: localAnnotations,
    startDrawing,
    updateDrawing,
    finishDrawing,
    cancelDrawing,
    selectAnnotation,
    updateAnnotation,
    measureTextSize,
    onDrawingComplete,
    setLocalAnnotations,
    redrawCanvas: handleRedrawCanvas,
  })

  // マウスイベントの状態をrefに同期
  useEffect(() => {
    mouseStateRef.current = {
      startPoint: mouseEvents.startPoint,
      currentPoint: mouseEvents.currentPoint,
    }
    handleRedrawCanvas()
  }, [mouseEvents.startPoint, mouseEvents.currentPoint, handleRedrawCanvas])

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
      handleRedrawCanvas()
    }
    img.src = backgroundImageUrl
  }, [backgroundImageUrl, handleRedrawCanvas])

  // キャンバス再描画トリガー
  useEffect(() => {
    handleRedrawCanvas()
  }, [handleRedrawCanvas])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`cursor-${currentTool === "select" ? "pointer" : "crosshair"} ${className}`}
      onMouseDown={mouseEvents.handleMouseDown}
      onMouseMove={mouseEvents.handleMouseMove}
      onMouseUp={mouseEvents.handleMouseUp}
      style={{
        border: "1px solid #ccc",
        maxWidth: "100%",
        maxHeight: "100%",
      }}
    />
  )
}

export default UnifiedDrawingCanvas
