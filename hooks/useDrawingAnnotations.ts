/**
 * @fileoverview 統合描画アノテーション管理フック
 * @description すべての描画ツール（テキスト・直線・長方形・楕円）の統合管理とMathJax処理
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import type {
  DrawingAnnotation,
  DrawingCreateData,
  DrawingUpdateData,
  DrawingType,
  DrawingAnnotationStats
} from '@/types/drawing-annotation.types'

// textbox-on-canvas-v3のMathJax処理を統合
import { createMathJaxSVG, measureMathJaxContentSize } from '@/app/textbox-on-canvas-v3/utils/mathJaxUtils'

/**
 * 描画ツールの種類
 */
export type DrawingTool = 'select' | 'text' | 'line' | 'rectangle' | 'ellipse'

/**
 * 描画状態
 */
export interface DrawingState {
  /** 現在選択中のツール */
  currentTool: DrawingTool
  /** 選択中の描画アノテーションID */
  selectedAnnotationId: string | null
  /** 描画中のアノテーション（作成中） */
  drawingAnnotation: Partial<DrawingCreateData> | null
  /** 描画中かどうか */
  isDrawing: boolean
  /** MathJax処理中かどうか */
  isProcessingMathJax: boolean
}

/**
 * 描画操作のコールバック
 */
export interface DrawingCallbacks {
  /** アノテーション作成 */
  onCreateAnnotation: (data: DrawingCreateData) => Promise<DrawingAnnotation | null>
  /** アノテーション更新 */
  onUpdateAnnotation: (id: string, data: DrawingUpdateData) => Promise<DrawingAnnotation | null>
  /** アノテーション削除 */
  onDeleteAnnotation: (id: string) => Promise<boolean>
  /** 選択状態変更 */
  onSelectionChange: (annotationId: string | null) => void
  /** MathJax処理完了 */
  onMathJaxProcessed: (annotation: DrawingAnnotation, svgElement: SVGSVGElement) => void
}

/**
 * フックの戻り値型
 */
export interface UseDrawingAnnotationsReturn {
  // 状態
  annotations: DrawingAnnotation[]
  drawingState: DrawingState
  stats: DrawingAnnotationStats | null
  
  // アクション
  loadAnnotations: (questionScoreId: string, type?: DrawingType) => Promise<void>
  createAnnotation: (data: DrawingCreateData) => Promise<DrawingAnnotation | null>
  updateAnnotation: (id: string, data: DrawingUpdateData) => Promise<DrawingAnnotation | null>
  deleteAnnotation: (id: string) => Promise<boolean>
  deleteByType: (questionScoreId: string, type?: DrawingType) => Promise<boolean>
  
  // バッチ操作
  batchCreate: (annotations: DrawingCreateData[]) => Promise<DrawingAnnotation[]>
  batchUpdate: (updates: Array<{ id: string; data: DrawingUpdateData }>) => Promise<DrawingAnnotation[]>
  
  // ツール操作
  setCurrentTool: (tool: DrawingTool) => void
  selectAnnotation: (annotationId: string | null) => void
  startDrawing: (annotation: Partial<DrawingCreateData>) => void
  updateDrawing: (annotation: Partial<DrawingCreateData>) => void
  finishDrawing: () => Promise<DrawingAnnotation | null>
  cancelDrawing: () => void
  
  // MathJax処理
  processMathJaxText: (htmlContent: string, width?: number, height?: number) => Promise<SVGSVGElement>
  measureTextSize: (htmlContent: string, width?: number, height?: number) => Promise<{ width: number; height: number }>
  
  // ユーティリティ
  getStats: (questionScoreId: string) => Promise<void>
  clearAnnotations: () => void
}

/**
 * 統合描画アノテーション管理フック
 */
export function useDrawingAnnotations(
  questionScoreId?: string,
  callbacks?: Partial<DrawingCallbacks>
): UseDrawingAnnotationsReturn {
  // 状態管理
  const [annotations, setAnnotations] = useState<DrawingAnnotation[]>([])
  const [stats, setStats] = useState<DrawingAnnotationStats | null>(null)
  const [drawingState, setDrawingState] = useState<DrawingState>({
    currentTool: 'select',
    selectedAnnotationId: null,
    drawingAnnotation: null,
    isDrawing: false,
    isProcessingMathJax: false
  })

  // 参照
  const callbacksRef = useRef<Partial<DrawingCallbacks>>(callbacks || {})
  
  // コールバック更新
  useEffect(() => {
    callbacksRef.current = callbacks || {}
  }, [callbacks])

  /**
   * アノテーション読み込み
   */
  const loadAnnotations = useCallback(async (
    targetQuestionScoreId: string,
    type?: DrawingType
  ): Promise<void> => {
    try {
      const result = await window.electronAPI.drawing.getByQuestionScore(targetQuestionScoreId, type)
      if (result.success && result.data) {
        setAnnotations(result.data)
      } else {
        console.error('アノテーション読み込みエラー:', result.error)
      }
    } catch (error) {
      console.error('アノテーション読み込み失敗:', error)
    }
  }, [])

  /**
   * アノテーション作成
   */
  const createAnnotation = useCallback(async (
    data: DrawingCreateData
  ): Promise<DrawingAnnotation | null> => {
    try {
      const result = await window.electronAPI.drawing.create(data)
      if (result.success && result.data) {
        setAnnotations(prev => [...prev, result.data!])
        callbacksRef.current.onCreateAnnotation?.(data)
        return result.data
      } else {
        console.error('アノテーション作成エラー:', result.error)
        return null
      }
    } catch (error) {
      console.error('アノテーション作成失敗:', error)
      return null
    }
  }, [])

  /**
   * アノテーション更新
   */
  const updateAnnotation = useCallback(async (
    id: string,
    data: DrawingUpdateData
  ): Promise<DrawingAnnotation | null> => {
    try {
      const result = await window.electronAPI.drawing.update(id, data)
      if (result.success && result.data) {
        setAnnotations(prev => prev.map(annotation => 
          annotation.id === id ? result.data! : annotation
        ))
        callbacksRef.current.onUpdateAnnotation?.(id, data)
        return result.data
      } else {
        console.error('アノテーション更新エラー:', result.error)
        return null
      }
    } catch (error) {
      console.error('アノテーション更新失敗:', error)
      return null
    }
  }, [])

  /**
   * アノテーション削除
   */
  const deleteAnnotation = useCallback(async (id: string): Promise<boolean> => {
    try {
      const result = await window.electronAPI.drawing.delete(id)
      if (result.success) {
        setAnnotations(prev => prev.filter(annotation => annotation.id !== id))
        if (drawingState.selectedAnnotationId === id) {
          setDrawingState(prev => ({ ...prev, selectedAnnotationId: null }))
        }
        callbacksRef.current.onDeleteAnnotation?.(id)
        return true
      } else {
        console.error('アノテーション削除エラー:', result.error)
        return false
      }
    } catch (error) {
      console.error('アノテーション削除失敗:', error)
      return false
    }
  }, [drawingState.selectedAnnotationId])

  /**
   * タイプ別アノテーション削除
   */
  const deleteByType = useCallback(async (
    targetQuestionScoreId: string,
    type?: DrawingType
  ): Promise<boolean> => {
    try {
      const result = await window.electronAPI.drawing.deleteByQuestionScore(targetQuestionScoreId, type)
      if (result.success) {
        // ローカル状態からも削除
        if (type) {
          setAnnotations(prev => prev.filter(annotation => 
            !(annotation.questionScoreId === targetQuestionScoreId && annotation.type === type)
          ))
        } else {
          setAnnotations(prev => prev.filter(annotation => 
            annotation.questionScoreId !== targetQuestionScoreId
          ))
        }
        return true
      } else {
        console.error('タイプ別削除エラー:', result.error)
        return false
      }
    } catch (error) {
      console.error('タイプ別削除失敗:', error)
      return false
    }
  }, [])

  /**
   * バッチ作成
   */
  const batchCreate = useCallback(async (
    annotationsData: DrawingCreateData[]
  ): Promise<DrawingAnnotation[]> => {
    try {
      const result = await window.electronAPI.drawing.batchCreate(annotationsData)
      if (result.success && result.data) {
        setAnnotations(prev => [...prev, ...result.data!])
        return result.data
      } else {
        console.error('バッチ作成エラー:', result.error)
        return []
      }
    } catch (error) {
      console.error('バッチ作成失敗:', error)
      return []
    }
  }, [])

  /**
   * バッチ更新
   */
  const batchUpdate = useCallback(async (
    updates: Array<{ id: string; data: DrawingUpdateData }>
  ): Promise<DrawingAnnotation[]> => {
    try {
      const result = await window.electronAPI.drawing.batchUpdate(updates)
      if (result.success && result.data) {
        // ローカル状態を更新
        const updatedMap = new Map(result.data.map(annotation => [annotation.id, annotation]))
        setAnnotations(prev => prev.map(annotation => 
          updatedMap.get(annotation.id) || annotation
        ))
        return result.data
      } else {
        console.error('バッチ更新エラー:', result.error)
        return []
      }
    } catch (error) {
      console.error('バッチ更新失敗:', error)
      return []
    }
  }, [])

  /**
   * ツール選択
   */
  const setCurrentTool = useCallback((tool: DrawingTool): void => {
    setDrawingState(prev => ({ ...prev, currentTool: tool }))
  }, [])

  /**
   * アノテーション選択
   */
  const selectAnnotation = useCallback((annotationId: string | null): void => {
    setDrawingState(prev => ({ ...prev, selectedAnnotationId: annotationId }))
    callbacksRef.current.onSelectionChange?.(annotationId)
  }, [])

  /**
   * 描画開始
   */
  const startDrawing = useCallback((annotation: Partial<DrawingCreateData>): void => {
    setDrawingState(prev => ({
      ...prev,
      drawingAnnotation: annotation,
      isDrawing: true
    }))
  }, [])

  /**
   * 描画更新
   */
  const updateDrawing = useCallback((annotation: Partial<DrawingCreateData>): void => {
    setDrawingState(prev => ({
      ...prev,
      drawingAnnotation: { ...prev.drawingAnnotation, ...annotation }
    }))
  }, [])

  /**
   * 描画完了
   */
  const finishDrawing = useCallback(async (): Promise<DrawingAnnotation | null> => {
    if (!drawingState.drawingAnnotation || !questionScoreId) {
      return null
    }

    const { questionScoreId: _, ...annotationWithoutId } = drawingState.drawingAnnotation as DrawingCreateData
    const annotationData: DrawingCreateData = {
      questionScoreId,
      ...annotationWithoutId
    }

    const result = await createAnnotation(annotationData)
    
    setDrawingState(prev => ({
      ...prev,
      drawingAnnotation: null,
      isDrawing: false
    }))

    return result
  }, [drawingState.drawingAnnotation, questionScoreId, createAnnotation])

  /**
   * 描画キャンセル
   */
  const cancelDrawing = useCallback((): void => {
    setDrawingState(prev => ({
      ...prev,
      drawingAnnotation: null,
      isDrawing: false
    }))
  }, [])

  /**
   * MathJax処理（textbox-on-canvas-v3統合）
   */
  const processMathJaxText = useCallback(async (
    htmlContent: string,
    width: number = 200,
    height: number = 50
  ): Promise<SVGSVGElement> => {
    setDrawingState(prev => ({ ...prev, isProcessingMathJax: true }))
    
    try {
      const svgElement = await createMathJaxSVG(htmlContent, width, height)
      return svgElement
    } catch (error) {
      console.error('MathJax処理エラー:', error)
      throw error
    } finally {
      setDrawingState(prev => ({ ...prev, isProcessingMathJax: false }))
    }
  }, [])

  /**
   * テキストサイズ測定（textbox-on-canvas-v3統合）
   */
  const measureTextSize = useCallback(async (
    htmlContent: string,
    width: number = 200,
    height: number = 50
  ): Promise<{ width: number; height: number }> => {
    try {
      return await measureMathJaxContentSize(htmlContent, width, height)
    } catch (error) {
      console.error('テキストサイズ測定エラー:', error)
      return { width, height }
    }
  }, [])

  /**
   * 統計情報取得
   */
  const getStats = useCallback(async (targetQuestionScoreId: string): Promise<void> => {
    try {
      const result = await window.electronAPI.drawing.getStats(targetQuestionScoreId)
      if (result.success && result.data) {
        setStats(result.data)
      } else {
        console.error('統計情報取得エラー:', result.error)
      }
    } catch (error) {
      console.error('統計情報取得失敗:', error)
    }
  }, [])

  /**
   * アノテーションクリア
   */
  const clearAnnotations = useCallback((): void => {
    setAnnotations([])
    setStats(null)
    setDrawingState({
      currentTool: 'select',
      selectedAnnotationId: null,
      drawingAnnotation: null,
      isDrawing: false,
      isProcessingMathJax: false
    })
  }, [])

  // 初期読み込み
  useEffect(() => {
    if (questionScoreId) {
      loadAnnotations(questionScoreId)
    }
  }, [questionScoreId, loadAnnotations])

  return {
    // 状態
    annotations,
    drawingState,
    stats,
    
    // アクション
    loadAnnotations,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    deleteByType,
    
    // バッチ操作
    batchCreate,
    batchUpdate,
    
    // ツール操作
    setCurrentTool,
    selectAnnotation,
    startDrawing,
    updateDrawing,
    finishDrawing,
    cancelDrawing,
    
    // MathJax処理
    processMathJaxText,
    measureTextSize,
    
    // ユーティリティ
    getStats,
    clearAnnotations
  }
}