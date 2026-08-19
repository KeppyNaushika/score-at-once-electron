"use client"

import type { Exam } from "@prisma/client"
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import type {
  ExportOptions,
  RenderedPageData,
  RenderProgress,
} from "@/components/exams/08-export/types"
import type { PdfExportPageData } from "@/electron-src/lib/prisma/pdfExport"
import {
  addPageToStreamingSession,
  cancelStreamingSession,
  createPdfStreamingSession,
  fetchPdfExportData,
  finalizeStreamingSession,
  selectPdfSavePath,
} from "@/queries/export"

interface UseScoredAnswerPdfExportParams {
  exam: Exam | null
  selectedStudents: Set<string>
  exportOptions: ExportOptions
  setIsExporting: Dispatch<SetStateAction<boolean>>
  setShowProgressModal: Dispatch<SetStateAction<boolean>>
  setExportProgress: Dispatch<SetStateAction<number>>
  setExportStatus: Dispatch<
    SetStateAction<"processing" | "completed" | "error">
  >
  setCurrentStep: Dispatch<SetStateAction<string>>
  /** PDFの保存が実際に完了したときに呼ばれる（監査記録など後処理用） */
  onExportCompleted?: () => void
}

/**
 * 採点済み答案の Canvas 描画ベース PDF 出力（ストリーミング処理フロー）を管理するフック。
 * 1. データ取得 → 2. ストリーミングセッション作成 & 保存先選択 → 3. Canvas描画（完了次第PDF埋め込み） → 4. PDF保存
 *
 * プログレスモーダルの状態（進捗・ステップ・出力中フラグ）は useExportPage が保持する共有状態を
 * 受け取って更新する。Canvas描画・PDF埋め込みに固有の状態（ページ・セッション・埋め込み数など）は
 * 本フック内に閉じる。
 */
export function useScoredAnswerPdfExport({
  exam,
  selectedStudents,
  exportOptions,
  setIsExporting,
  setShowProgressModal,
  setExportProgress,
  setExportStatus,
  setCurrentStep,
  onExportCompleted,
}: UseScoredAnswerPdfExportParams) {
  // Canvas描画用の状態
  const [pdfExportPages, setPdfExportPages] = useState<PdfExportPageData[]>([])
  // 失敗したページを名前で知らせるための控え。`handlePageComplete` は描画中に
  // 何度も呼ばれるので状態を閉じ込めず、ref で引く
  const pdfExportPagesRef = useRef<PdfExportPageData[]>([])
  const [startCanvasRendering, setStartCanvasRendering] = useState(false)

  // 保存先選択のPromiseを保持（並行処理用）。
  // 形は境界の宣言から導く（手で書き写すとチャンネルの変更に追随できない）
  const savePathPromiseRef = useRef<ReturnType<
    typeof selectPdfSavePath
  > | null>(null)

  // ストリーミングセッション用の状態
  const streamingSessionIdRef = useRef<string | null>(null)
  const [embeddedPagesCount, setEmbeddedPagesCount] = useState(0)
  const [totalPagesCount, setTotalPagesCount] = useState(0)
  const [canvasRenderingComplete, setCanvasRenderingComplete] = useState(false)
  const savePathResultRef = useRef<{ filePath: string } | null>(null)
  const isExportCancelledRef = useRef(false)

  const executeExportScoredAnswers = async () => {
    if (!exam) return
    try {
      // 処理開始
      setIsExporting(true)
      setShowProgressModal(true)
      setExportProgress(0)
      setExportStatus("processing")
      setCurrentStep("データを取得中...")
      setEmbeddedPagesCount(0)
      setTotalPagesCount(0)
      setCanvasRenderingComplete(false)
      savePathResultRef.current = null
      isExportCancelledRef.current = false

      const selectedExamStudentIds = Array.from(selectedStudents)

      // 1. データ取得
      const pdfExportData = await fetchPdfExportData({
        examId: exam.id,
        selectedExamStudentIds,
      })

      if (pdfExportData.pages.length === 0) {
        throw new Error("出力対象のページがありません")
      }

      setTotalPagesCount(pdfExportData.pages.length)
      setExportProgress(5)

      // 2. ストリーミングセッション作成（空ページを事前に作成）
      setCurrentStep("PDFセッションを作成中...")
      streamingSessionIdRef.current = await createPdfStreamingSession({
        totalPages: pdfExportData.pages.length,
        pdfOrientation: exportOptions.pdfOrientation,
      })

      // 3. 保存先選択を並行で開始
      setCurrentStep("保存先を選択してください...")
      const savePathPromise = selectPdfSavePath({
        examName: exam?.examName,
      })
      savePathPromiseRef.current = savePathPromise

      // キャンセル監視：Canvas描画完了前にキャンセルされたら即座に中断
      savePathPromise.then((result) => {
        if (result.canceled) {
          // キャンセルフラグを立てる
          isExportCancelledRef.current = true
          // キャンセルされた場合、Canvas描画中なら中断
          setStartCanvasRendering(false)
          setPdfExportPages([])
          setShowProgressModal(false)
          setIsExporting(false)
          setEmbeddedPagesCount(0)
          setTotalPagesCount(0)
          setCanvasRenderingComplete(false)
          savePathPromiseRef.current = null
          savePathResultRef.current = null
          // セッションのクリーンアップ
          if (streamingSessionIdRef.current) {
            cancelStreamingSession(streamingSessionIdRef.current)
            streamingSessionIdRef.current = null
          }
        }
      })

      // 4. Canvas描画を開始（onPageCompleteでPDFに逐次埋め込み）
      setPdfExportPages(pdfExportData.pages)
      pdfExportPagesRef.current = pdfExportData.pages
      setStartCanvasRendering(true)

      // handlePageComplete と handleCanvasComplete がストリーミング処理を実行
    } catch (error) {
      console.error("Export error:", error)
      setExportStatus("error")
      setCurrentStep(
        `エラー: ${error instanceof Error ? error.message : "不明なエラー"}`
      )
      setIsExporting(false)
      setStartCanvasRendering(false)
      setPdfExportPages([])
      setEmbeddedPagesCount(0)
      setTotalPagesCount(0)
      setCanvasRenderingComplete(false)
      savePathPromiseRef.current = null
      savePathResultRef.current = null
      // セッションのクリーンアップ
      if (streamingSessionIdRef.current) {
        cancelStreamingSession(streamingSessionIdRef.current)
        streamingSessionIdRef.current = null
      }
    }
  }

  /**
   * Canvas描画進捗コールバック（並列処理対応）
   */
  const handleCanvasProgress = useCallback(
    (progress: RenderProgress) => {
      if (progress.phase === "preload") {
        setExportProgress(5)
        setCurrentStep("採点マーク画像を読み込み中...")
      } else if (progress.phase === "rendering") {
        // 10-90%をCanvas描画+PDF埋め込みに割り当て
        // Canvas描画進捗とPDF埋め込み進捗を合成
        const canvasWeight = 0.7 // Canvas描画に70%
        const embedWeight = 0.3 // PDF埋め込みに30%
        const canvasProgress = progress.completed / progress.total
        const embedProgress = embeddedPagesCount / (totalPagesCount || 1)
        const combinedProgress =
          10 +
          Math.round(
            (canvasProgress * canvasWeight + embedProgress * embedWeight) * 80
          )
        setExportProgress(combinedProgress)
        const parallelStr =
          progress.inProgress > 0 ? ` (${progress.inProgress}並列)` : ""
        setCurrentStep(
          `Canvas: ${progress.completed}/${progress.total}ページ${parallelStr} | PDF: ${embeddedPagesCount}/${totalPagesCount}ページ埋め込み済み`
        )
      } else if (progress.phase === "complete") {
        setExportProgress(90)
        setCurrentStep("Canvas描画完了、PDF保存中...")
      }
    },
    [setExportProgress, setCurrentStep, embeddedPagesCount, totalPagesCount]
  )

  /**
   * 1ページ完了時のコールバック（ストリーミング埋め込み）
   */
  /**
   * 書き出しを中止して、後始末を全部やる。
   *
   * **`setIsExporting(false)` を必ず通す。** これを戻し損ねると、以後どの書き出しも
   * `runValidatedExport` が黙って return する（アプリを再起動するまで PDF を出せない）。
   * main 側の pdf-lib セッションも解放する — 放っておくとページのバッファが残り続ける。
   */
  const abortExport = useCallback(
    (reason: string) => {
      isExportCancelledRef.current = true
      setStartCanvasRendering(false)
      setPdfExportPages([])
      setExportStatus("error")
      setCurrentStep(reason)
      setEmbeddedPagesCount(0)
      setTotalPagesCount(0)
      setCanvasRenderingComplete(false)
      savePathPromiseRef.current = null
      savePathResultRef.current = null
      if (streamingSessionIdRef.current) {
        cancelStreamingSession(streamingSessionIdRef.current)
        streamingSessionIdRef.current = null
      }
      setIsExporting(false)
    },
    [setExportStatus, setCurrentStep, setIsExporting]
  )

  const handlePageComplete = useCallback(
    async (pageData: RenderedPageData) => {
      // キャンセル済みなら何もしない
      if (isExportCancelledRef.current) {
        return
      }

      if (!streamingSessionIdRef.current) {
        // 素通りするとカウンタが進まず、完了を待つ関門が開かない
        abortExport(
          "PDF セッションが失われました。ファイルは作成していません。もう一度お試しください。"
        )
        return
      }

      try {
        await addPageToStreamingSession({
          sessionId: streamingSessionIdRef.current,
          pageIndex: pageData.pageIndex,
          imageData: pageData.imageData,
        })
        setEmbeddedPagesCount((prev) => prev + 1)
      } catch (error) {
        // **1ページでも入らなければ中止する。** 握り潰すとカウンタが進まず、完了を
        // 待つ関門が永久に開かない（進捗が「41/42」で固まり、isExporting も戻らない
        // ので以後どの書き出しも黙って何もしなくなる）。答案の PDF は印刷して生徒へ
        // 返すものなので、ページが欠けたまま成功と見えるほうが害が大きい。
        const detail = error instanceof Error ? error.message : String(error)
        // 利用者が答案を特定できる言い方にする（ページ番号だけでは探せない）
        const page = pdfExportPagesRef.current.find(
          (candidate) =>
            candidate.examStudentId === pageData.examStudentId &&
            candidate.pageNumber === pageData.pageNumber
        )
        const where = page
          ? `${page.studentName} さんの ${page.pageNumber} ページ目`
          : `${pageData.pageIndex + 1} ページ目`
        abortExport(
          `${where}を PDF へ入れられませんでした（${detail}）。` +
            `ファイルは作成していません。`
        )
      }
    },
    [abortExport]
  )

  /**
   * Canvas描画完了コールバック
   * 保存先選択を待ち、埋め込み完了フラグを立てる
   */
  const handleCanvasComplete = useCallback(
    async (
      _renderedPages: Array<{
        examStudentId: string
        pageNumber: number
        imageData: ArrayBuffer
      }>
    ) => {
      // キャンセル済みなら何もしない
      if (isExportCancelledRef.current) {
        return
      }

      setStartCanvasRendering(false)
      setPdfExportPages([])

      // ストリーミングセッションがない場合はエラー
      if (!streamingSessionIdRef.current) {
        setExportStatus("error")
        setCurrentStep("PDFセッションが見つかりません")
        setIsExporting(false)
        savePathPromiseRef.current = null
        return
      }

      // 保存先選択の完了を待つ
      if (!savePathPromiseRef.current) {
        setExportStatus("error")
        setCurrentStep("保存先選択が開始されていません")
        setIsExporting(false)
        // セッションのクリーンアップ
        cancelStreamingSession(streamingSessionIdRef.current)
        streamingSessionIdRef.current = null
        return
      }

      setCurrentStep("保存先の選択を待っています...")
      const savePathResult = await savePathPromiseRef.current
      savePathPromiseRef.current = null

      if (savePathResult.canceled) {
        // キャンセルされた場合 - 全状態をリセット
        setShowProgressModal(false)
        setIsExporting(false)
        setEmbeddedPagesCount(0)
        setTotalPagesCount(0)
        setCanvasRenderingComplete(false)
        savePathResultRef.current = null
        // セッションのクリーンアップ
        cancelStreamingSession(streamingSessionIdRef.current)
        streamingSessionIdRef.current = null
        return
      }

      // 保存先を保持し、Canvas描画完了フラグを立てる
      // PDF埋め込み完了を待ってからuseEffectでPDF保存を実行
      savePathResultRef.current = { filePath: savePathResult.filePath }
      setCanvasRenderingComplete(true)
    },
    [setExportStatus, setCurrentStep, setIsExporting, setShowProgressModal]
  )

  /**
   * Canvas描画エラーコールバック
   */
  const handleCanvasError = useCallback(
    (error: Error) => {
      abortExport(
        `答案の描画に失敗しました（${error.message}）。ファイルは作成していません。`
      )
    },
    [abortExport]
  )

  /**
   * Canvas描画完了 + PDF埋め込み完了時にPDF保存を実行
   */
  useEffect(() => {
    const finalizePdf = async () => {
      if (!canvasRenderingComplete) return
      if (embeddedPagesCount < totalPagesCount) return
      if (!streamingSessionIdRef.current) return
      if (!savePathResultRef.current) return

      try {
        setExportProgress(95)
        setCurrentStep("PDFを保存中...")

        await finalizeStreamingSession({
          sessionId: streamingSessionIdRef.current,
          outputPath: savePathResultRef.current.filePath,
        })

        streamingSessionIdRef.current = null
        savePathResultRef.current = null
        setCanvasRenderingComplete(false)

        setExportProgress(100)
        setExportStatus("completed")
        setCurrentStep("完了しました")
        onExportCompleted?.()
      } catch (error) {
        console.error("PDF finalization error:", error)
        setExportStatus("error")
        setCurrentStep("PDF保存中にエラーが発生しました")
        if (streamingSessionIdRef.current) {
          cancelStreamingSession(streamingSessionIdRef.current)
          streamingSessionIdRef.current = null
        }
      } finally {
        setIsExporting(false)
      }
    }

    finalizePdf()
  }, [
    canvasRenderingComplete,
    embeddedPagesCount,
    totalPagesCount,
    setExportProgress,
    setCurrentStep,
    setExportStatus,
    onExportCompleted,
    setIsExporting,
  ])

  return {
    executeExportScoredAnswers,
    // PdfCanvasRenderer 用
    pdfExportPages,
    startCanvasRendering,
    handleCanvasProgress,
    handlePageComplete,
    handleCanvasComplete,
    handleCanvasError,
    // ExportProgressModal 用
    embeddedPagesCount,
    totalPagesCount,
    canvasRenderingComplete,
  }
}
