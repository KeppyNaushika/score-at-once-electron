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
import { useCallback, useState } from "react"

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
   * Canvas描画ベースのPDF出力（新フロー）
   */
  const handleExportScoredAnswers = async () => {
    if (selectedStudents.size === 0) {
      alert("出力する生徒を選択してください")
      return
    }

    try {
      // Step 1: 最初に保存先を選択（ユーザー操作を先に済ませる）
      const savePathResult = await window.electronAPI.export.selectPdfSavePath({
        projectName: project?.examName,
      })

      if (savePathResult.canceled || !savePathResult.filePath) {
        // ユーザーがキャンセルした場合は何もしない
        return
      }

      setPdfOutputPath(savePathResult.filePath)

      // Step 2: 処理開始
      setIsExporting(true)
      setShowProgressModal(true)
      setExportProgress(0)
      setExportStatus("processing")
      setCurrentStep("データを取得中...")

      const selectedStudentIds = Array.from(selectedStudents)

      // Step 3: PDF出力データを取得
      const dataResult = await window.electronAPI.export.getPdfExportData({
        projectId: project.id,
        selectedStudentIds,
      })

      if (!dataResult.success || !dataResult.pages) {
        setExportStatus("error")
        setCurrentStep(`エラー: ${dataResult.error || "データ取得に失敗しました"}`)
        setIsExporting(false)
        return
      }

      if (dataResult.pages.length === 0) {
        setExportStatus("error")
        setCurrentStep("出力対象のページがありません")
        setIsExporting(false)
        return
      }

      // Step 4: Canvas描画を開始
      setCurrentStep("Canvas描画を準備中...")
      setPdfExportPages(dataResult.pages)
      setStartCanvasRendering(true)
    } catch (error) {
      console.error("Export error:", error)
      setExportStatus("error")
      setCurrentStep("出力中にエラーが発生しました")
      setIsExporting(false)
    }
  }

  /**
   * Canvas描画進捗コールバック
   */
  const handleCanvasProgress = useCallback(
    (current: number, total: number, step: string) => {
      setExportProgress(Math.round((current / total) * 80)) // 80%までをCanvas描画に割り当て
      setCurrentStep(`Canvas描画中: ${step}`)
    },
    [setExportProgress, setCurrentStep]
  )

  /**
   * Canvas描画完了コールバック
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

      try {
        setExportProgress(85)
        setCurrentStep("PDFを作成中...")

        // Step 5: Canvas描画結果からPDFを作成（保存先は事前に選択済み）
        const result = await window.electronAPI.export.createPdfFromRenderedImages({
          projectId: project.id,
          renderedPages,
          pdfOrientation: exportOptions.pdfOrientation,
          outputPath: pdfOutputPath,
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
    [project?.id, exportOptions.pdfOrientation, pdfOutputPath, setExportProgress, setCurrentStep, setExportStatus, setIsExporting]
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
