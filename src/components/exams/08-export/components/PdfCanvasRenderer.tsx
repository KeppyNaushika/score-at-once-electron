"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type {
  RenderedPageData,
  RenderProgress,
} from "@/app/exams/[examId]/08-export/types"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

import {
  preloadScoringMarkImages,
  renderAnswerSheetToCanvas,
  type ScoringDataForPdf,
  type ScoringMarkConfigForPdf,
  type SubtotalDataForPdf,
  type TotalScoreDataForPdf,
} from "../utils/pdfCanvasRenderer"

/**
 * PDF出力ページデータ
 */
export interface PdfExportPageData {
  studentId: string
  studentName: string
  pageNumber: number
  imagePath: string
  imageUrl: string
  /** 用紙サイズ（mm→px変換基準。個別表示と一致させるため getPdfExportData が付与） */
  pageSize: string
  scoringData: Array<{
    questionScoreId: string
    status: string
    partialScore: number | null
    cropRegion: {
      id: string
      x: number
      y: number
      width: number
      height: number
      label: string
      maxScore: number | null
      pageNumber: number
    }
  }>
  // 小計点データ
  subtotalData?: Array<{
    regionId: string
    label: string
    score: number | null
    x: number
    y: number
    width: number
    height: number
    pageNumber: number
  }>
  // 合計点領域データ
  totalScoreData?: Array<{
    regionId: string
    score: number | null
    maxScore: number
    x: number
    y: number
    width: number
    height: number
    pageNumber: number
  }>
  // 合計点データ（後方互換性のため維持）
  totalScore?: number | null
  totalMaxScore?: number | null
  annotations: Array<{
    id: string
    questionScoreId: string
    type: string
    x: number
    y: number
    color: string
    strokeWidth: number
    width: number
    height: number
    endX: number
    endY: number
    lineStyle: string
    text: string
    fontSize: number
    displayX: number
    displayY: number
    anchorDirection: string
    userId: string
  }>
}

/** Canvas Pool のアイテム */
interface CanvasPoolItem {
  canvas: HTMLCanvasElement
  busy: boolean
  pageIndex: number | null
}

/** デフォルトのCanvas Pool サイズ */
const DEFAULT_POOL_SIZE = 4

interface PdfCanvasRendererProps {
  /** レンダリングするページのリスト */
  pages: PdfExportPageData[]
  /** 採点マーク設定 */
  scoringMarkConfig: ScoringMarkConfigForPdf
  /** レンダリング開始トリガー */
  startRendering: boolean
  /** Canvas Pool サイズ（デフォルト4） */
  poolSize?: number
  /** 詳細な進捗コールバック */
  onProgress?: (progress: RenderProgress) => void
  /** 1ページ完了時のコールバック */
  onPageComplete?: (pageData: RenderedPageData) => void
  /** 全ページのレンダリング完了時のコールバック */
  onComplete?: (
    renderedPages: Array<{
      studentId: string
      pageNumber: number
      imageData: ArrayBuffer
    }>
  ) => void | Promise<void>
  /** エラー発生時のコールバック */
  onError?: (error: Error) => void
  /** 用紙サイズ（mm→px変換基準） */
  pageSize?: string
}

/**
 * PDF出力用Canvas描画コンポーネント（並列処理対応）
 *
 * Canvas Poolを使用して複数ページを同時に描画する。
 * 描画完了したページは即座にonPageCompleteで通知される。
 */
export function PdfCanvasRenderer({
  pages,
  scoringMarkConfig,
  startRendering,
  poolSize = DEFAULT_POOL_SIZE,
  onProgress,
  onPageComplete,
  onComplete,
  onError,
  pageSize = "A4",
}: PdfCanvasRendererProps) {
  const [isRendering, setIsRendering] = useState(false)
  const scoringMarkImagesRef = useRef<Map<string, HTMLImageElement> | null>(
    null
  )
  const canvasPoolRef = useRef<CanvasPoolItem[]>([])
  const isCancelledRef = useRef(false)

  /**
   * Canvas Poolを初期化
   */
  const initCanvasPool = useCallback((size: number): CanvasPoolItem[] => {
    // 既存のCanvasを削除
    canvasPoolRef.current.forEach((poolItem) => {
      if (poolItem.canvas.parentNode) {
        poolItem.canvas.parentNode.removeChild(poolItem.canvas)
      }
    })

    // 新しいCanvas Poolを作成
    const pool: CanvasPoolItem[] = []
    for (let i = 0; i < size; i++) {
      const canvas = document.createElement("canvas")
      canvas.style.cssText =
        "position:absolute;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none"
      document.body.appendChild(canvas)
      pool.push({ canvas, busy: false, pageIndex: null })
    }
    return pool
  }, [])

  /**
   * Canvas Poolをクリーンアップ
   */
  const cleanupCanvasPool = useCallback(() => {
    canvasPoolRef.current.forEach((poolItem) => {
      if (poolItem.canvas.parentNode) {
        poolItem.canvas.parentNode.removeChild(poolItem.canvas)
      }
    })
    canvasPoolRef.current = []
  }, [])

  /**
   * 画像を読み込む
   */
  const loadImage = useCallback(
    async (url: string): Promise<HTMLImageElement> => {
      if (url.startsWith("data:")) {
        return new Promise((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.onerror = () =>
            reject(new Error(`Failed to load image from data URL`))
          img.src = url
        })
      }

      try {
        const response = await fetch(url)
        const blob = await response.blob()
        const objectUrl = URL.createObjectURL(blob)

        return new Promise((resolve, reject) => {
          const img = new Image()
          img.onload = () => {
            URL.revokeObjectURL(objectUrl)
            resolve(img)
          }
          img.onerror = () => {
            URL.revokeObjectURL(objectUrl)
            reject(new Error(`Failed to load image: ${url}`))
          }
          img.src = objectUrl
        })
      } catch {
        return new Promise((resolve, reject) => {
          const img = new Image()
          img.crossOrigin = "anonymous"
          img.onload = () => resolve(img)
          img.onerror = () => reject(new Error(`Failed to load image: ${url}`))
          img.src = url
        })
      }
    },
    []
  )

  /**
   * 1ページを描画
   */
  const renderSinglePage = useCallback(
    async (
      canvas: HTMLCanvasElement,
      page: PdfExportPageData,
      pageIndex: number,
      markImages: Map<string, HTMLImageElement>
    ): Promise<RenderedPageData> => {
      const image = await loadImage(page.imageUrl)

      const scoringDataForPdf: ScoringDataForPdf[] = page.scoringData.map(
        (scoringData) => ({
          questionScoreId: scoringData.questionScoreId,
          status: scoringData.status,
          partialScore: scoringData.partialScore,
          cropRegion: {
            id: scoringData.cropRegion.id,
            x: scoringData.cropRegion.x,
            y: scoringData.cropRegion.y,
            width: scoringData.cropRegion.width,
            height: scoringData.cropRegion.height,
            label: scoringData.cropRegion.label,
            maxScore: scoringData.cropRegion.maxScore,
          },
        })
      )

      const annotations: DrawingAnnotation[] = page.annotations.map(
        (annotation) => ({
          id: annotation.id,
          questionScoreId: annotation.questionScoreId,
          type: annotation.type as "text" | "line" | "rectangle" | "ellipse",
          x: annotation.x,
          y: annotation.y,
          color: annotation.color,
          strokeWidth: annotation.strokeWidth,
          width: annotation.width,
          height: annotation.height,
          endX: annotation.endX,
          endY: annotation.endY,
          lineStyle: annotation.lineStyle as
            "solid" | "wave" | "zigzag" | "double" | "arrow" | "both_arrow",
          text: annotation.text,
          fontSize: annotation.fontSize,
          textBoxWidth: 0,
          textBoxHeight: 0,
          horizontalAlign: "left" as const,
          verticalAlign: "top" as const,
          displayX: annotation.displayX,
          displayY: annotation.displayY,
          anchorDirection: annotation.anchorDirection as
            | "top-left"
            | "top"
            | "top-right"
            | "left"
            | "center"
            | "right"
            | "bottom-left"
            | "bottom"
            | "bottom-right",
          isFavorite: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: annotation.userId,
        })
      )

      const subtotalDataForPdf: SubtotalDataForPdf[] = (page.subtotalData || [])
        .filter(
          (
            subtotalData
          ): subtotalData is typeof subtotalData & {
            score: number
          } => subtotalData.score != null
        )
        .map((subtotalData) => ({
          regionId: subtotalData.regionId,
          label: subtotalData.label,
          score: subtotalData.score,
          x: subtotalData.x,
          y: subtotalData.y,
          width: subtotalData.width,
          height: subtotalData.height,
          pageNumber: subtotalData.pageNumber,
        }))

      const totalScoreDataForPdf: TotalScoreDataForPdf[] = (
        page.totalScoreData || []
      )
        .filter(
          (
            totalScoreData
          ): totalScoreData is typeof totalScoreData & {
            score: number
          } => totalScoreData.score != null
        )
        .map((totalScoreData) => ({
          regionId: totalScoreData.regionId,
          score: totalScoreData.score,
          maxScore: totalScoreData.maxScore,
          x: totalScoreData.x,
          y: totalScoreData.y,
          width: totalScoreData.width,
          height: totalScoreData.height,
          pageNumber: totalScoreData.pageNumber,
        }))

      const blob = await renderAnswerSheetToCanvas(
        canvas,
        image,
        scoringDataForPdf,
        annotations,
        scoringMarkConfig,
        markImages,
        subtotalDataForPdf,
        totalScoreDataForPdf,
        page.pageNumber,
        page.pageSize ?? pageSize
      )

      const arrayBuffer = await blob.arrayBuffer()

      return {
        pageIndex,
        studentId: page.studentId,
        pageNumber: page.pageNumber,
        imageData: arrayBuffer,
      }
    },
    [loadImage, scoringMarkConfig, pageSize]
  )

  /**
   * 全ページを並列レンダリング
   */
  const renderAllPagesParallel = useCallback(async () => {
    if (pages.length === 0) {
      await onComplete?.([])
      return
    }

    setIsRendering(true)

    try {
      // Canvas Poolを初期化
      const actualPoolSize = Math.min(poolSize, pages.length)
      canvasPoolRef.current = initCanvasPool(actualPoolSize)

      // 採点マーク画像をプリロード
      if (!scoringMarkImagesRef.current) {
        onProgress?.({
          phase: "preload",
          total: pages.length,
          completed: 0,
          inProgress: 0,
          currentPages: [],
        })
        scoringMarkImagesRef.current = await preloadScoringMarkImages()
      }

      const markImages = scoringMarkImagesRef.current
      const renderedPages: Map<number, RenderedPageData> = new Map()
      const pendingQueue = pages.map((_, i) => i)
      let completedCount = 0
      const currentlyRendering: Set<number> = new Set()

      // プログレス更新関数
      const updateProgress = () => {
        onProgress?.({
          phase: completedCount === pages.length ? "complete" : "rendering",
          total: pages.length,
          completed: completedCount,
          inProgress: currentlyRendering.size,
          currentPages: Array.from(currentlyRendering),
        })
      }

      // 次のページを描画する関数
      const renderNext = async (poolItem: CanvasPoolItem): Promise<void> => {
        if (pendingQueue.length === 0) return
        if (isCancelledRef.current) return

        const pageIndex = pendingQueue.shift()!
        poolItem.busy = true
        poolItem.pageIndex = pageIndex
        currentlyRendering.add(pageIndex)
        updateProgress()

        try {
          const result = await renderSinglePage(
            poolItem.canvas,
            pages[pageIndex],
            pageIndex,
            markImages
          )

          // キャンセルされていたら通知しない
          if (isCancelledRef.current) return

          renderedPages.set(pageIndex, result)
          completedCount++

          // 1ページ完了を通知
          onPageComplete?.(result)
        } catch (error) {
          if (!isCancelledRef.current) {
            console.error(`Error rendering page ${pageIndex + 1}:`, error)
          }
          // エラーでも続行
        } finally {
          poolItem.busy = false
          poolItem.pageIndex = null
          currentlyRendering.delete(pageIndex)
        }

        // キャンセルされていたら終了
        if (isCancelledRef.current) return

        updateProgress()

        // 次のページがあれば描画
        if (pendingQueue.length > 0) {
          await renderNext(poolItem)
        }
      }

      // Pool サイズ分の並列描画を開始
      await Promise.all(
        canvasPoolRef.current.map((poolItem) => renderNext(poolItem))
      )

      // キャンセルされていたら終了
      if (isCancelledRef.current) return

      // 結果を順序通りに並べて返す
      const orderedResults: Array<{
        studentId: string
        pageNumber: number
        imageData: ArrayBuffer
      }> = []
      for (let i = 0; i < pages.length; i++) {
        const result = renderedPages.get(i)
        if (result) {
          orderedResults.push({
            studentId: result.studentId,
            pageNumber: result.pageNumber,
            imageData: result.imageData,
          })
        }
      }

      await onComplete?.(orderedResults)
    } catch (error) {
      if (!isCancelledRef.current) {
        console.error("Error during parallel PDF rendering:", error)
        onError?.(error instanceof Error ? error : new Error(String(error)))
      }
    } finally {
      cleanupCanvasPool()
      setIsRendering(false)
    }
  }, [
    pages,
    poolSize,
    initCanvasPool,
    cleanupCanvasPool,
    renderSinglePage,
    onProgress,
    onPageComplete,
    onComplete,
    onError,
  ])

  // レンダリング開始トリガーを監視
  const renderAllPagesRef = useRef(renderAllPagesParallel)
  renderAllPagesRef.current = renderAllPagesParallel

  useEffect(() => {
    if (startRendering && !isRendering && pages.length > 0) {
      isCancelledRef.current = false
      renderAllPagesRef.current()
    } else if (!startRendering && isRendering) {
      // startRenderingがfalseになったらキャンセル
      isCancelledRef.current = true
    }
  }, [startRendering, pages.length, isRendering])

  // コンポーネントがアンマウントされたらCanvas Poolをクリーンアップ
  useEffect(() => {
    return () => {
      cleanupCanvasPool()
    }
  }, [cleanupCanvasPool])

  // このコンポーネント自体はDOMにCanvasを持たない（動的に作成する）
  return null
}
