"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import type {
  RenderedPageData,
  RenderProgress,
} from "@/app/exams/[examId]/08-export/types"
import LoadingSpinner from "@/components/common/LoadingSpinner"
import {
  ExportOptionsCard,
  type ExportTabType,
} from "@/components/exams/08-export/components/ExportOptionsCard"
import ExportProgressModal from "@/components/exams/08-export/components/ExportProgressModal"
import ExportWarningModal from "@/components/exams/08-export/components/ExportWarningModal"
import { generatePrintHtml } from "@/components/exams/08-export/components/individual-report/generatePrintHtml"
import {
  PdfCanvasRenderer,
  type PdfExportPageData,
} from "@/components/exams/08-export/components/PdfCanvasRenderer"
import { ReturnDiffPanel } from "@/components/exams/08-export/components/ReturnDiffPanel"
import { StudentSelectionCard } from "@/components/exams/08-export/components/StudentSelectionCard"
import { useExcelPreview } from "@/components/exams/08-export/hooks/useExcelPreview"
import { useExportPage } from "@/components/exams/08-export/hooks/useExportPage"
import { useIndividualReportPreview } from "@/components/exams/08-export/hooks/useIndividualReportPreview"
import { useScoredAnswerPreview } from "@/components/exams/08-export/hooks/useScoredAnswerPreview"
import { loadStudentExportPlacements } from "@/components/exams/08-export/utils/loadStudentExportPlacements"
import type { ScoringMarkConfigForPdf } from "@/components/exams/08-export/utils/pdfCanvasRenderer"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"

export default function ExportMainView() {
  const { helpButton } = usePageHelp()
  const [exportTab, setExportTab] = useState<ExportTabType>("scored-answers")
  const [showWarningModal, setShowWarningModal] = useState(false)
  const [warningData, setWarningData] = useState({
    noScoringData: [] as string[],
    unscored: [] as string[],
    missingPartialScore: [] as string[],
    conflicted: [] as string[],
  })
  const [pendingExportType, setPendingExportType] = useState<
    "scored-answers" | "grading-data" | "individual-reports" | null
  >(null)

  // Canvas描画用の状態
  const [pdfExportPages, setPdfExportPages] = useState<PdfExportPageData[]>([])
  const [startCanvasRendering, setStartCanvasRendering] = useState(false)

  // 保存先選択のPromiseを保持（並行処理用）
  const savePathPromiseRef = useRef<Promise<{
    success: boolean
    filePath?: string
    canceled?: boolean
  }> | null>(null)

  // ストリーミングセッション用の状態
  const streamingSessionIdRef = useRef<string | null>(null)
  const [embeddedPagesCount, setEmbeddedPagesCount] = useState(0)
  const [totalPagesCount, setTotalPagesCount] = useState(0)
  const [canvasRenderingComplete, setCanvasRenderingComplete] = useState(false)
  const savePathResultRef = useRef<{ filePath: string } | null>(null)
  const isExportCancelledRef = useRef(false)

  const {
    exam,
    students,
    availableClassrooms,
    loading,
    searchTerm,
    setSearchTerm,
    selectedClassrooms,
    setSelectedClassrooms,
    selectedStatuses,
    setSelectedStatuses,
    selectedStudents,
    replaceSelection,
    toggleStudent,
    addStudents,
    removeStudents,
    exportOptions,
    setExportOptions,
    scoringMarkConfig,
    setScoringMarkConfig,
    individualReportOptions,
    setIndividualReportOptions,
    showProgressModal,
    setShowProgressModal,
    exportProgress,
    setExportProgress,
    exportStatus,
    setExportStatus,
    currentStep,
    setCurrentStep,
    isExporting,
    setIsExporting,
  } = useExportPage()

  // プレビュー用のデータ取得
  const selectedStudentIds = useMemo(
    () => Array.from(selectedStudents),
    [selectedStudents]
  )

  const {
    previewData,
    isLoading: isPreviewLoading,
    error: previewError,
    previewStudentId,
    setPreviewStudentId,
  } = useIndividualReportPreview({
    examId: exam?.id || "",
    selectedStudentIds,
    options: individualReportOptions,
    enabled: !!exam?.id && selectedStudents.size > 0,
  })

  // Excelプレビュー
  const {
    previewData: excelPreviewData,
    isLoading: isExcelPreviewLoading,
    error: excelPreviewError,
  } = useExcelPreview({
    examId: exam?.id || "",
    selectedStudentIds,
    enabled:
      !!exam?.id && selectedStudents.size > 0 && exportTab === "grading-data",
  })

  // プレビュー用の生徒リスト
  const previewStudentList = useMemo(() => {
    return students
      .filter((examStudent) => selectedStudents.has(examStudent.studentId))
      .map((examStudent) => ({
        id: examStudent.studentId,
        name: `${examStudent.student.lastName} ${examStudent.student.firstName}`,
      }))
  }, [students, selectedStudents])

  /**
   * scoringMarkConfigをScoringMarkConfigForPdf形式に変換
   */
  const getScoringMarkConfigForPdf =
    useCallback((): ScoringMarkConfigForPdf => {
      // 部分点設定を取得（partialScoreが存在する場合はそれを使用、なければ旧式設定からフォールバック）
      const partialScore = scoringMarkConfig.partialScore
      const partialScoreConfig =
        partialScore && partialScore.size !== undefined
          ? partialScore
          : {
              position: scoringMarkConfig.scorePosition || "middle-center",
              size: scoringMarkConfig.scoreSize || 14,
              offsetX: scoringMarkConfig.scoreOffsetX || 0,
              offsetY: scoringMarkConfig.scoreOffsetY || 0,
              color: "#ef4444",
              opacity: 100,
            }

      // 小計点設定を取得（subtotalScore → summaryScore → デフォルトの順でフォールバック）
      const subtotalScoreConfig = scoringMarkConfig.subtotalScore ??
        scoringMarkConfig.summaryScore ?? {
          position: "middle-center",
          size: 18,
          offsetX: 0,
          offsetY: 0,
          color: "#2563eb",
          opacity: 100,
        }

      // 合計点設定を取得（totalScore → summaryScore → デフォルトの順でフォールバック）
      const totalScoreConfig = scoringMarkConfig.totalScore ??
        scoringMarkConfig.summaryScore ?? {
          position: "middle-center",
          size: 18,
          offsetX: 0,
          offsetY: 0,
          color: "#2563eb",
          opacity: 100,
        }

      return {
        markPosition: scoringMarkConfig.markPosition,
        markSize: scoringMarkConfig.markSize,
        markColor: scoringMarkConfig.markColor ?? "#ef4444",
        markOpacity: scoringMarkConfig.markOpacity ?? 100,
        showPartialScore: true,
        partialScorePosition: partialScoreConfig.position || "middle-center",
        partialScoreSize: partialScoreConfig.size || 14,
        partialScoreOffsetX: partialScoreConfig.offsetX || 0,
        partialScoreOffsetY: partialScoreConfig.offsetY || 0,
        partialScoreColor: partialScoreConfig.color ?? "#ef4444",
        partialScoreOpacity: partialScoreConfig.opacity ?? 100,
        // 小計点用設定
        subtotalScorePosition: subtotalScoreConfig.position || "middle-center",
        subtotalScoreSize: subtotalScoreConfig.size || 18,
        subtotalScoreOffsetX: subtotalScoreConfig.offsetX || 0,
        subtotalScoreOffsetY: subtotalScoreConfig.offsetY || 0,
        subtotalScoreColor: subtotalScoreConfig.color ?? "#2563eb",
        subtotalScoreOpacity: subtotalScoreConfig.opacity ?? 100,
        // 合計点用設定
        totalScorePosition: totalScoreConfig.position || "middle-center",
        totalScoreSize: totalScoreConfig.size || 18,
        totalScoreOffsetX: totalScoreConfig.offsetX || 0,
        totalScoreOffsetY: totalScoreConfig.offsetY || 0,
        totalScoreColor: totalScoreConfig.color ?? "#2563eb",
        totalScoreOpacity: totalScoreConfig.opacity ?? 100,
        // ステータスごとの表示設定
        showMarkForStatus: scoringMarkConfig.showMarkForStatus,
        showScoreForStatus: scoringMarkConfig.showScoreForStatus,
      }
    }, [scoringMarkConfig])

  // プレビュー用にmemoized configを用意（毎レンダーで新オブジェクト生成→無限ループ防止）
  const scoringMarkConfigForPdf = useMemo(
    () => getScoringMarkConfigForPdf(),
    [getScoringMarkConfigForPdf]
  )

  // 採点済み答案プレビュー（getScoringMarkConfigForPdfの後に配置）
  const {
    previewImageUrls: scoredAnswerPreviewUrls,
    isLoading: isScoredAnswerPreviewLoading,
    error: scoredAnswerPreviewError,
    previewStudentId: scoredAnswerPreviewStudentId,
    setPreviewStudentId: setScoredAnswerPreviewStudentId,
  } = useScoredAnswerPreview({
    examId: exam?.id || "",
    selectedStudentIds,
    scoringMarkConfig: scoringMarkConfigForPdf,
    enabled:
      !!exam?.id && selectedStudents.size > 0 && exportTab === "scored-answers",
  })

  /**
   * Canvas描画ベースのPDF出力（ストリーミング処理フロー）
   * 1. データ取得 → 2. ストリーミングセッション作成 & 保存先選択 → 3. Canvas描画（完了次第PDF埋め込み） → 4. PDF保存
   */
  /**
   * 採点データバリデーションを実行し、警告があればモーダルを表示する
   * @returns true: バリデーション通過（警告なし）、false: 警告あり（モーダル表示）
   */
  const validateBeforeExport = async (
    exportType: "scored-answers" | "grading-data" | "individual-reports"
  ): Promise<boolean> => {
    if (!exam) return false
    const selectedStudentIds = Array.from(selectedStudents)
    const result = await window.electronAPI.export.validateScoringData({
      examId: exam.id,
      selectedStudentIds,
    })

    if (!result.success) {
      throw new Error(result.error || "バリデーションに失敗しました")
    }

    if (result.hasWarnings && result.warnings) {
      setWarningData({
        noScoringData: result.warnings.noScoringData,
        unscored: result.warnings.ungraded,
        missingPartialScore: result.warnings.missingPartialScore,
        conflicted: result.warnings.conflicted ?? [],
      })
      setPendingExportType(exportType)
      setShowWarningModal(true)
      return false
    }

    return true
  }

  const handleExportScoredAnswers = async () => {
    if (selectedStudents.size === 0) {
      alert("出力する生徒を選択してください")
      return
    }

    if (isExporting) {
      return
    }

    try {
      // バリデーション実行
      const isValid = await validateBeforeExport("scored-answers")
      if (!isValid) return

      await executeExportScoredAnswers()
    } catch (error) {
      console.error("Export error:", error)
      alert(
        `エラー: ${error instanceof Error ? error.message : "不明なエラー"}`
      )
    }
  }

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

      const selectedStudentIds = Array.from(selectedStudents)

      // 1. データ取得
      const dataResult = await window.electronAPI.export.getPdfExportData({
        examId: exam.id,
        selectedStudentIds,
      })

      if (!dataResult.success || !dataResult.pages) {
        throw new Error(dataResult.error || "データ取得に失敗しました")
      }

      if (dataResult.pages.length === 0) {
        throw new Error("出力対象のページがありません")
      }

      setTotalPagesCount(dataResult.pages.length)
      setExportProgress(5)

      // 2. ストリーミングセッション作成（空ページを事前に作成）
      setCurrentStep("PDFセッションを作成中...")
      const sessionResult =
        await window.electronAPI.export.createPdfStreamingSession({
          totalPages: dataResult.pages.length,
          pdfOrientation: exportOptions.pdfOrientation,
        })

      if (!sessionResult.success || !sessionResult.sessionId) {
        throw new Error(
          sessionResult.error || "PDFセッションの作成に失敗しました"
        )
      }

      streamingSessionIdRef.current = sessionResult.sessionId

      // 3. 保存先選択を並行で開始
      setCurrentStep("保存先を選択してください...")
      const savePathPromise = window.electronAPI.export.selectPdfSavePath({
        examName: exam?.examName,
      })
      savePathPromiseRef.current = savePathPromise

      // キャンセル監視：Canvas描画完了前にキャンセルされたら即座に中断
      savePathPromise.then((result) => {
        if (!result.success || result.canceled || !result.filePath) {
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
            window.electronAPI.export.cancelStreamingSession(
              streamingSessionIdRef.current
            )
            streamingSessionIdRef.current = null
          }
        }
      })

      // 4. Canvas描画を開始（onPageCompleteでPDFに逐次埋め込み）
      setPdfExportPages(dataResult.pages)
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
        window.electronAPI.export.cancelStreamingSession(
          streamingSessionIdRef.current
        )
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
  const handlePageComplete = useCallback(async (pageData: RenderedPageData) => {
    // キャンセル済みなら何もしない
    if (isExportCancelledRef.current) {
      return
    }

    if (!streamingSessionIdRef.current) {
      console.error("Streaming session not found")
      return
    }

    try {
      const result = await window.electronAPI.export.addPageToStreamingSession({
        sessionId: streamingSessionIdRef.current,
        pageIndex: pageData.pageIndex,
        imageData: pageData.imageData,
      })

      if (result.success) {
        setEmbeddedPagesCount((prev) => prev + 1)
      } else {
        console.error(
          `Failed to embed page ${pageData.pageIndex}:`,
          result.error
        )
      }
    } catch (error) {
      console.error(`Error embedding page ${pageData.pageIndex}:`, error)
    }
  }, [])

  /**
   * Canvas描画完了コールバック
   * 保存先選択を待ち、埋め込み完了フラグを立てる
   */
  const handleCanvasComplete = useCallback(
    async (
      _renderedPages: Array<{
        studentId: string
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
        window.electronAPI.export.cancelStreamingSession(
          streamingSessionIdRef.current
        )
        streamingSessionIdRef.current = null
        return
      }

      setCurrentStep("保存先の選択を待っています...")
      const savePathResult = await savePathPromiseRef.current
      savePathPromiseRef.current = null

      if (
        !savePathResult.success ||
        savePathResult.canceled ||
        !savePathResult.filePath
      ) {
        // キャンセルされた場合 - 全状態をリセット
        setShowProgressModal(false)
        setIsExporting(false)
        setEmbeddedPagesCount(0)
        setTotalPagesCount(0)
        setCanvasRenderingComplete(false)
        savePathResultRef.current = null
        // セッションのクリーンアップ
        window.electronAPI.export.cancelStreamingSession(
          streamingSessionIdRef.current
        )
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
      console.error("Canvas rendering error:", error)
      setStartCanvasRendering(false)
      setPdfExportPages([])
      setExportStatus("error")
      setCurrentStep(`Canvas描画エラー: ${error.message}`)
      setIsExporting(false)
      setEmbeddedPagesCount(0)
      setTotalPagesCount(0)
      setCanvasRenderingComplete(false)
      savePathPromiseRef.current = null
      savePathResultRef.current = null
      // セッションのクリーンアップ
      if (streamingSessionIdRef.current) {
        window.electronAPI.export.cancelStreamingSession(
          streamingSessionIdRef.current
        )
        streamingSessionIdRef.current = null
      }
    },
    [setExportStatus, setCurrentStep, setIsExporting]
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

        const result = await window.electronAPI.export.finalizeStreamingSession(
          {
            sessionId: streamingSessionIdRef.current,
            outputPath: savePathResultRef.current.filePath,
          }
        )

        streamingSessionIdRef.current = null
        savePathResultRef.current = null
        setCanvasRenderingComplete(false)

        if (result.success) {
          setExportProgress(100)
          setExportStatus("completed")
          setCurrentStep("完了しました")
        } else {
          setExportStatus("error")
          setCurrentStep(`エラー: ${result.error}`)
        }
      } catch (error) {
        console.error("PDF finalization error:", error)
        setExportStatus("error")
        setCurrentStep("PDF保存中にエラーが発生しました")
        if (streamingSessionIdRef.current) {
          window.electronAPI.export.cancelStreamingSession(
            streamingSessionIdRef.current
          )
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
    setIsExporting,
  ])

  const handleExportGradingData = async () => {
    if (selectedStudents.size === 0) {
      alert("出力する生徒を選択してください")
      return
    }

    try {
      // バリデーション実行
      const isValid = await validateBeforeExport("grading-data")
      if (!isValid) return

      await executeExportGradingData()
    } catch (error) {
      console.error("Export error:", error)
      alert("出力中にエラーが発生しました")
    }
  }

  const executeExportGradingData = async () => {
    if (!exam) return
    setIsExporting(true)

    try {
      const selectedStudentIds = Array.from(selectedStudents)
      const studentPlacements = await loadStudentExportPlacements(exam.id)

      const result = await window.electronAPI.exportGradingDataExcel({
        examId: exam.id,
        selectedStudentIds,
        forceExport: true,
        studentPlacements,
      })

      if (result.success) {
        alert(
          `採点データExcelの出力が完了しました。\n保存先: ${result.outputPath}`
        )
      } else {
        alert(`出力に失敗しました: ${result.error}`)
      }
    } catch (error) {
      console.error("Export error:", error)
      alert("出力中にエラーが発生しました")
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportRData = async (format: "csv" | "json") => {
    if (!exam) return
    setIsExporting(true)
    try {
      const selectedStudentIds = Array.from(selectedStudents)
      const result = await window.electronAPI.exportRData({
        examId: exam.id,
        selectedStudentIds,
        format,
      })
      if (result.success) {
        toast.success(`分析用データを出力しました: ${result.outputPath}`)
      } else if (result.error !== "出力がキャンセルされました") {
        toast.error(`出力に失敗しました: ${result.error ?? ""}`)
      }
    } catch (error) {
      console.error("R data export error:", error)
      toast.error("出力中にエラーが発生しました")
    } finally {
      setIsExporting(false)
    }
  }

  const handleContinueExport = async () => {
    setShowWarningModal(false)
    const exportType = pendingExportType
    setPendingExportType(null)

    if (exportType === "grading-data") {
      await executeExportGradingData()
    } else if (exportType === "scored-answers") {
      await executeExportScoredAnswers()
    } else if (exportType === "individual-reports") {
      await executeExportIndividualReports()
    }
  }

  const handleExportIndividualReports = async () => {
    if (selectedStudents.size === 0) {
      alert("出力する生徒を選択してください")
      return
    }

    if (isExporting) {
      return
    }

    try {
      // バリデーション実行
      const isValid = await validateBeforeExport("individual-reports")
      if (!isValid) return

      await executeExportIndividualReports()
    } catch (error) {
      console.error("Individual report export error:", error)
      alert(
        `エラー: ${error instanceof Error ? error.message : "不明なエラー"}`
      )
    }
  }

  const executeExportIndividualReports = async () => {
    if (!exam) return
    setIsExporting(true)

    try {
      const selectedStudentIds = Array.from(selectedStudents)
      const studentPlacements = await loadStudentExportPlacements(exam.id)

      // 1. データ取得（統計・アドバイス含む）
      const dataResult =
        await window.electronAPI.export.getIndividualReportData({
          examId: exam.id,
          selectedStudentIds,
          options: individualReportOptions,
          studentPlacements,
        })

      if (!dataResult.success || !dataResult.reports) {
        throw new Error(dataResult.error || "データ取得に失敗しました")
      }

      // 2. HTMLを生成（プレビューと同じ構造）
      const html = generatePrintHtml(
        dataResult.reports,
        individualReportOptions
      )

      // 3. 印刷ダイアログを開く
      const result = await window.electronAPI.export.openPrintDialog({
        html,
        title: `個人成績表 - ${exam?.examName || ""}`,
      })

      if (!result.success) {
        throw new Error(result.error || "印刷ダイアログを開けませんでした")
      }
    } catch (error) {
      console.error("Individual report export error:", error)
      alert(
        `エラー: ${error instanceof Error ? error.message : "不明なエラー"}`
      )
    } finally {
      setIsExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="採点結果のファイル出力" helpButton={helpButton} />

      <div className="container mx-auto flex min-h-0 flex-1 flex-col gap-6 px-4 py-6">
        <ReturnDiffPanel
          examId={exam?.id ?? ""}
          students={students}
          selectedStudentIds={selectedStudentIds}
          onSelectStudentIds={replaceSelection}
        />

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-full min-h-0">
            <StudentSelectionCard
              examId={exam?.id}
              students={students} // 受験生徒順（customOrder）でソート済み
              availableClassrooms={availableClassrooms}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              selectedClassrooms={selectedClassrooms}
              setSelectedClassrooms={setSelectedClassrooms}
              selectedStatuses={selectedStatuses}
              setSelectedStatuses={setSelectedStatuses}
              selectedStudents={selectedStudents}
              toggleStudent={toggleStudent}
              addStudents={addStudents}
              removeStudents={removeStudents}
              // プレビュー関連
              exportTab={exportTab}
              previewData={previewData}
              isPreviewLoading={isPreviewLoading}
              previewError={previewError}
              previewStudentId={previewStudentId ?? undefined}
              onPreviewStudentChange={setPreviewStudentId}
              previewStudentList={previewStudentList}
              individualReportOptions={individualReportOptions}
              // 採点済み答案プレビュー
              scoredAnswerPreviewUrls={scoredAnswerPreviewUrls}
              isScoredAnswerPreviewLoading={isScoredAnswerPreviewLoading}
              scoredAnswerPreviewError={scoredAnswerPreviewError}
              scoredAnswerPreviewStudentId={scoredAnswerPreviewStudentId}
              onScoredAnswerPreviewStudentChange={
                setScoredAnswerPreviewStudentId
              }
              // Excelプレビュー
              excelPreviewData={excelPreviewData}
              isExcelPreviewLoading={isExcelPreviewLoading}
              excelPreviewError={excelPreviewError}
            />
          </div>

          <div className="h-full min-h-0">
            <ExportOptionsCard
              examId={exam?.id ?? ""}
              exportOptions={exportOptions}
              setExportOptions={setExportOptions}
              scoringMarkConfig={scoringMarkConfig}
              setScoringMarkConfig={setScoringMarkConfig}
              individualReportOptions={individualReportOptions}
              setIndividualReportOptions={setIndividualReportOptions}
              selectedStudents={selectedStudents}
              isExporting={isExporting}
              onExportScoredAnswers={handleExportScoredAnswers}
              onExportGradingData={handleExportGradingData}
              onExportRData={handleExportRData}
              onExportIndividualReports={handleExportIndividualReports}
              activeTab={exportTab}
              onTabChange={setExportTab}
            />
          </div>
        </div>

        {/* プログレスモーダル */}
        <ExportProgressModal
          isOpen={showProgressModal}
          onClose={() => setShowProgressModal(false)}
          progress={exportProgress}
          status={exportStatus}
          currentStep={currentStep}
          embeddedPagesCount={embeddedPagesCount}
          totalPagesCount={totalPagesCount}
          canvasRenderingComplete={canvasRenderingComplete}
        />

        {/* 警告モーダル */}
        <ExportWarningModal
          isOpen={showWarningModal}
          onClose={() => setShowWarningModal(false)}
          onContinue={handleContinueExport}
          warnings={warningData}
        />

        {/* Canvas描画コンポーネント（非表示） */}
        <PdfCanvasRenderer
          pages={pdfExportPages}
          scoringMarkConfig={getScoringMarkConfigForPdf()}
          startRendering={startCanvasRendering}
          poolSize={exportOptions.parallelCount}
          onProgress={handleCanvasProgress}
          onPageComplete={handlePageComplete}
          onComplete={handleCanvasComplete}
          onError={handleCanvasError}
        />
      </div>
    </div>
  )
}
