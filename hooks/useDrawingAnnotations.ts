/**
 * @fileoverview 統合描画アノテーション管理フック（シンプル版）
 * @description 単一フックで全機能を提供し、無限ループを防止
 */

import type {
  DrawingAnnotation,
  DrawingCreateData,
  DrawingTool,
  DrawingType,
  DrawingUpdateData,
} from "@/types/drawingAnnotation.types"
import { useCallback, useEffect, useRef, useState } from "react"

// MathJax処理
import { measureMathJaxContentSize } from "@/app/textbox-on-canvas-v3/utils/mathJaxUtils"

interface DrawingState {
  currentTool: DrawingTool
  selectedAnnotationId: string | null
  drawingAnnotation: Partial<DrawingCreateData> | null
  isDrawing: boolean
  isProcessingMathJax: boolean
}

interface DrawingCallbacks {
  onCreateAnnotation?: (data: DrawingCreateData) => void
  onUpdateAnnotation?: (id: string, data: DrawingUpdateData) => void
  onDeleteAnnotation?: (id: string) => void
  onSelectAnnotation?: (annotation: DrawingAnnotation | null) => void
}

// QuestionScore自動作成用のコンテキスト情報
interface DrawingContext {
  currentStudentId?: string
  currentCropRegionId?: string
  currentUserId?: string
}

export interface UseDrawingAnnotationsReturn {
  // 状態
  annotations: DrawingAnnotation[]
  drawingState: DrawingState
  isLoading: boolean
  error: string | null

  // データ操作
  loadAnnotations: (
    questionScoreId: string,
    type?: DrawingType
  ) => Promise<void>
  updateAnnotation: (
    id: string,
    data: DrawingUpdateData
  ) => Promise<DrawingAnnotation | null>
  deleteAnnotation: (id: string) => Promise<boolean>

  // ツール操作
  setCurrentTool: (tool: DrawingTool) => void
  selectAnnotation: (annotationId: string | null) => void
  startDrawing: (annotation: Partial<DrawingCreateData>) => void
  updateDrawing: (annotation: Partial<DrawingCreateData>) => void
  finishDrawing: () => Promise<DrawingAnnotation | null>
  cancelDrawing: () => void

  // MathJax処理
  measureTextSize: (
    htmlContent: string,
    width?: number,
    height?: number
  ) => Promise<{ width: number; height: number }>
}

/**
 * 統合描画アノテーション管理フック（シンプル版）
 * 無限ループを防ぐため、questionScoreIdの自動読み込みは行わない
 */
export function useDrawingAnnotations(
  callbacks?: Partial<DrawingCallbacks>,
  context?: DrawingContext
): UseDrawingAnnotationsReturn {
  // 基本状態
  const [annotations, setAnnotations] = useState<DrawingAnnotation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 描画ツール状態
  const [drawingState, setDrawingState] = useState<DrawingState>({
    currentTool: "select",
    selectedAnnotationId: null,
    drawingAnnotation: null,
    isDrawing: false,
    isProcessingMathJax: false,
  })

  // コールバック参照
  const callbacksRef = useRef<Partial<DrawingCallbacks>>(callbacks || {})

  useEffect(() => {
    callbacksRef.current = callbacks || {}
  }, [callbacks])

  /**
   * アノテーション読み込み
   */
  const loadAnnotations = useCallback(
    async (questionScoreId: string, type?: DrawingType): Promise<void> => {
      setIsLoading(true)
      setError(null)

      try {
        console.log(`📖 手動アノテーション読み込み: ${questionScoreId}`, {
          type,
        })
        const result = await window.electronAPI.drawing.getByQuestionScore(
          questionScoreId,
          type
        )

        if (result.success && result.data) {
          console.log(`✅ アノテーション読み込み成功: ${result.data.length}件`)
          setAnnotations(result.data)
        } else {
          console.error("❌ アノテーション読み込みエラー:", result.error)
          setError(result.error || "アノテーション読み込みに失敗しました")
          setAnnotations([])
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "アノテーション読み込みに失敗しました"
        console.error("💥 アノテーション読み込み失敗:", err)
        setError(errorMessage)
        setAnnotations([])
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  /**
   * アノテーション作成
   */
  const createAnnotation = useCallback(
    async (data: DrawingCreateData): Promise<DrawingAnnotation | null> => {
      try {
        console.log("🎨 アノテーション作成:", data.type)

        // QuestionScore自動作成用の情報がない場合はcontextから補完
        const enrichedData: DrawingCreateData = {
          ...data,
          studentId: data.studentId || context?.currentStudentId,
          cropRegionId: data.cropRegionId || context?.currentCropRegionId,
          scoredByUserId: data.scoredByUserId || context?.currentUserId,
        }

        console.log("📝 補完されたデータ:", {
          studentId: enrichedData.studentId,
          cropRegionId: enrichedData.cropRegionId,
          scoredByUserId: enrichedData.scoredByUserId,
        })

        const result = await window.electronAPI.drawing.create(enrichedData)

        if (result.success && result.data) {
          setAnnotations((prev) => [...prev, result.data!])
          callbacksRef.current.onCreateAnnotation?.(data)
          return result.data
        } else {
          console.error("❌ アノテーション作成エラー:", result.error)
          setError(result.error || "アノテーション作成に失敗しました")
          return null
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "アノテーション作成に失敗しました"
        console.error("💥 アノテーション作成失敗:", err)
        setError(errorMessage)
        return null
      }
    },
    [
      context?.currentStudentId,
      context?.currentCropRegionId,
      context?.currentUserId,
    ]
  )

  /**
   * アノテーション更新
   */
  const updateAnnotation = useCallback(
    async (
      id: string,
      data: DrawingUpdateData
    ): Promise<DrawingAnnotation | null> => {
      try {
        console.log(`✏️ アノテーション更新: ${id}`)
        const result = await window.electronAPI.drawing.update(id, data)

        if (result.success && result.data) {
          setAnnotations((prev) =>
            prev.map((ann) => (ann.id === id ? result.data! : ann))
          )
          callbacksRef.current.onUpdateAnnotation?.(id, data)
          return result.data
        } else {
          console.error("❌ アノテーション更新エラー:", result.error)
          setError(result.error || "アノテーション更新に失敗しました")
          return null
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "アノテーション更新に失敗しました"
        console.error("💥 アノテーション更新失敗:", err)
        setError(errorMessage)
        return null
      }
    },
    []
  )

  /**
   * アノテーション削除
   */
  const deleteAnnotation = useCallback(async (id: string): Promise<boolean> => {
    try {
      console.log(`🗑️ アノテーション削除: ${id}`)
      const result = await window.electronAPI.drawing.delete(id)

      if (result.success) {
        setAnnotations((prev) => prev.filter((ann) => ann.id !== id))
        callbacksRef.current.onDeleteAnnotation?.(id)
        return true
      } else {
        console.error("❌ アノテーション削除エラー:", result.error)
        setError(result.error || "アノテーション削除に失敗しました")
        return false
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "アノテーション削除に失敗しました"
      console.error("💥 アノテーション削除失敗:", err)
      setError(errorMessage)
      return false
    }
  }, [])

  /**
   * ツール設定
   */
  const setCurrentTool = useCallback(
    (tool: DrawingTool): void => {
      console.log(`🔧 ツール変更: ${drawingState.currentTool} → ${tool}`)
      setDrawingState((prev) => ({
        ...prev,
        currentTool: tool,
        selectedAnnotationId:
          tool === "select" ? prev.selectedAnnotationId : null,
      }))
    },
    [drawingState.currentTool]
  )

  /**
   * アノテーション選択
   */
  const selectAnnotation = useCallback(
    (annotationId: string | null): void => {
      console.log(`👆 アノテーション選択: ${annotationId}`)
      setDrawingState((prev) => ({
        ...prev,
        selectedAnnotationId: annotationId,
        currentTool: annotationId ? "select" : prev.currentTool,
      }))

      const selectedAnnotation = annotationId
        ? annotations.find((ann) => ann.id === annotationId) || null
        : null

      callbacksRef.current.onSelectAnnotation?.(selectedAnnotation)
    },
    [annotations]
  )

  /**
   * 描画開始
   */
  const startDrawing = useCallback(
    (annotation: Partial<DrawingCreateData>): void => {
      console.log(`🎨 描画開始: ${annotation.type}`, annotation)
      setDrawingState((prev) => ({
        ...prev,
        drawingAnnotation: annotation,
        isDrawing: true,
        selectedAnnotationId: null,
      }))
    },
    []
  )

  /**
   * 描画更新
   */
  const updateDrawing = useCallback(
    (annotation: Partial<DrawingCreateData>): void => {
      setDrawingState((prev) => {
        if (!prev.isDrawing || !prev.drawingAnnotation) return prev

        return {
          ...prev,
          drawingAnnotation: {
            ...prev.drawingAnnotation,
            ...annotation,
          },
        }
      })
    },
    []
  )

  /**
   * 描画完了
   */
  const finishDrawing =
    useCallback(async (): Promise<DrawingAnnotation | null> => {
      if (
        !drawingState.isDrawing ||
        !drawingState.drawingAnnotation ||
        !drawingState.drawingAnnotation.questionScoreId
      ) {
        console.warn("⚠️ 描画完了: 描画中のアノテーションがありません")
        return null
      }

      const completeData: DrawingCreateData = {
        questionScoreId: drawingState.drawingAnnotation.questionScoreId,
        type: drawingState.drawingAnnotation.type as DrawingType,
        x: drawingState.drawingAnnotation.x || 0,
        y: drawingState.drawingAnnotation.y || 0,
        color: drawingState.drawingAnnotation.color || "#ef4444",
        strokeWidth: drawingState.drawingAnnotation.strokeWidth || 3,
        width: drawingState.drawingAnnotation.width || 0,
        height: drawingState.drawingAnnotation.height || 0,
        endX: drawingState.drawingAnnotation.endX || 0,
        endY: drawingState.drawingAnnotation.endY || 0,
        lineStyle: drawingState.drawingAnnotation.lineStyle || "solid",
        text: drawingState.drawingAnnotation.text || "",
        fontSize: drawingState.drawingAnnotation.fontSize || 16,
        textBoxWidth: drawingState.drawingAnnotation.textBoxWidth || 0,
        textBoxHeight: drawingState.drawingAnnotation.textBoxHeight || 0,
        horizontalAlign:
          drawingState.drawingAnnotation.horizontalAlign || "left",
        verticalAlign: drawingState.drawingAnnotation.verticalAlign || "top",
        displayX: drawingState.drawingAnnotation.displayX || 0,
        displayY: drawingState.drawingAnnotation.displayY || 0,
        createdByUserId: drawingState.drawingAnnotation.createdByUserId,
        // QuestionScore自動作成用の情報（contextから取得）
        studentId: context?.currentStudentId,
        cropRegionId: context?.currentCropRegionId,
        scoredByUserId: context?.currentUserId,
      }

      const result = await createAnnotation(completeData)

      setDrawingState((prev) => ({
        ...prev,
        drawingAnnotation: null,
        isDrawing: false,
      }))

      return result
    }, [
      drawingState.drawingAnnotation,
      drawingState.isDrawing,
      createAnnotation,
      context?.currentStudentId,
      context?.currentCropRegionId,
      context?.currentUserId,
    ])

  /**
   * 描画キャンセル
   */
  const cancelDrawing = useCallback((): void => {
    console.log("❌ 描画キャンセル")
    setDrawingState((prev) => ({
      ...prev,
      drawingAnnotation: null,
      isDrawing: false,
    }))
  }, [])

  /**
   * MathJaxサイズ測定
   */
  const measureTextSize = useCallback(
    async (
      htmlContent: string,
      width: number = 200,
      height: number = 50
    ): Promise<{ width: number; height: number }> => {
      try {
        console.log("📏 MathJaxサイズ測定開始:", { htmlContent, width, height })
        const size = await measureMathJaxContentSize(htmlContent, width, height)
        console.log("✅ MathJaxサイズ測定完了:", size)
        return size
      } catch (error) {
        console.error("💥 MathJaxサイズ測定失敗:", error)
        throw error
      }
    },
    []
  )

  return {
    // 状態
    annotations,
    drawingState,
    isLoading,
    error,

    // データ操作
    loadAnnotations,
    updateAnnotation,
    deleteAnnotation,

    // ツール操作
    setCurrentTool,
    selectAnnotation,
    startDrawing,
    updateDrawing,
    finishDrawing,
    cancelDrawing,

    // MathJax処理
    measureTextSize,
  }
}

// 必要な型を再エクスポート
export type { DrawingTool } from "@/types/drawingAnnotation.types"
