"use client"

import { useEffect, useRef, useState } from "react"

import type { AnswerOverlaySettings } from "@/types/scoringOverlay.types"

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
   * タブへ戻るたびに増える読み直しの合図。出力は実データを読み直すので、
   * プレビューを取得済みのまま据え置くと表示と出力が食い違う。
   */
  reloadKey: number
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

/** 出力対象が無いときの空配列（毎レンダー作り直すと下流の再描画を誘発する） */
const NO_PREVIEW_IMAGE_URLS: string[] = []

/**
 * 採点済み答案のCanvas描画プレビューを生成するフック
 *
 * - 答案データ取得と画像デコードは生徒切替時のみ実行（重い処理）
 * - 採点マーク設定（色・不透明度・位置・サイズ等）の変更は、
 *   キャッシュ済み画像を使ったCanvas再描画のみで反映する（デバウンス付き）
 */
export function useScoredAnswerPreview({
  examId,
  previewStudentId,
  answerOverlaySettings,
  enabled,
  reloadKey,
}: UseScoredAnswerPreviewProps) {
  // 取得結果・描画結果は、どの入力に対するものかを一緒に持つ。入力が変われば
  // 一致しなくなるので、読み込み中フラグや消去の effect が要らない
  const [fetched, setFetched] = useState<{
    examId: string
    previewStudentId: string
    reloadKey: number
    pages: LoadedPage[] | null
    error: string | null
  } | null>(null)
  const [rendered, setRendered] = useState<{
    pages: LoadedPage[]
    renderConfig: AnswerOverlaySettings
    urls: string[]
    error: string | null
  } | null>(null)

  // 設定変更をデバウンスして再描画用configに反映
  const [renderConfig, setRenderConfig] = useState<AnswerOverlaySettings>(
    answerOverlaySettings
  )

  const scoringMarkImagesRef = useRef<Map<string, HTMLImageElement> | null>(
    null
  )
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const active = enabled && !!examId && !!previewStudentId
  const isFetchCurrent =
    fetched?.examId === examId &&
    fetched.previewStudentId === previewStudentId &&
    fetched.reloadKey === reloadKey
  const loadedPages = active && isFetchCurrent ? fetched.pages : null
  const isLoading = active && !isFetchCurrent

  // 描画中は前回の画像を出したままにする（生徒を替えるたびに白くしない）。
  // 出力対象が無いとき（未選択・答案なし・無効）だけ空にする
  const previewImageUrls =
    !enabled || !previewStudentId || loadedPages?.length === 0
      ? NO_PREVIEW_IMAGE_URLS
      : (rendered?.urls ?? NO_PREVIEW_IMAGE_URLS)
  // 描画時のエラーは、その描画対象がまだ現役のときだけ出す（生徒を替えた後に
  // 前の生徒の失敗が残らないようにする）
  const renderError =
    rendered !== null && rendered.pages === loadedPages ? rendered.error : null
  const error = enabled
    ? ((active && isFetchCurrent ? fetched.error : null) ?? renderError)
    : null

  // 設定変更をデバウンスして renderConfig に反映
  useEffect(() => {
    const timer = setTimeout(() => {
      setRenderConfig(answerOverlaySettings)
    }, RENDER_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [answerOverlaySettings])

  // 答案データ取得＋画像デコード（生徒切替時のみ）
  useEffect(() => {
    if (!active || isFetchCurrent || !previewStudentId) return

    let cancelled = false

    const load = async () => {
      try {
        const dataResult = await window.electronAPI.export.getPdfExportData({
          examId,
          selectedExamStudentIds: [previewStudentId],
        })

        if (cancelled) return

        if (!dataResult.success || !dataResult.pages) {
          setFetched({
            examId,
            previewStudentId,
            reloadKey,
            pages: null,
            error: dataResult.error || "データの取得に失敗しました",
          })
          return
        }

        if (dataResult.pages.length === 0) {
          setFetched({
            examId,
            previewStudentId,
            reloadKey,
            pages: [],
            error: "この生徒の答案データがありません",
          })
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

        if (!cancelled) {
          setFetched({
            examId,
            previewStudentId,
            reloadKey,
            pages: loaded,
            error: null,
          })
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Scored answer preview data load error:", err)
          setFetched({
            examId,
            previewStudentId,
            reloadKey,
            pages: null,
            error:
              err instanceof Error
                ? err.message
                : "プレビューの生成に失敗しました",
          })
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [active, isFetchCurrent, examId, previewStudentId, reloadKey])

  // Canvas描画（取得済みデータ or 設定変更時）
  useEffect(() => {
    if (!enabled || !loadedPages || loadedPages.length === 0) return
    if (
      rendered?.pages === loadedPages &&
      rendered.renderConfig === renderConfig
    )
      return

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

        if (!cancelled) {
          setRendered({
            pages: loadedPages,
            renderConfig,
            urls,
            error: null,
          })
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Scored answer preview render error:", err)
          setRendered({
            pages: loadedPages,
            renderConfig,
            urls: [],
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
  }, [loadedPages, renderConfig, enabled, rendered])

  return { previewImageUrls, isLoading, error }
}
