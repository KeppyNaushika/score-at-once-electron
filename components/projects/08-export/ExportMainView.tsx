"use client"

import LoadingSpinner from "@/components/common/LoadingSpinner"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import { ExportOptionsCard } from "@/components/projects/08-export/components/ExportOptionsCard"
import ExportProgressModal from "@/components/projects/08-export/components/ExportProgressModal"
import ExportWarningModal from "@/components/projects/08-export/components/ExportWarningModal"
import {
  PdfCanvasRenderer,
  type PdfExportPageData,
} from "@/components/projects/08-export/components/PdfCanvasRenderer"
import { StudentSelectionCard } from "@/components/projects/08-export/components/StudentSelectionCard"
import { useExportPage } from "@/components/projects/08-export/hooks/useExportPage"
import type { ScoringMarkConfigForPdf } from "@/components/projects/08-export/utils/pdf-canvas-renderer"
import { useCallback, useRef, useState } from "react"

export default function ExportMainView() {
  const { helpButton } = usePageHelp()
  const [showWarningModal, setShowWarningModal] = useState(false)
  const [warningData, setWarningData] = useState({
    noScoringData: [] as string[],
    unscored: [] as string[],
    missingPartialScore: [] as string[],
  })

  // Canvas描画用の状態
  const [pdfExportPages, setPdfExportPages] = useState<PdfExportPageData[]>([])
  const [startCanvasRendering, setStartCanvasRendering] = useState(false)
  const [pdfOutputPath, setPdfOutputPath] = useState<string>("")

  // 並行処理用のref（保存先選択とCanvas描画の同期用）
  const savePathResolverRef = useRef<((path: string | null) => void) | null>(null)
  const pdfOutputPathRef = useRef<string>("") // 保存先パス（即座に反映用）
  const renderedPagesRef = useRef<Array<{
    studentId: string
    pageNumber: number
    imageData: ArrayBuffer
  }> | null>(null)
  const isWaitingForSavePathRef = useRef(false)

  const {
    project,
    students,
    availableClasses,
    loading,
    searchTerm,
    setSearchTerm,
    selectedClasses,
    setSelectedClasses,
    selectedStatuses,
    setSelectedStatuses,
    selectedStudents,
    setSelectedStudents,
    exportOptions,
    setExportOptions,
    scoringMarkConfig,
    setScoringMarkConfig,
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

  /**
   * scoringMarkConfigをScoringMarkConfigForPdf形式に変換
   */
  const getScoringMarkConfigForPdf = useCallback((): ScoringMarkConfigForPdf => {
    return {
      markPosition: scoringMarkConfig.markPosition,
      markSize: scoringMarkConfig.markSize,
      useTransparent: scoringMarkConfig.useTransparent,
      showPartialScore: true, // 部分点を表示
      partialScorePosition: scoringMarkConfig.scorePosition || "bottom-right",
      partialScoreSize: scoringMarkConfig.scoreSize || 14,
      partialScoreOffsetX: scoringMarkConfig.scoreOffsetX || 0,
      partialScoreOffsetY: scoringMarkConfig.scoreOffsetY || 0,
    }
  }, [scoringMarkConfig])

  /**
   * Canvas描画ベースのPDF出力（並行処理フロー）
   * 保存先選択とデータ取得→Canvas描画を完全並行処理で実行
   */
  const handleExportScoredAnswers = async () => {
    if (selectedStudents.size === 0) {
      alert("出力する生徒を選択してください")
      return
    }

    try {
      // 状態リセット
      renderedPagesRef.current = null
      isWaitingForSavePathRef.current = false
      pdfOutputPathRef.current = ""

      // 処理開始
      setIsExporting(true)
      setShowProgressModal(true)
      setExportProgress(0)
      setExportStatus("processing")
      setCurrentStep("保存先を選択してください（バックグラウンドで処理中...）")

      const selectedStudentIds = Array.from(selectedStudents)

      // 保存先選択のPromiseを作成（Canvas描画完了時に解決を待つ）
      const savePathPromise = new Promise<string | null>((resolve) => {
        savePathResolverRef.current = resolve
      })

      // 並行処理開始: 保存先選択とデータ取得を同時に開始
      const savePathTask = (async () => {
        const result = await window.electronAPI.export.selectPdfSavePath({
          projectName: project?.examName,
        })
        const path = result.canceled || !result.filePath ? null : result.filePath
        // 保存先が決まったらrefに即座に反映
        if (path) {
          pdfOutputPathRef.current = path
        }
        // resolverを呼び出す（Canvas描画完了待ちの場合に通知）
        if (savePathResolverRef.current) {
          savePathResolverRef.current(path)
        }
        return path
      })()

      const dataTask = (async () => {
        const dataResult = await window.electronAPI.export.getPdfExportData({
          projectId: project.id,
          selectedStudentIds,
        })

        // データ取得エラーチェック
        if (!dataResult.success || !dataResult.pages) {
          throw new Error(dataResult.error || "データ取得に失敗しました")
        }

        if (dataResult.pages.length === 0) {
          throw new Error("出力対象のページがありません")
        }

        // Canvas描画を開始（保存先の決定を待たずに）
        setExportProgress(5)
        setCurrentStep("保存先を選択してください（Canvas描画を開始...）")
        setPdfExportPages(dataResult.pages)
        setStartCanvasRendering(true)

        return dataResult.pages
      })()

      // 保存先選択の結果を待つ（Canvas描画は並行して進行中）
      const savePath = await savePathTask

      // 保存先のキャンセルチェック
      if (!savePath) {
        // ユーザーがキャンセルした場合は中止
        setStartCanvasRendering(false)
        setPdfExportPages([])
        setShowProgressModal(false)
        setIsExporting(false)
        return
      }

      setPdfOutputPath(savePath)

      // データ取得タスクの完了を待つ（Canvas描画が開始されていることを確認）
      await dataTask

    } catch (error) {
      console.error("Export error:", error)
      setExportStatus("error")
      setCurrentStep(`出力中にエラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`)
      setIsExporting(false)
      setStartCanvasRendering(false)
      setPdfExportPages([])
    }
  }

  /**
   * Canvas描画進捗コールバック
   */
  const handleCanvasProgress = useCallback(
    (current: number, total: number, step: string) => {
      // 10-80%をCanvas描画に割り当て（0-10%はデータ取得）
      const canvasProgress = 10 + Math.round((current / total) * 70)
      setExportProgress(canvasProgress)
      setCurrentStep(`Canvas描画中: ${current} / ${total} ページ`)
    },
    [setExportProgress, setCurrentStep]
  )

  /**
   * PDF生成・保存処理（Canvas描画完了後に呼び出し）
   */
  const createAndSavePdf = useCallback(
    async (
      renderedPages: Array<{
        studentId: string
        pageNumber: number
        imageData: ArrayBuffer
      }>,
      outputPath: string
    ) => {
      try {
        setExportProgress(85)
        setCurrentStep("PDFを作成中...")

        const result = await window.electronAPI.export.createPdfFromRenderedImages({
          projectId: project.id,
          renderedPages,
          pdfOrientation: exportOptions.pdfOrientation,
          outputPath,
        })

        if (result.success) {
          setExportProgress(100)
          setExportStatus("completed")
          setCurrentStep("完了しました")
        } else {
          setExportStatus("error")
          setCurrentStep(`エラー: ${result.error}`)
        }
      } catch (error) {
        console.error("PDF creation error:", error)
        setExportStatus("error")
        setCurrentStep("PDF作成中にエラーが発生しました")
      } finally {
        setIsExporting(false)
      }
    },
    [project?.id, exportOptions.pdfOrientation, setExportProgress, setCurrentStep, setExportStatus, setIsExporting]
  )

  /**
   * Canvas描画完了コールバック
   * 保存先が決まっていれば即座にPDF生成、まだなら待機
   */
  const handleCanvasComplete = useCallback(
    async (
      renderedPages: Array<{
        studentId: string
        pageNumber: number
        imageData: ArrayBuffer
      }>
    ) => {
      setStartCanvasRendering(false)
      setPdfExportPages([])

      if (renderedPages.length === 0) {
        setExportStatus("error")
        setCurrentStep("描画されたページがありません")
        setIsExporting(false)
        return
      }

      // 保存先が既に決まっているかチェック（Refで即座に確認）
      if (pdfOutputPathRef.current) {
        // 保存先が決まっている → 即座にPDF生成
        await createAndSavePdf(renderedPages, pdfOutputPathRef.current)
      } else {
        // 保存先がまだ決まっていない → 結果を保存して待機
        renderedPagesRef.current = renderedPages
        isWaitingForSavePathRef.current = true
        setCurrentStep("保存先の選択を待っています...")

        // 保存先が決まるまで待機
        const savePath = await new Promise<string | null>((resolve) => {
          // 既にresolverが設定されている場合はそれを使う
          const existingResolver = savePathResolverRef.current
          savePathResolverRef.current = (path) => {
            if (existingResolver) existingResolver(path)
            resolve(path)
          }
        })

        isWaitingForSavePathRef.current = false

        if (!savePath) {
          // キャンセルされた場合
          setShowProgressModal(false)
          setIsExporting(false)
          return
        }

        await createAndSavePdf(renderedPages, savePath)
      }
    },
    [createAndSavePdf, setExportStatus, setCurrentStep, setIsExporting, setShowProgressModal]
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
    },
    [setExportStatus, setCurrentStep, setIsExporting]
  )

  const handleExportGradingData = async () => {
    if (selectedStudents.size === 0) {
      alert("出力する生徒を選択してください")
      return
    }

    setIsExporting(true)

    try {
      const selectedStudentIds = Array.from(selectedStudents)

      const result = await window.electronAPI.exportGradingDataExcel({
        projectId: project.id,
        selectedStudentIds,
      })

      if (result.success) {
        alert(
          `採点データExcelの出力が完了しました。\n保存先: ${result.outputPath}`,
        )
      } else if (result.warnings) {
        // 警告がある場合は警告モーダルを表示
        setWarningData(result.warnings)
        setShowWarningModal(true)
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

  const handleContinueExport = async () => {
    setShowWarningModal(false)
    setIsExporting(true)

    try {
      const selectedStudentIds = Array.from(selectedStudents)

      const result = await window.electronAPI.exportGradingDataExcel({
        projectId: project.id,
        selectedStudentIds,
        forceExport: true, // 警告を無視して強制実行
      })

      if (result.success) {
        alert(
          `採点データExcelの出力が完了しました。\n保存先: ${result.outputPath}`,
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

  const handleExportIndividualReports = async () => {
    alert("個人成績表PDF出力機能は現在開発中です。")
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

      <div className="container mx-auto min-h-0 flex-1 px-4 py-6">
        <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-full min-h-0">
            <StudentSelectionCard
              students={students} // 受験生徒順（customOrder）でソート済み
              availableClasses={availableClasses}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              selectedClasses={selectedClasses}
              setSelectedClasses={setSelectedClasses}
              selectedStatuses={selectedStatuses}
              setSelectedStatuses={setSelectedStatuses}
              selectedStudents={selectedStudents}
              setSelectedStudents={setSelectedStudents}
            />
          </div>

          <div className="h-full min-h-0">
            <ExportOptionsCard
              exportOptions={exportOptions}
              setExportOptions={setExportOptions}
              scoringMarkConfig={scoringMarkConfig}
              setScoringMarkConfig={setScoringMarkConfig}
              selectedStudents={selectedStudents}
              isExporting={isExporting}
              onExportScoredAnswers={handleExportScoredAnswers}
              onExportGradingData={handleExportGradingData}
              onExportIndividualReports={handleExportIndividualReports}
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
          onProgress={handleCanvasProgress}
          onComplete={handleCanvasComplete}
          onError={handleCanvasError}
        />
      </div>
    </div>
  )
}
