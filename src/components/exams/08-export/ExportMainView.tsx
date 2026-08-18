"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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
import { toStudentExportPlacements } from "@/components/exams/08-export/utils/studentExportPlacements"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import { useAuth } from "@/contexts/AuthContext"
import { administeredExamClassroomsQuery } from "@/queries/examClassroom"
import {
  recordUnresolvedConflictsMutation,
  validateScoringDataMutation,
} from "@/queries/export"
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
    answerOverlaySettings,
    setAnswerOverlaySettings,
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

  /**
   * 出力に載せる学級情報（学年・学級名・出席番号）。
   *
   * 採番学級の解決は renderer が単一ソースで担う。取得はここが1回だけ行い、
   * プレビューと書き出しの両方へ同じ値を渡す（下流それぞれが取りに行くと、
   * 同じ学級を何度も引くうえ、経路ごとに解決結果がずれる）。
   */
  const { data: administeredClassrooms, isSuccess: placementsReady } = useQuery(
    {
      ...administeredExamClassroomsQuery(exam?.id ?? ""),
      enabled: Boolean(exam?.id),
    }
  )
  const studentPlacements = useMemo(
    () => toStudentExportPlacements(administeredClassrooms ?? []),
    [administeredClassrooms]
  )

  /**
   * 書き出しの瞬間の採番学級を取り直す。
   *
   * プレビューは「揃うまで走らせない」で足りるが、書き出しは押された瞬間に
   * 正しい値が要る。まだ届いていない状態で押されると、学年・学級名・出席番号が
   * 既定の所属（memberships[0]）で書かれたファイルが、警告も出さずに出来上がる。
   */
  const queryClient = useQueryClient()
  const resolveStudentPlacements = useCallback(async () => {
    if (!exam?.id) return {}
    return toStudentExportPlacements(
      await queryClient.fetchQuery(administeredExamClassroomsQuery(exam.id))
    )
  }, [exam?.id, queryClient])

  // `mutateAsync` だけを取り出す。`useMutation` の戻り値は毎レンダー別物なので、
  // それを依存に入れると下流の effect が毎レンダー走る（R1 #1 と同じ形）
  const { mutateAsync: validateScoringData } = useMutation(
    validateScoringDataMutation()
  )
  const { mutateAsync: recordUnresolvedConflicts } = useMutation(
    recordUnresolvedConflictsMutation()
  )

  // 答案返却・差分（左カードのパネルと右カードの記録ボタンで状態を共有）
  const {
    diffByExamStudent,
    changedExamStudentIds,
    hasAnySnapshot,
    capturing: capturingReturn,
    capture: captureReturn,
  } = useReturnDiff(exam?.id ?? "")

  // プレビュー対象の生徒は個人成績表と採点済み答案で共通。生徒セレクタは1つしか
  // 無いので、タブごとに別々の状態を持つと「別の生徒を見ている」状態が生まれる。
  const [pickedStudentId, setPickedStudentId] = useState<string | null>(null)
  const previewStudentId =
    pickedStudentId && selectedExamStudentIds.includes(pickedStudentId)
      ? pickedStudentId
      : (selectedExamStudentIds[0] ?? null)

  // タブへ戻るたびに増やす読み直しの合図。出力はデータを読み直すので、
  // 取得済みのまま据え置くとプレビューと出力が食い違う。
  const [previewReloadKey, setPreviewReloadKey] = useState(0)
  const handleTabChange = (tab: ExportTabType) => {
    setExportTab(tab)
    setPreviewReloadKey((key) => key + 1)
  }

  /** 出力対象から外れた生徒はプレビューの選択ごと捨てる（戻したときに跳ばない） */
  const dropPickIfRemoved = (
    isStillSelected: (studentId: string) => boolean
  ) => {
    if (pickedStudentId && !isStillSelected(pickedStudentId)) {
      setPickedStudentId(null)
    }
  }

  const {
    previewReport,
    isLoading: isPreviewLoading,
    error: previewError,
  } = useIndividualReportPreview({
    examId: exam?.id || "",
    previewStudentId,
    options: individualReportOptions,
    studentPlacements,
    // 採番学級が揃うまで走らせない。空のまま引くと、学級名も出席番号も
    // 既定の所属のものが焼き付き、キーが同じなので取り直されない
    enabled: !!exam?.id && selectedStudents.size > 0 && placementsReady,
  })

  // Excelプレビュー
  const {
    previewData: excelPreviewData,
    isLoading: isExcelPreviewLoading,
    error: excelPreviewError,
  } = useExcelPreview({
    examId: exam?.id || "",
    selectedExamStudentIds,
    studentPlacements,
    enabled:
      !!exam?.id &&
      selectedStudents.size > 0 &&
      exportTab === "grading-data" &&
      placementsReady,
    reloadKey: previewReloadKey,
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

  // 採点済み答案プレビュー
  const {
    previewPages: scoredAnswerPreviewPages,
    isLoading: isScoredAnswerPreviewLoading,
    error: scoredAnswerPreviewError,
  } = useScoredAnswerPreview({
    examId: exam?.id || "",
    previewStudentId,
    answerOverlaySettings,
    enabled:
      !!exam?.id && selectedStudents.size > 0 && exportTab === "scored-answers",
    reloadKey: previewReloadKey,
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
      await recordUnresolvedConflicts({
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
    [exam, recordUnresolvedConflicts, user]
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
    resolveStudentPlacements,
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
    const result = await validateScoringData({
      examId: exam.id,
      selectedExamStudentIds: Array.from(selectedStudents),
      userId: user.id,
    })

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
              toggleStudent={(examStudentId) => {
                dropPickIfRemoved(
                  (pickedId) =>
                    pickedId !== examStudentId ||
                    !selectedStudents.has(examStudentId)
                )
                toggleStudent(examStudentId)
              }}
              addStudents={addStudents}
              removeStudents={(examStudentIds) => {
                dropPickIfRemoved(
                  (pickedId) => !examStudentIds.includes(pickedId)
                )
                removeStudents(examStudentIds)
              }}
              // 答案返却・差分（生徒選択タブ内に表示）
              // 差分の件数・詳細は表示フィルタと独立させるため未フィルタの全生徒を渡す
              allStudents={allStudents}
              selectedExamStudentIds={selectedExamStudentIds}
              onSelectExamStudentIds={(examStudentIds) => {
                dropPickIfRemoved((pickedId) =>
                  examStudentIds.includes(pickedId)
                )
                replaceSelection(examStudentIds)
              }}
              diffByExamStudent={diffByExamStudent}
              changedExamStudentIds={changedExamStudentIds}
              hasAnySnapshot={hasAnySnapshot}
              capturingReturn={capturingReturn}
              captureReturn={captureReturn}
              // プレビュー関連
              exportTab={exportTab}
              previewReport={previewReport}
              isPreviewLoading={isPreviewLoading}
              previewError={previewError}
              previewStudentId={previewStudentId ?? undefined}
              onPreviewStudentChange={setPickedStudentId}
              previewStudentList={previewStudentList}
              individualReportOptions={individualReportOptions}
              // 採点済み答案プレビュー
              scoredAnswerPreviewPages={scoredAnswerPreviewPages}
              isScoredAnswerPreviewLoading={isScoredAnswerPreviewLoading}
              scoredAnswerPreviewError={scoredAnswerPreviewError}
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
              answerOverlaySettings={answerOverlaySettings}
              setAnswerOverlaySettings={setAnswerOverlaySettings}
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
              onTabChange={handleTabChange}
            />
          </div>
        </div>

        {/* プログレスモーダル（閉じている間はマウントしない） */}
        {showProgressModal && (
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
        )}

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
          answerOverlaySettings={answerOverlaySettings}
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
