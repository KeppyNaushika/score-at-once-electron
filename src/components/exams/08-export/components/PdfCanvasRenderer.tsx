"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type {
  RenderedPageData,
  RenderProgress,
} from "@/components/exams/08-export/types"
import type { PdfExportPageData } from "@/electron-src/lib/prisma/pdfExport"
import type { AnswerOverlaySettings } from "@/types/scoringOverlay.types"

import {
  preloadScoringMarkImages,
  renderAnswerSheetToCanvas,
  type ScoringDataForPdf,
  type SubtotalDataForPdf,
  type TotalScoreDataForPdf,
} from "../utils/pdfCanvasRenderer"

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
  answerOverlaySettings: AnswerOverlaySettings
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
      examStudentId: string
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
  answerOverlaySettings,
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

      // main が include した行をそのまま描画エンジンへ渡す。
      // 組み立て直すと union 列を `as` で絞り直すことになり、
      // 落ちた列を既定値で埋める必要も出る。
      const scoringDataForPdf: ScoringDataForPdf[] = page.scoringData
      const annotations = page.annotations

      // 算出できたものだけを描画する。型ガードの出力がそのまま
      // SubtotalDataForPdf / TotalScoreDataForPdf（score が非 null）になるので、
      // 列を写し替える必要はない。
      const subtotalDataForPdf: SubtotalDataForPdf[] = (
        page.subtotalData || []
      ).filter(
        (
          subtotalData
        ): subtotalData is typeof subtotalData & { score: number } =>
          subtotalData.score != null
      )

      const totalScoreDataForPdf: TotalScoreDataForPdf[] = (
        page.totalScoreData || []
      ).filter(
        (
          totalScoreData
        ): totalScoreData is typeof totalScoreData & { score: number } =>
          totalScoreData.score != null
      )

      const blob = await renderAnswerSheetToCanvas(
        canvas,
        image,
        scoringDataForPdf,
        annotations,
        answerOverlaySettings,
        markImages,
        subtotalDataForPdf,
        totalScoreDataForPdf,
        page.pageNumber,
        page.pageSize ?? pageSize
      )

      const arrayBuffer = await blob.arrayBuffer()

      return {
        pageIndex,
        examStudentId: page.examStudentId,
        pageNumber: page.pageNumber,
        imageData: arrayBuffer,
      }
    },
    [loadImage, answerOverlaySettings, pageSize]
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
        examStudentId: string
        pageNumber: number
        imageData: ArrayBuffer
      }> = []
      for (let i = 0; i < pages.length; i++) {
        const result = renderedPages.get(i)
        if (result) {
          orderedResults.push({
            examStudentId: result.examStudentId,
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
  useEffect(() => {
    renderAllPagesRef.current = renderAllPagesParallel
  })

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
