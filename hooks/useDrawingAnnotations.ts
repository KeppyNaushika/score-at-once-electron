/**
 * @fileoverview 統合描画アノテーション管理フック（シンプル版）
 * @description 単一フックで全機能を提供し、無限ループを防止
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import type {
  DrawingAnnotation,
  DrawingCreateData,
  DrawingUpdateData,
  DrawingType,
  DrawingTool,
  DrawingAnnotationStats
} from '@/types/drawing-annotation.types'

// MathJax処理
import { createMathJaxSVG, measureMathJaxContentSize } from '@/app/textbox-on-canvas-v3/utils/mathJaxUtils'

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
  stats: DrawingAnnotationStats | null
  isLoading: boolean
  error: string | null
  
  // データ操作
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
  resetAll: () => void
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
  const [stats, setStats] = useState<DrawingAnnotationStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // 描画ツール状態
  const [drawingState, setDrawingState] = useState<DrawingState>({
    currentTool: 'select',
    selectedAnnotationId: null,
    drawingAnnotation: null,
    isDrawing: false,
    isProcessingMathJax: false
  })

  // コールバック参照
  const callbacksRef = useRef<Partial<DrawingCallbacks>>(callbacks || {})
  
  useEffect(() => {
    callbacksRef.current = callbacks || {}
  }, [callbacks])

  /**
   * アノテーション読み込み
   */
  const loadAnnotations = useCallback(async (
    questionScoreId: string,
    type?: DrawingType
  ): Promise<void> => {
    setIsLoading(true)
    setError(null)
    
    try {
      console.log(`📖 手動アノテーション読み込み: ${questionScoreId}`, { type })
      const result = await window.electronAPI.drawing.getByQuestionScore(questionScoreId, type)
      
      if (result.success && result.data) {
        console.log(`✅ アノテーション読み込み成功: ${result.data.length}件`)
        setAnnotations(result.data)
      } else {
        console.error('❌ アノテーション読み込みエラー:', result.error)
        setError(result.error || 'アノテーション読み込みに失敗しました')
        setAnnotations([])
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'アノテーション読み込みに失敗しました'
      console.error('💥 アノテーション読み込み失敗:', err)
      setError(errorMessage)
      setAnnotations([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * アノテーション作成
   */
  const createAnnotation = useCallback(async (
    data: DrawingCreateData
  ): Promise<DrawingAnnotation | null> => {
    try {
      console.log('🎨 アノテーション作成:', data.type)
      
      // QuestionScore自動作成用の情報がない場合はcontextから補完
      const enrichedData: DrawingCreateData = {
        ...data,
        studentId: data.studentId || context?.currentStudentId,
        cropRegionId: data.cropRegionId || context?.currentCropRegionId,
        scoredByUserId: data.scoredByUserId || context?.currentUserId
      }
      
      console.log('📝 補完されたデータ:', {
        studentId: enrichedData.studentId,
        cropRegionId: enrichedData.cropRegionId,
        scoredByUserId: enrichedData.scoredByUserId
      })
      
      const result = await window.electronAPI.drawing.create(enrichedData)
      
      if (result.success && result.data) {
        setAnnotations(prev => [...prev, result.data!])
        callbacksRef.current.onCreateAnnotation?.(data)
        return result.data
      } else {
        console.error('❌ アノテーション作成エラー:', result.error)
        setError(result.error || 'アノテーション作成に失敗しました')
        return null
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'アノテーション作成に失敗しました'
      console.error('💥 アノテーション作成失敗:', err)
      setError(errorMessage)
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
      console.log(`✏️ アノテーション更新: ${id}`)
      const result = await window.electronAPI.drawing.update(id, data)
      
      if (result.success && result.data) {
        setAnnotations(prev => prev.map(ann => ann.id === id ? result.data! : ann))
        callbacksRef.current.onUpdateAnnotation?.(id, data)
        return result.data
      } else {
        console.error('❌ アノテーション更新エラー:', result.error)
        setError(result.error || 'アノテーション更新に失敗しました')
        return null
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'アノテーション更新に失敗しました'
      console.error('💥 アノテーション更新失敗:', err)
      setError(errorMessage)
      return null
    }
  }, [])

  /**
   * アノテーション削除
   */
  const deleteAnnotation = useCallback(async (id: string): Promise<boolean> => {
    try {
      console.log(`🗑️ アノテーション削除: ${id}`)
      const result = await window.electronAPI.drawing.delete(id)
      
      if (result.success) {
        setAnnotations(prev => prev.filter(ann => ann.id !== id))
        callbacksRef.current.onDeleteAnnotation?.(id)
        return true
      } else {
        console.error('❌ アノテーション削除エラー:', result.error)
        setError(result.error || 'アノテーション削除に失敗しました')
        return false
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'アノテーション削除に失敗しました'
      console.error('💥 アノテーション削除失敗:', err)
      setError(errorMessage)
      return false
    }
  }, [])

  /**
   * タイプ別削除
   */
  const deleteByType = useCallback(async (
    questionScoreId: string,
    type?: DrawingType
  ): Promise<boolean> => {
    try {
      console.log(`🗑️ タイプ別削除:`, { questionScoreId, type })
      const result = await window.electronAPI.drawing.deleteByQuestionScore(questionScoreId, type)
      
      if (result.success) {
        if (type) {
          setAnnotations(prev => prev.filter(ann => ann.type !== type))
        } else {
          setAnnotations([])
        }
        return true
      } else {
        console.error('❌ タイプ別削除エラー:', result.error)
        setError(result.error || 'タイプ別削除に失敗しました')
        return false
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'タイプ別削除に失敗しました'
      console.error('💥 タイプ別削除失敗:', err)
      setError(errorMessage)
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
      console.log(`🎨 バッチ作成: ${annotationsData.length}件`)
      const result = await window.electronAPI.drawing.batchCreate(annotationsData)
      
      if (result.success && result.data) {
        setAnnotations(prev => [...prev, ...result.data!])
        return result.data
      } else {
        console.error('❌ バッチ作成エラー:', result.error)
        setError(result.error || 'バッチ作成に失敗しました')
        return []
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'バッチ作成に失敗しました'
      console.error('💥 バッチ作成失敗:', err)
      setError(errorMessage)
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
      console.log(`✏️ バッチ更新: ${updates.length}件`)
      const result = await window.electronAPI.drawing.batchUpdate(updates)
      
      if (result.success && result.data) {
        const updatedMap = new Map(result.data.map(ann => [ann.id, ann]))
        setAnnotations(prev => prev.map(ann => updatedMap.get(ann.id) || ann))
        return result.data
      } else {
        console.error('❌ バッチ更新エラー:', result.error)
        setError(result.error || 'バッチ更新に失敗しました')
        return []
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'バッチ更新に失敗しました'
      console.error('💥 バッチ更新失敗:', err)
      setError(errorMessage)
      return []
    }
  }, [])

  /**
   * ツール設定
   */
  const setCurrentTool = useCallback((tool: DrawingTool): void => {
    console.log(`🔧 ツール変更: ${drawingState.currentTool} → ${tool}`)
    setDrawingState(prev => ({
      ...prev,
      currentTool: tool,
      selectedAnnotationId: tool === 'select' ? prev.selectedAnnotationId : null
    }))
  }, [drawingState.currentTool])

  /**
   * アノテーション選択
   */
  const selectAnnotation = useCallback((annotationId: string | null): void => {
    console.log(`👆 アノテーション選択: ${annotationId}`)
    setDrawingState(prev => ({
      ...prev,
      selectedAnnotationId: annotationId,
      currentTool: annotationId ? 'select' : prev.currentTool
    }))
    
    const selectedAnnotation = annotationId 
      ? annotations.find(ann => ann.id === annotationId) || null 
      : null
    
    callbacksRef.current.onSelectAnnotation?.(selectedAnnotation)
  }, [annotations])

  /**
   * 描画開始
   */
  const startDrawing = useCallback((annotation: Partial<DrawingCreateData>): void => {
    console.log(`🎨 描画開始: ${annotation.type}`, annotation)
    setDrawingState(prev => ({
      ...prev,
      drawingAnnotation: annotation,
      isDrawing: true,
      selectedAnnotationId: null
    }))
  }, [])

  /**
   * 描画更新
   */
  const updateDrawing = useCallback((annotation: Partial<DrawingCreateData>): void => {
    setDrawingState(prev => {
      if (!prev.isDrawing || !prev.drawingAnnotation) return prev
      
      return {
        ...prev,
        drawingAnnotation: {
          ...prev.drawingAnnotation,
          ...annotation
        }
      }
    })
  }, [])

  /**
   * 描画完了
   */
  const finishDrawing = useCallback(async (): Promise<DrawingAnnotation | null> => {
    if (!drawingState.isDrawing || !drawingState.drawingAnnotation || !drawingState.drawingAnnotation.questionScoreId) {
      console.warn('⚠️ 描画完了: 描画中のアノテーションがありません')
      return null
    }

    const completeData: DrawingCreateData = {
      questionScoreId: drawingState.drawingAnnotation.questionScoreId,
      type: drawingState.drawingAnnotation.type as DrawingType,
      x: drawingState.drawingAnnotation.x || 0,
      y: drawingState.drawingAnnotation.y || 0,
      color: drawingState.drawingAnnotation.color || '#ef4444',
      strokeWidth: drawingState.drawingAnnotation.strokeWidth || 3,
      width: drawingState.drawingAnnotation.width || 0,
      height: drawingState.drawingAnnotation.height || 0,
      endX: drawingState.drawingAnnotation.endX || 0,
      endY: drawingState.drawingAnnotation.endY || 0,
      lineStyle: drawingState.drawingAnnotation.lineStyle || 'solid',
      text: drawingState.drawingAnnotation.text || '',
      fontSize: drawingState.drawingAnnotation.fontSize || 16,
      textBoxWidth: drawingState.drawingAnnotation.textBoxWidth || 0,
      textBoxHeight: drawingState.drawingAnnotation.textBoxHeight || 0,
      horizontalAlign: drawingState.drawingAnnotation.horizontalAlign || 'left',
      verticalAlign: drawingState.drawingAnnotation.verticalAlign || 'top',
      displayX: drawingState.drawingAnnotation.displayX || 0,
      displayY: drawingState.drawingAnnotation.displayY || 0,
      createdByUserId: drawingState.drawingAnnotation.createdByUserId,
      // QuestionScore自動作成用の情報（contextから取得）
      studentId: context?.currentStudentId,
      cropRegionId: context?.currentCropRegionId,
      scoredByUserId: context?.currentUserId
    }

    const result = await createAnnotation(completeData)

    setDrawingState(prev => ({
      ...prev,
      drawingAnnotation: null,
      isDrawing: false
    }))

    return result
  }, [drawingState.drawingAnnotation, drawingState.isDrawing, createAnnotation])

  /**
   * 描画キャンセル
   */
  const cancelDrawing = useCallback((): void => {
    console.log('❌ 描画キャンセル')
    setDrawingState(prev => ({
      ...prev,
      drawingAnnotation: null,
      isDrawing: false
    }))
  }, [])

  /**
   * MathJax処理
   */
  const processMathJaxText = useCallback(async (
    htmlContent: string,
    width: number = 200,
    height: number = 50
  ): Promise<SVGSVGElement> => {
    setDrawingState(prev => ({ ...prev, isProcessingMathJax: true }))

    try {
      console.log('🔢 MathJax SVG変換開始:', { htmlContent, width, height })
      const svgElement = await createMathJaxSVG(htmlContent, width, height)
      console.log('✅ MathJax SVG変換完了')
      return svgElement
    } catch (error) {
      console.error('💥 MathJax SVG変換失敗:', error)
      throw error
    } finally {
      setDrawingState(prev => ({ ...prev, isProcessingMathJax: false }))
    }
  }, [])

  /**
   * MathJaxサイズ測定
   */
  const measureTextSize = useCallback(async (
    htmlContent: string,
    width: number = 200,
    height: number = 50
  ): Promise<{ width: number; height: number }> => {
    try {
      console.log('📏 MathJaxサイズ測定開始:', { htmlContent, width, height })
      const size = await measureMathJaxContentSize(htmlContent, width, height)
      console.log('✅ MathJaxサイズ測定完了:', size)
      return size
    } catch (error) {
      console.error('💥 MathJaxサイズ測定失敗:', error)
      throw error
    }
  }, [])

  /**
   * 統計取得
   */
  const getStats = useCallback(async (questionScoreId: string): Promise<void> => {
    try {
      console.log(`📊 統計取得: ${questionScoreId}`)
      const result = await window.electronAPI.drawing.getStats(questionScoreId)
      
      if (result.success && result.data) {
        setStats(result.data)
      } else {
        console.error('❌ 統計取得エラー:', result.error)
        setError(result.error || '統計取得に失敗しました')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '統計取得に失敗しました'
      console.error('💥 統計取得失敗:', err)
      setError(errorMessage)
    }
  }, [])

  /**
   * アノテーションクリア
   */
  const clearAnnotations = useCallback((): void => {
    console.log('🧹 アノテーションクリア')
    setAnnotations([])
    setStats(null)
    setError(null)
  }, [])

  /**
   * 全状態リセット
   */
  const resetAll = useCallback((): void => {
    console.log('🔄 全状態リセット')
    setAnnotations([])
    setStats(null)
    setError(null)
    setDrawingState({
      currentTool: 'select',
      selectedAnnotationId: null,
      drawingAnnotation: null,
      isDrawing: false,
      isProcessingMathJax: false
    })
  }, [])

  return {
    // 状態
    annotations,
    drawingState,
    stats,
    isLoading,
    error,
    
    // データ操作
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
    clearAnnotations,
    resetAll
  }
}

// 必要な型を再エクスポート
export type { DrawingTool } from '@/types/drawing-annotation.types'