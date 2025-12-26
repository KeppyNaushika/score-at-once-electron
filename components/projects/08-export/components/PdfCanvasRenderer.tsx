"use client"

import type { DrawingAnnotation } from "@/types/drawing-annotation.types"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  preloadScoringMarkImages,
  renderAnswerSheetToCanvas,
  type ScoringDataForPdf,
  type ScoringMarkConfigForPdf,
} from "../utils/pdf-canvas-renderer"

/**
 * PDF出力ページデータ
 */
export interface PdfExportPageData {
  studentId: string
  studentName: string
  pageNumber: number
  imagePath: string
  imageUrl: string
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
  }>
}

interface PdfCanvasRendererProps {
  /** レンダリングするページのリスト */
  pages: PdfExportPageData[]
  /** 採点マーク設定 */
  scoringMarkConfig: ScoringMarkConfigForPdf
  /** レンダリング開始トリガー */
  startRendering: boolean
  /** 進捗コールバック */
  onProgress?: (current: number, total: number, step: string) => void
  /** 全ページのレンダリング完了時のコールバック */
  onComplete?: (
    renderedPages: Array<{
      studentId: string
      pageNumber: number
      imageData: ArrayBuffer
    }>,
  ) => void
  /** エラー発生時のコールバック */
  onError?: (error: Error) => void
}

/**
 * PDF出力用Canvas描画コンポーネント
 *
 * 非表示のCanvas要素を持ち、PDF出力時に各答案シートを順次描画する。
 * 描画完了後、全ページの画像データをonCompleteコールバックで返す。
 */
export function PdfCanvasRenderer({
  pages,
  scoringMarkConfig,
  startRendering,
  onProgress,
  onComplete,
  onError,
}: PdfCanvasRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isRendering, setIsRendering] = useState(false)
  const scoringMarkImagesRef = useRef<Map<string, HTMLImageElement> | null>(
    null,
  )

  /**
   * 画像を読み込む
   *
   * data URLの場合はそのまま読み込み、それ以外はfetch + ObjectURLで読み込む
   * これによりCanvasのtainted問題を回避
   */
  const loadImage = useCallback(async (url: string): Promise<HTMLImageElement> => {
    // data URLの場合はそのまま読み込み
    if (url.startsWith("data:")) {
      return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error(`Failed to load image from data URL`))
        img.src = url
      })
    }

    // それ以外はfetch + ObjectURLで読み込み
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
    } catch (error) {
      // フォールバック: 直接読み込み
      return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error(`Failed to load image: ${url}`))
        img.src = url
      })
    }
  }, [])

  /**
   * 全ページをレンダリング
   */
  const renderAllPages = useCallback(async () => {
    if (!canvasRef.current || pages.length === 0) {
      onComplete?.([])
      return
    }

    setIsRendering(true)

    try {
      // 採点マーク画像をプリロード
      if (!scoringMarkImagesRef.current) {
        onProgress?.(0, pages.length, "採点マーク画像を読み込み中...")
        scoringMarkImagesRef.current = await preloadScoringMarkImages(
          scoringMarkConfig.useTransparent,
        )
      }

      const renderedPages: Array<{
        studentId: string
        pageNumber: number
        imageData: ArrayBuffer
      }> = []

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i]
        onProgress?.(
          i + 1,
          pages.length,
          `${page.studentName} (${i + 1}/${pages.length})`,
        )

        try {
          // 答案画像を読み込み
          const image = await loadImage(page.imageUrl)

          // scoringDataをScoringDataForPdf形式に変換
          const scoringDataForPdf: ScoringDataForPdf[] = page.scoringData.map(
            (sd) => ({
              questionScoreId: sd.questionScoreId,
              status: sd.status,
              partialScore: sd.partialScore,
              cropRegion: {
                id: sd.cropRegion.id,
                x: sd.cropRegion.x,
                y: sd.cropRegion.y,
                width: sd.cropRegion.width,
                height: sd.cropRegion.height,
                label: sd.cropRegion.label,
              },
            }),
          )

          // annotationsをDrawingAnnotation形式に変換
          const annotations: DrawingAnnotation[] = page.annotations.map(
            (a) => ({
              id: a.id,
              questionScoreId: a.questionScoreId,
              type: a.type as "text" | "line" | "rectangle" | "ellipse",
              x: a.x,
              y: a.y,
              color: a.color,
              strokeWidth: a.strokeWidth,
              width: a.width,
              height: a.height,
              endX: a.endX,
              endY: a.endY,
              lineStyle: a.lineStyle as
                | "solid"
                | "wave"
                | "zigzag"
                | "double"
                | "arrow"
                | "both_arrow",
              text: a.text,
              fontSize: a.fontSize,
              textBoxWidth: 0,
              textBoxHeight: 0,
              horizontalAlign: "left" as const,
              verticalAlign: "top" as const,
              displayX: a.displayX,
              displayY: a.displayY,
              anchorDirection: a.anchorDirection as
                | "top-left"
                | "top"
                | "top-right"
                | "left"
                | "center"
                | "right"
                | "bottom-left"
                | "bottom"
                | "bottom-right",
              createdAt: new Date(),
              updatedAt: new Date(),
              createdByUserId: null,
            }),
          )

          // Canvas描画
          const blob = await renderAnswerSheetToCanvas(
            canvasRef.current,
            image,
            scoringDataForPdf,
            annotations,
            scoringMarkConfig,
            scoringMarkImagesRef.current,
          )

          // BlobをArrayBufferに変換
          const arrayBuffer = await blob.arrayBuffer()

          renderedPages.push({
            studentId: page.studentId,
            pageNumber: page.pageNumber,
            imageData: arrayBuffer,
          })
        } catch (pageError) {
          console.error(
            `Error rendering page ${i + 1} (${page.studentName}):`,
            pageError,
          )
          // エラーが発生しても続行（スキップ）
        }
      }

      onComplete?.(renderedPages)
    } catch (error) {
      console.error("Error during PDF rendering:", error)
      onError?.(error instanceof Error ? error : new Error(String(error)))
    } finally {
      setIsRendering(false)
    }
  }, [pages, scoringMarkConfig, loadImage, onProgress, onComplete, onError])

  /**
   * レンダリング開始トリガーを監視
   */
  useEffect(() => {
    if (startRendering && !isRendering && pages.length > 0) {
      renderAllPages()
    }
  }, [startRendering, isRendering, pages.length, renderAllPages])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        left: "-9999px",
        top: "-9999px",
        visibility: "hidden",
        pointerEvents: "none",
      }}
    />
  )
}
