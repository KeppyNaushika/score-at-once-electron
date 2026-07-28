"use client"

import { useRouter } from "next/navigation"
import { useCallback, useMemo, useRef, useState } from "react"

import LoadingSpinner from "@/components/common/LoadingSpinner"
import {
  ExportOptionsCard,
  type ExportTabType,
} from "@/components/exams/08-export/components/ExportOptionsCard"
import ExportProgressModal from "@/components/exams/08-export/components/ExportProgressModal"
import ExportWarningModal from "@/components/exams/08-export/components/ExportWarningModal"
import { PdfCanvasRenderer } from "@/components/exams/08-export/components/PdfCanvasRenderer"
import { StudentSelectionCard } from "@/components/exams/08-export/components/StudentSelectionCard"
import { useDataFileExports } from "@/components/exams/08-export/hooks/useDataFileExports"
import { useExcelPreview } from "@/components/exams/08-export/hooks/useExcelPreview"
import { useExportPage } from "@/components/exams/08-export/hooks/useExportPage"
import { useIndividualReportPreview } from "@/components/exams/08-export/hooks/useIndividualReportPreview"
import { useReturnDiff } from "@/components/exams/08-export/hooks/useReturnDiff"
import { useScoredAnswerPdfExport } from "@/components/exams/08-export/hooks/useScoredAnswerPdfExport"
import { useScoredAnswerPreview } from "@/components/exams/08-export/hooks/useScoredAnswerPreview"
import { buildScoringMarkConfigForPdf } from "@/components/exams/08-export/utils/buildScoringMarkConfigForPdf"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import { useAuth } from "@/contexts/AuthContext"
import type {
  ConflictWarning,
  ScoringValidationWarnings,
} from "@/types/exportValidation.types"

export default function ExportMainView() {
  const { helpButton } = usePageHelp()
  const { user } = useAuth()
  const router = useRouter()
  const [exportTab, setExportTab] = useState<ExportTabType>("scored-answers")
  const [showWarningModal, setShowWarningModal] = useState(false)
  const [warningData, setWarningData] = useState<ScoringValidationWarnings>({
    noScoringData: [],
    ungraded: [],
    missingPartialScore: [],
    conflicted: [],
  })
  const [conflictScoreImpact, setConflictScoreImpact] = useState(0)
  const [conflictCheckError, setConflictCheckError] = useState<
    string | undefined
  >(undefined)
  const [pendingExportType, setPendingExportType] = useState<
    "scored-answers" | "grading-data" | "individual-reports" | null
  >(null)

  const {
    exam,
    students,
    allStudents,
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
  const selectedExamStudentIds = useMemo(
    () => Array.from(selectedStudents),
    [selectedStudents]
  )

  // 答案返却・差分（左カードのパネルと右カードの記録ボタンで状態を共有）
  const {
    diffByExamStudent,
    changedExamStudentIds,
    hasAnySnapshot,
    capturing: capturingReturn,
    capture: captureReturn,
  } = useReturnDiff(exam?.id ?? "")

  const {
    previewData,
    isLoading: isPreviewLoading,
    error: previewError,
    previewStudentId,
    setPreviewStudentId,
  } = useIndividualReportPreview({
    examId: exam?.id || "",
    selectedExamStudentIds,
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
    selectedExamStudentIds,
    enabled:
      !!exam?.id && selectedStudents.size > 0 && exportTab === "grading-data",
  })

  // プレビュー用の生徒リスト
  const previewStudentList = useMemo(() => {
    return students
      .filter((examStudent) => selectedStudents.has(examStudent.id))
      .map((examStudent) => ({
        id: examStudent.id,
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
    selectedExamStudentIds,
    scoringMarkConfig: scoringMarkConfigForPdf,
    enabled:
      !!exam?.id && selectedStudents.size > 0 && exportTab === "scored-answers",
  })

  /**
   * 「このまま出力」で承知した食い違い。
   * 出力が実際に完了した時点で監査ログへ書く（保存ダイアログのキャンセルや
   * 失敗で「配った」という嘘の記録が残らないように、記録は完了後に限る）。
   */
  const acknowledgedConflictsRef = useRef<{
    conflicts: ConflictWarning[]
    scoreImpact: number
  } | null>(null)

  const recordUnresolvedConflictExport = useCallback(
    async (exportType: string) => {
      const acknowledged = acknowledgedConflictsRef.current
      if (!exam || !user || !acknowledged) return
      acknowledgedConflictsRef.current = null
      await window.electronAPI.export.recordUnresolvedConflicts({
        examId: exam.id,
        userId: user.id,
        exportType,
        conflicts: acknowledged.conflicts.map((conflict) => ({
          studentName: conflict.studentName,
          questionLabel: conflict.questionLabel,
        })),
        scoreImpact: acknowledged.scoreImpact,
      })
    },
    [exam, user]
  )

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
    // 採点済み答案PDFは非同期のストリーミング処理なので、保存完了時に記録する
    onExportCompleted: () => recordUnresolvedConflictExport("scored-answers"),
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
    // 無言で何も起きない状態を作らない（runValidatedExport の catch が表に出す）
    if (!user) {
      throw new Error(
        "ログイン情報を取得できませんでした。再ログインしてから出力してください"
      )
    }
    const selectedExamStudentIds = Array.from(selectedStudents)
    const result = await window.electronAPI.export.validateScoringData({
      examId: exam.id,
      selectedExamStudentIds,
      userId: user.id,
    })

    if (!result.success) {
      throw new Error(result.error || "バリデーションに失敗しました")
    }

    if (result.hasWarnings) {
      setWarningData(result.warnings)
      setConflictScoreImpact(result.conflictScoreImpact)
      setConflictCheckError(result.conflictCheckError)
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
    // 警告なしで通った経路なので食い違いはゼロ＝監査記録は不要。
    // execute の成否（boolean を返すものもある）はここでは見ない。
    execute: () => Promise<void | boolean>
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

  /** 出力前警告から採点画面の確定パネルへ移動する */
  const handleOpenDecisionPanel = () => {
    if (!exam) return
    setShowWarningModal(false)
    setPendingExportType(null)
    router.push(`/exams/${exam.id}/07-score-at-once?decide=1`)
  }

  const handleContinueExport = async () => {
    setShowWarningModal(false)
    const exportType = pendingExportType
    setPendingExportType(null)

    // 未解決の食い違いを承知したことを控える。記録は出力の完了後（下記）。
    acknowledgedConflictsRef.current =
      warningData.conflicted.length > 0
        ? {
            conflicts: warningData.conflicted,
            scoreImpact: conflictScoreImpact,
          }
        : null

    if (exportType === "grading-data") {
      if (await executeExportGradingData()) {
        await recordUnresolvedConflictExport("grading-data")
      }
    } else if (exportType === "scored-answers") {
      // 保存完了は onExportCompleted 経由で通知される（この await では終わらない）
      await executeExportScoredAnswers()
    } else if (exportType === "individual-reports") {
      if (await executeExportIndividualReports()) {
        await recordUnresolvedConflictExport("individual-reports")
      }
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
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-2 lg:grid-rows-1">
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
              // 答案返却・差分（生徒選択タブ内に表示）
              // 差分の件数・詳細は表示フィルタと独立させるため未フィルタの全生徒を渡す
              allStudents={allStudents}
              selectedExamStudentIds={selectedExamStudentIds}
              onSelectExamStudentIds={replaceSelection}
              diffByExamStudent={diffByExamStudent}
              changedExamStudentIds={changedExamStudentIds}
              hasAnySnapshot={hasAnySnapshot}
              capturingReturn={capturingReturn}
              captureReturn={captureReturn}
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
              captureReturn={captureReturn}
              capturingReturn={capturingReturn}
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
          onOpenDecisionPanel={handleOpenDecisionPanel}
          warnings={warningData}
          conflictScoreImpact={conflictScoreImpact}
          conflictCheckError={conflictCheckError}
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
