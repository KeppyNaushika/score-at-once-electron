"use client"

import { useMemo, useState } from "react"

import LoadingSpinner from "@/components/common/LoadingSpinner"
import {
  ExportOptionsCard,
  type ExportTabType,
} from "@/components/exams/08-export/components/ExportOptionsCard"
import ExportProgressModal from "@/components/exams/08-export/components/ExportProgressModal"
import ExportWarningModal from "@/components/exams/08-export/components/ExportWarningModal"
import { PdfCanvasRenderer } from "@/components/exams/08-export/components/PdfCanvasRenderer"
import { ReturnDiffPanel } from "@/components/exams/08-export/components/ReturnDiffPanel"
import { StudentSelectionCard } from "@/components/exams/08-export/components/StudentSelectionCard"
import { useDataFileExports } from "@/components/exams/08-export/hooks/useDataFileExports"
import { useExcelPreview } from "@/components/exams/08-export/hooks/useExcelPreview"
import { useExportPage } from "@/components/exams/08-export/hooks/useExportPage"
import { useIndividualReportPreview } from "@/components/exams/08-export/hooks/useIndividualReportPreview"
import { useScoredAnswerPdfExport } from "@/components/exams/08-export/hooks/useScoredAnswerPdfExport"
import { useScoredAnswerPreview } from "@/components/exams/08-export/hooks/useScoredAnswerPreview"
import { buildScoringMarkConfigForPdf } from "@/components/exams/08-export/utils/buildScoringMarkConfigForPdf"
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

  // プレビュー用にmemoized configを用意（毎レンダーで新オブジェクト生成→無限ループ防止）
  const scoringMarkConfigForPdf = useMemo(
    () => buildScoringMarkConfigForPdf(scoringMarkConfig),
    [scoringMarkConfig]
  )

  // 採点済み答案プレビュー（scoringMarkConfigForPdfの後に配置）
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

  // 採点済み答案の Canvas 描画ベース PDF 出力（ストリーミング処理）
  const {
    executeExportScoredAnswers,
    pdfExportPages,
    startCanvasRendering,
    handleCanvasProgress,
    handlePageComplete,
    handleCanvasComplete,
    handleCanvasError,
    embeddedPagesCount,
    totalPagesCount,
    canvasRenderingComplete,
  } = useScoredAnswerPdfExport({
    exam,
    selectedStudents,
    exportOptions,
    setIsExporting,
    setShowProgressModal,
    setExportProgress,
    setExportStatus,
    setCurrentStep,
  })

  // Canvas 描画を伴わないファイル出力（採点データExcel・R データ・個人成績表印刷）
  const {
    executeExportGradingData,
    handleExportRData,
    executeExportIndividualReports,
  } = useDataFileExports({
    exam,
    selectedStudents,
    individualReportOptions,
    setIsExporting,
  })

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

  /**
   * 出力前の共通フロー（生徒選択チェック → 出力中ガード → バリデーション →
   * 出力実行）をまとめる。バリデーションで警告が出た場合は validateBeforeExport が
   * 警告モーダルを表示し、続行時は handleContinueExport から execute が呼ばれる。
   */
  const runValidatedExport = async (
    exportType: "scored-answers" | "grading-data" | "individual-reports",
    execute: () => Promise<void>
  ): Promise<void> => {
    if (selectedStudents.size === 0) {
      alert("出力する生徒を選択してください")
      return
    }

    if (isExporting) {
      return
    }

    try {
      const isValid = await validateBeforeExport(exportType)
      if (!isValid) return

      await execute()
    } catch (error) {
      console.error("Export error:", error)
      alert(
        `エラー: ${error instanceof Error ? error.message : "不明なエラー"}`
      )
    }
  }

  const handleExportScoredAnswers = () =>
    runValidatedExport("scored-answers", executeExportScoredAnswers)

  const handleExportGradingData = () =>
    runValidatedExport("grading-data", executeExportGradingData)

  const handleExportIndividualReports = () =>
    runValidatedExport("individual-reports", executeExportIndividualReports)

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
          scoringMarkConfig={scoringMarkConfigForPdf}
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
