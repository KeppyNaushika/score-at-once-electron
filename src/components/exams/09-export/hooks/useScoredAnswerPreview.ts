"use client"

import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"

import { useInvalidateOnSignal } from "@/hooks/useInvalidateOnSignal"
import type { PdfExportPageRow } from "@/queries/export"
import { pdfExportDataQuery } from "@/queries/export"
import type { AnswerOverlaySettings } from "@/types/scoringOverlay.types"

import type { ScoredAnswerPreviewPage } from "../types"
import {
  preloadScoringMarkImages,
  renderAnswerSheetToCanvas,
  type SubtotalDataForPdf,
  type TotalScoreDataForPdf,
} from "../utils/pdfCanvasRenderer"

interface UseScoredAnswerPreviewProps {
  examId: string
  /** プレビュー対象の生徒。個人成績表と採点済み答案で共通なので呼び出し側が持つ */
  previewStudentId: string | null
  answerOverlaySettings: AnswerOverlaySettings
  enabled: boolean
  /**
   * タブへ戻るたびに増える読み直しの合図。出力はデータを読み直すので、
   * プレビューを取得済みのまま据え置くと表示と出力が食い違う。
   */
  reloadKey: number
}

/** 設定変更をプレビューへ反映する際のデバウンス時間（ms） */
const RENDER_DEBOUNCE_MS = 150

/** 出力対象が無いときの空配列（毎レンダー作り直すと下流の再描画を誘発する） */
const NO_PREVIEW_PAGES: ScoredAnswerPreviewPage[] = []

/** 画像を1枚デコードする。同じ URL は使い回す（設定を変えても読み直さない） */
async function decodeImage(
  cache: Map<string, HTMLImageElement>,
  imageUrl: string
): Promise<HTMLImageElement> {
  const cached = cache.get(imageUrl)
  if (cached) return cached

  const image = new Image()
  image.crossOrigin = "anonymous"
  image.src = imageUrl
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error("画像の読み込みに失敗"))
  })
  cache.set(imageUrl, image)
  return image
}

/**
 * 採点済み答案のCanvas描画プレビューを生成するフック
 *
 * - 答案データの取得はキャッシュが持つ（生徒を切り替えたときだけ取りに行く）
 * - 画像のデコードは URL ごとに1回だけ。採点マーク設定（色・不透明度・位置・
 *   サイズ等）を変えたときは、デコード済みの画像で描き直すだけで済む
 */
export function useScoredAnswerPreview({
  examId,
  previewStudentId,
  answerOverlaySettings,
  enabled,
  reloadKey,
}: UseScoredAnswerPreviewProps) {
  // 描画結果は、どの入力に対するものかを一緒に持つ。入力が変われば
  // 一致しなくなるので、消去の effect が要らない
  const [rendered, setRendered] = useState<{
    pages: PdfExportPageRow[]
    renderConfig: AnswerOverlaySettings
    previewPages: ScoredAnswerPreviewPage[]
    error: string | null
  } | null>(null)

  // 設定変更をデバウンスして再描画用configに反映
  const [renderConfig, setRenderConfig] = useState<AnswerOverlaySettings>(
    answerOverlaySettings
  )

  const scoringMarkImagesRef = useRef<Map<string, HTMLImageElement> | null>(
    null
  )
  /**
   * デコード済みの画像。**いま出しているページの分だけ**持つ。
   *
   * 設定を変えたときに読み直さないためのもので、生徒を切り替えたら用が無い。
   * 溜め続けると、原寸の答案画像がページを開いている間ずっと積み上がる。
   */
  const decodedImagesRef = useRef<{
    pages: PdfExportPageRow[] | null
    images: Map<string, HTMLImageElement>
  }>({ pages: null, images: new Map() })
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const active = enabled && !!examId && !!previewStudentId
  const queryKey = useMemo(
    () => pdfExportDataQuery(examId, previewStudentId ?? "").queryKey,
    [examId, previewStudentId]
  )

  const {
    data: exportData,
    isFetching,
    error: fetchError,
  } = useQuery({
    ...pdfExportDataQuery(examId, previewStudentId ?? ""),
    enabled: active,
  })
  const pages = active ? (exportData?.pages ?? null) : null
  const isLoading = active && isFetching

  // タブへ戻ったら読み直す（出力はデータを読むので据え置くと食い違う）
  useInvalidateOnSignal(queryKey, reloadKey)

  // 描画中は前回の画像を出したままにする（生徒を替えるたびに白くしない）。
  // 出力対象が無いとき（未選択・答案なし・無効）だけ空にする
  const previewPages =
    !enabled || !previewStudentId || pages?.length === 0
      ? NO_PREVIEW_PAGES
      : (rendered?.previewPages ?? NO_PREVIEW_PAGES)
  // 描画時のエラーは、その描画対象がまだ現役のときだけ出す（生徒を替えた後に
  // 前の生徒の失敗が残らないようにする）
  const renderError =
    rendered !== null && rendered.pages === pages ? rendered.error : null
  const error = enabled
    ? ((fetchError
        ? fetchError.message
        : pages?.length === 0
          ? "この生徒の答案データがありません"
          : null) ?? renderError)
    : null

  // 設定変更をデバウンスして renderConfig に反映
  useEffect(() => {
    const timer = setTimeout(() => {
      setRenderConfig(answerOverlaySettings)
    }, RENDER_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [answerOverlaySettings])

  // Canvas描画（取得済みデータ or 設定変更時）
  useEffect(() => {
    if (!enabled || !pages || pages.length === 0) return
    if (rendered?.pages === pages && rendered.renderConfig === renderConfig)
      return

    let cancelled = false

    // 出す対象が変わったら、前のページのデコード結果は用済み
    if (decodedImagesRef.current.pages !== pages) {
      decodedImagesRef.current = { pages, images: new Map() }
    }

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

        const previewPages: ScoredAnswerPreviewPage[] = []
        for (const page of pages) {
          const image = await decodeImage(
            decodedImagesRef.current.images,
            page.imageUrl
          )
          if (cancelled) return

          // main が組み立てた形をそのまま描画エンジンへ渡す（PdfCanvasRenderer と同じ経路）
          const scoringDataForPdf = page.scoringData

          // 算出できたものだけを描画する。型ガードの出力がそのまま
          // SubtotalDataForPdf / TotalScoreDataForPdf になるので写し替えは不要。
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

          // main が行をそのまま載せてくるので、キャストも組み立て直しも要らない
          const annotations = page.annotations

          await renderAnswerSheetToCanvas(
            canvas,
            image,
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

          previewPages.push({
            dataUrl: canvas.toDataURL("image/png"),
            width: canvas.width,
            height: canvas.height,
          })
        }

        if (!cancelled) {
          setRendered({ pages, renderConfig, previewPages, error: null })
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Scored answer preview render error:", err)
          setRendered({
            pages,
            renderConfig,
            previewPages: [],
            error:
              err instanceof Error
                ? err.message
                : "プレビューの生成に失敗しました",
          })
        }
      }
    }

    render()

    return () => {
      cancelled = true
    }
  }, [pages, renderConfig, enabled, rendered])

  return { previewPages, isLoading, error }
}
