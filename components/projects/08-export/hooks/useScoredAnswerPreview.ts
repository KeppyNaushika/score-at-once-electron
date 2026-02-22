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
  projectId: string
  selectedStudentIds: string[]
  scoringMarkConfig: ScoringMarkConfigForPdf
  enabled: boolean
}

export function useScoredAnswerPreview({
  projectId,
  selectedStudentIds,
  scoringMarkConfig,
  enabled,
}: UseScoredAnswerPreviewProps) {
  const [previewImageUrls, setPreviewImageUrls] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewStudentId, setPreviewStudentId] = useState<string | null>(null)
  const scoringMarkImagesRef = useRef<Map<string, HTMLImageElement> | null>(
    null
  )
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  // refでconfigを保持し、useEffect依存配列にオブジェクト直接を入れない
  const scoringMarkConfigRef = useRef(scoringMarkConfig)
  scoringMarkConfigRef.current = scoringMarkConfig

  // 選択生徒が変更されたときにpreviewStudentIdを初期化
  useEffect(() => {
    if (selectedStudentIds.length > 0) {
      if (!previewStudentId || !selectedStudentIds.includes(previewStudentId)) {
        setPreviewStudentId(selectedStudentIds[0])
      }
    } else {
      setPreviewStudentId(null)
      setPreviewImageUrls([])
    }
  }, [selectedStudentIds, previewStudentId])

  // enabled が false になったらリセット
  useEffect(() => {
    if (!enabled) {
      setPreviewImageUrls([])
      setError(null)
      setIsLoading(false)
    }
  }, [enabled])

  // previewStudentId変更時にCanvas描画
  useEffect(() => {
    if (!enabled || !projectId || !previewStudentId) {
      return
    }

    let cancelled = false

    const render = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // 1. データ取得
        const dataResult = await window.electronAPI.export.getPdfExportData({
          projectId,
          selectedStudentIds: [previewStudentId],
        })

        if (cancelled) return

        if (!dataResult.success || !dataResult.pages) {
          setError(dataResult.error || "データの取得に失敗しました")
          setPreviewImageUrls([])
          return
        }

        if (dataResult.pages.length === 0) {
          setError("この生徒の答案データがありません")
          setPreviewImageUrls([])
          return
        }

        // 2. 採点マーク画像のプリロード
        const config = scoringMarkConfigRef.current
        if (!scoringMarkImagesRef.current) {
          scoringMarkImagesRef.current = await preloadScoringMarkImages(
            config.useTransparent
          )
        }

        if (cancelled) return

        // 3. Canvas要素の作成（非表示）
        if (!canvasRef.current) {
          canvasRef.current = document.createElement("canvas")
        }
        const canvas = canvasRef.current

        // 4. 各ページを描画してdata URLに変換
        const urls: string[] = []
        for (const page of dataResult.pages) {
          // 画像の読み込み
          const img = new Image()
          img.crossOrigin = "anonymous"
          img.src = page.imageUrl

          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = () => reject(new Error("画像の読み込みに失敗"))
          })

          if (cancelled) return

          // scoringDataをScoringDataForPdf形式に変換
          const scoringDataForPdf = page.scoringData.map((sd) => ({
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
              maxScore: sd.cropRegion.maxScore,
              projectPage: {
                pageNumber: sd.cropRegion.pageNumber,
              },
            },
          }))

          // subtotalDataをSubtotalDataForPdf形式に変換
          const subtotalDataForPdf: SubtotalDataForPdf[] = (
            page.subtotalData || []
          )
            .filter(
              (sd): sd is typeof sd & { score: number } => sd.score != null
            )
            .map((sd) => ({
              regionId: sd.regionId,
              label: sd.label,
              score: sd.score,
              x: sd.x,
              y: sd.y,
              width: sd.width,
              height: sd.height,
              pageNumber: sd.pageNumber,
            }))

          // totalScoreDataをTotalScoreDataForPdf形式に変換
          const totalScoreDataForPdf: TotalScoreDataForPdf[] = (
            page.totalScoreData || []
          )
            .filter(
              (td): td is typeof td & { score: number } => td.score != null
            )
            .map((td) => ({
              regionId: td.regionId,
              score: td.score,
              maxScore: td.maxScore,
              x: td.x,
              y: td.y,
              width: td.width,
              height: td.height,
              pageNumber: td.pageNumber,
            }))

          // annotationsをDrawingAnnotation形式にキャスト
          // IPC経由のデータは一部フィールドが欠落しているが、
          // renderAnswerSheetToCanvasが使用するフィールドは全て含まれている
          const annotations = page.annotations as unknown as DrawingAnnotation[]

          // Canvas描画
          await renderAnswerSheetToCanvas(
            canvas,
            img,
            scoringDataForPdf,
            annotations,
            config,
            scoringMarkImagesRef.current!,
            subtotalDataForPdf,
            totalScoreDataForPdf,
            page.pageNumber
          )

          if (cancelled) return

          // data URLに変換
          urls.push(canvas.toDataURL("image/png"))
        }

        setPreviewImageUrls(urls)
      } catch (err) {
        if (!cancelled) {
          console.error("Scored answer preview error:", err)
          setError(
            err instanceof Error
              ? err.message
              : "プレビューの生成に失敗しました"
          )
          setPreviewImageUrls([])
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    render()

    return () => {
      cancelled = true
    }
    // scoringMarkConfigはrefで参照するため依存配列に含めない
  }, [projectId, previewStudentId, enabled])

  return {
    previewImageUrls,
    isLoading,
    error,
    previewStudentId,
    setPreviewStudentId,
  }
}
