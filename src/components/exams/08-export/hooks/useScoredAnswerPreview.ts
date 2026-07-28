"use client"

import { useEffect, useRef, useState } from "react"

import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

import type {
  ScoringMarkConfigForPdf,
  SubtotalDataForPdf,
  TotalScoreDataForPdf,
} from "../utils/pdfCanvasRenderer"
import {
  preloadScoringMarkImages,
  renderAnswerSheetToCanvas,
} from "../utils/pdfCanvasRenderer"

interface UseScoredAnswerPreviewProps {
  examId: string
  selectedExamStudentIds: string[]
  scoringMarkConfig: ScoringMarkConfigForPdf
  enabled: boolean
}

/** getPdfExportData が返す1ページ分のデータ型 */
type PreviewPage = NonNullable<
  Awaited<
    ReturnType<typeof window.electronAPI.export.getPdfExportData>
  >["pages"]
>[number]

/** 画像デコード済みのページ（IPC再取得せずに再描画するためのキャッシュ） */
interface LoadedPage {
  page: PreviewPage
  img: HTMLImageElement
}

/** 設定変更をプレビューへ反映する際のデバウンス時間（ms） */
const RENDER_DEBOUNCE_MS = 150

/**
 * 採点済み答案のCanvas描画プレビューを生成するフック
 *
 * - 答案データ取得と画像デコードは生徒切替時のみ実行（重い処理）
 * - 採点マーク設定（色・不透明度・位置・サイズ等）の変更は、
 *   キャッシュ済み画像を使ったCanvas再描画のみで反映する（デバウンス付き）
 */
export function useScoredAnswerPreview({
  examId,
  selectedExamStudentIds,
  scoringMarkConfig,
  enabled,
}: UseScoredAnswerPreviewProps) {
  const [previewImageUrls, setPreviewImageUrls] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewStudentId, setPreviewStudentId] = useState<string | null>(null)
  const [loadedPages, setLoadedPages] = useState<LoadedPage[] | null>(null)

  // 設定変更をデバウンスして再描画用configに反映
  const [renderConfig, setRenderConfig] =
    useState<ScoringMarkConfigForPdf>(scoringMarkConfig)

  const scoringMarkImagesRef = useRef<Map<string, HTMLImageElement> | null>(
    null
  )
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // 選択生徒が変更されたときにpreviewStudentIdを初期化
  useEffect(() => {
    if (selectedExamStudentIds.length > 0) {
      if (
        !previewStudentId ||
        !selectedExamStudentIds.includes(previewStudentId)
      ) {
        setPreviewStudentId(selectedExamStudentIds[0])
      }
    } else {
      setPreviewStudentId(null)
      setPreviewImageUrls([])
    }
  }, [selectedExamStudentIds, previewStudentId])

  // enabled が false になったらリセット
  useEffect(() => {
    if (!enabled) {
      setPreviewImageUrls([])
      setError(null)
      setIsLoading(false)
    }
  }, [enabled])

  // 設定変更をデバウンスして renderConfig に反映
  useEffect(() => {
    const timer = setTimeout(() => {
      setRenderConfig(scoringMarkConfig)
    }, RENDER_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [scoringMarkConfig])

  // 答案データ取得＋画像デコード（生徒切替時のみ）
  useEffect(() => {
    if (!enabled || !examId || !previewStudentId) {
      setLoadedPages(null)
      return
    }

    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const dataResult = await window.electronAPI.export.getPdfExportData({
          examId,
          selectedExamStudentIds: [previewStudentId],
        })

        if (cancelled) return

        if (!dataResult.success || !dataResult.pages) {
          setError(dataResult.error || "データの取得に失敗しました")
          setLoadedPages(null)
          return
        }

        if (dataResult.pages.length === 0) {
          setError("この生徒の答案データがありません")
          setLoadedPages([])
          return
        }

        // 各ページの画像をデコード
        const loaded: LoadedPage[] = []
        for (const page of dataResult.pages) {
          const img = new Image()
          img.crossOrigin = "anonymous"
          img.src = page.imageUrl

          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = () => reject(new Error("画像の読み込みに失敗"))
          })

          if (cancelled) return
          loaded.push({ page, img })
        }

        if (!cancelled) setLoadedPages(loaded)
      } catch (err) {
        if (!cancelled) {
          console.error("Scored answer preview data load error:", err)
          setError(
            err instanceof Error
              ? err.message
              : "プレビューの生成に失敗しました"
          )
          setLoadedPages(null)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [examId, previewStudentId, enabled])

  // Canvas描画（取得済みデータ or 設定変更時）
  useEffect(() => {
    if (!enabled || !loadedPages) return

    if (loadedPages.length === 0) {
      setPreviewImageUrls([])
      return
    }

    let cancelled = false

    const render = async () => {
      try {
        // 採点マーク画像のプリロード
        if (!scoringMarkImagesRef.current) {
          scoringMarkImagesRef.current = await preloadScoringMarkImages()
        }

        if (cancelled) return

        if (!canvasRef.current) {
          canvasRef.current = document.createElement("canvas")
        }
        const canvas = canvasRef.current

        const urls: string[] = []
        for (const { page, img } of loadedPages) {
          const scoringDataForPdf = page.scoringData.map((scoreData) => ({
            questionScoreId: scoreData.questionScoreId,
            status: scoreData.status,
            partialScore: scoreData.partialScore,
            cropRegion: {
              id: scoreData.cropRegion.id,
              x: scoreData.cropRegion.x,
              y: scoreData.cropRegion.y,
              width: scoreData.cropRegion.width,
              height: scoreData.cropRegion.height,
              label: scoreData.cropRegion.label,
              maxScore: scoreData.cropRegion.maxScore,
              examPage: {
                pageNumber: scoreData.cropRegion.pageNumber,
              },
            },
          }))

          const subtotalDataForPdf: SubtotalDataForPdf[] = (
            page.subtotalData || []
          )
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

          // annotationsをDrawingAnnotation形式にキャスト
          // IPC経由のデータは一部フィールドが欠落しているが、
          // renderAnswerSheetToCanvasが使用するフィールドは全て含まれている
          const annotations = page.annotations as unknown as DrawingAnnotation[]

          await renderAnswerSheetToCanvas(
            canvas,
            img,
            scoringDataForPdf,
            annotations,
            renderConfig,
            scoringMarkImagesRef.current!,
            subtotalDataForPdf,
            totalScoreDataForPdf,
            page.pageNumber,
            page.pageSize ?? "A4"
          )

          if (cancelled) return

          urls.push(canvas.toDataURL("image/png"))
        }

        if (!cancelled) setPreviewImageUrls(urls)
      } catch (err) {
        if (!cancelled) {
          console.error("Scored answer preview render error:", err)
          setError(
            err instanceof Error
              ? err.message
              : "プレビューの生成に失敗しました"
          )
          setPreviewImageUrls([])
        }
      }
    }

    render()

    return () => {
      cancelled = true
    }
  }, [loadedPages, renderConfig, enabled])

  return {
    previewImageUrls,
    isLoading,
    error,
    previewStudentId,
    setPreviewStudentId,
  }
}
