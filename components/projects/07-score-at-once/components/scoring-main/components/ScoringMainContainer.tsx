"use client"

import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import type { ScoringBehavior } from "@/components/projects/07-score-at-once/components/individual-mode/ScoringBehaviorSelector"
import { ScoringContentArea } from "@/components/projects/07-score-at-once/components/scoring-main/components/ScoringContentArea"
import { ScoringHeaderControls } from "@/components/projects/07-score-at-once/components/scoring-main/components/ScoringHeaderControls"
import { ScoringModals } from "@/components/projects/07-score-at-once/components/scoring-main/components/ScoringModals"
import { ScoringSidePanel } from "@/components/projects/07-score-at-once/components/scoring-main/components/ScoringSidePanel"
import {
  ScoringErrorState,
  ScoringLoadingState,
} from "@/components/projects/07-score-at-once/components/scoring-main/components/ScoringStates"
import { useBatchScoringWithProgress } from "@/components/projects/07-score-at-once/components/scoring-main/hooks/useBatchScoringWithProgress"
import { useScoringMainState } from "@/components/projects/07-score-at-once/components/scoring-main/hooks/useScoringMainState"
import { useIndividualModeKeyboard } from "@/components/projects/07-score-at-once/hooks/useIndividualModeKeyboard"
import { usePartialScore } from "@/components/projects/07-score-at-once/hooks/usePartialScore"
import { useScoringData } from "@/components/projects/07-score-at-once/hooks/useScoringData"
import { useScoringDataLoader } from "@/components/projects/07-score-at-once/hooks/useScoringDataLoader"
import { useScoringFilter } from "@/components/projects/07-score-at-once/hooks/useScoringFilter"
import { useScoringKeyboard } from "@/components/projects/07-score-at-once/hooks/useScoringKeyboard"
import { useScoringNavigation } from "@/components/projects/07-score-at-once/hooks/useScoringNavigation"
import { useScoringSettings } from "@/components/projects/07-score-at-once/hooks/useScoringSettings"
import Head from "next/head"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

export default function ScoringMainContainer() {
  const params = useParams()
  const projectId = params.projectId as string
  const { helpButton } = usePageHelp()

  // データローダーフック
  const {
    loading,
    project,
    answerSheets,
    questionRegions,
    currentUserId,
    error: _error,
  } = useScoringDataLoader(projectId)

  // 設定管理フック
  const {
    itemsPerRow,
    autoScroll,
    showStudentNames,
    setItemsPerRow,
    setAutoScroll,
    setShowStudentNames,
  } = useScoringSettings()

  // 個別表示用の状態
  const [currentStudentId, setCurrentStudentId] = useState<string>("")
  const [scoringBehavior, setScoringBehavior] =
    useState<ScoringBehavior>("next-student")

  // メイン状態管理
  const { state, actions, gridSize, handleAnswerSelect } = useScoringMainState()

  // 現在の答案と設問
  const currentAnswerSheet = answerSheets[state.currentStudentIndex]
  const currentQuestion = questionRegions[state.currentQuestionIndex]

  // 個別表示用の生徒データ（useMemoで安定化）
  const students = useMemo(() => {
    return (
      project?.projectStudents?.map((ps: any) => ({
        id: ps.student.id,
        studentId: ps.student.studentId,
        lastName: ps.student.lastName,
        firstName: ps.student.firstName,
        customOrder: ps.customOrder || 0,
      })) || []
    )
  }, [project?.projectStudents])

  // 現在の生徒IDを初期化
  useEffect(() => {
    if (students.length > 0 && !currentStudentId) {
      const sortedStudents = [...students].sort(
        (a, b) => a.customOrder - b.customOrder,
      )
      setCurrentStudentId(sortedStudents[0].id)
    }
  }, [students, currentStudentId])

  // 個別表示用のナビゲーション関数
  const handleStudentChange = useCallback(
    (studentId: string) => {
      setCurrentStudentId(studentId)
      // state.currentStudentIndex も更新
      const studentIndex = answerSheets.findIndex(
        (sheet: any) => sheet.student.id === studentId,
      )
      if (studentIndex !== -1) {
        actions.setCurrentStudentIndex(studentIndex)
      }
    },
    [answerSheets, actions],
  )

  const handleIndividualNextStudent = useCallback(() => {
    const sortedStudents = [...students].sort(
      (a, b) => a.customOrder - b.customOrder,
    )
    const currentIndex = sortedStudents.findIndex(
      (s) => s.id === currentStudentId,
    )
    if (currentIndex < sortedStudents.length - 1) {
      handleStudentChange(sortedStudents[currentIndex + 1].id)
    }
  }, [students, currentStudentId, handleStudentChange])

  const handleIndividualPrevStudent = useCallback(() => {
    const sortedStudents = [...students].sort(
      (a, b) => a.customOrder - b.customOrder,
    )
    const currentIndex = sortedStudents.findIndex(
      (s) => s.id === currentStudentId,
    )
    if (currentIndex > 0) {
      handleStudentChange(sortedStudents[currentIndex - 1].id)
    }
  }, [students, currentStudentId, handleStudentChange])

  // 採点データ管理hook
  const {
    scoringData,
    setScoringData,
    loadExistingScoringData,
    handleSetScore,
    handleBatchScore,
    calculateQuestionProgress,
  } = useScoringData({
    currentUserId,
    setCurrentUserId: () => {}, // データローダーで管理するため空関数
    gradingMode: state.gradingMode,
    currentStudentIndex: state.currentStudentIndex,
    setCurrentStudentIndex: actions.setCurrentStudentIndex,
    currentQuestionIndex: state.currentQuestionIndex,
    setCurrentQuestionIndex: actions.setCurrentQuestionIndex,
    answerSheets,
    questionRegions,
  })

  // フィルタリング管理hook
  const {
    filterSettings,
    visibleAnswers,
    setRecentlyScoredAnswers,
    getGridAnswerData,
    handleRefreshFilter,
    handleToggleFilter,
    handleToggleFilterByScoreKey,
  } = useScoringFilter({
    answerSheets,
    questionRegions,
    currentQuestionIndex: state.currentQuestionIndex,
    scoringData,
    selectedAnswers: state.selectedAnswers,
    setSelectedAnswers: actions.setSelectedAnswers,
    project,
  })

  // ナビゲーション管理hook
  const {
    imageZoom,
    setImageZoom,
    imagePosition,
    setImagePosition,
    viewMode,
    setViewMode,
    handleNextQuestion,
    handlePrevQuestion,
    handleNextStudent,
    handlePrevStudent,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    toggleViewMode,
    handleGridNavigation,
  } = useScoringNavigation({
    answerSheetsLength: answerSheets.length,
    questionRegionsLength: questionRegions.length,
    currentStudentIndex: state.currentStudentIndex,
    setCurrentStudentIndex: actions.setCurrentStudentIndex,
    currentQuestionIndex: state.currentQuestionIndex,
    setCurrentQuestionIndex: actions.setCurrentQuestionIndex,
    selectedAnswers: state.selectedAnswers,
    setSelectedAnswers: actions.setSelectedAnswers,
    gridSize,
    layoutDirection: state.layoutDirection,
    getGridAnswerData,
    effectiveColumns: state.effectiveColumns,
  })

  // バッチ採点と自動進行
  const { handleBatchScoreWithProgress, handleAutoAdvance } =
    useBatchScoringWithProgress({
      selectedAnswers: state.selectedAnswers,
      gradingMode: state.gradingMode,
      setRecentlyScoredAnswers,
      handleBatchScore,
      getGridAnswerData,
      setSelectedAnswers: actions.setSelectedAnswers,
      handleGridNavigation,
      handleNextStudent,
    })

  // 生徒名表示設定の変更
  const handleToggleStudentNames = useCallback(() => {
    setShowStudentNames(!showStudentNames)
  }, [showStudentNames, setShowStudentNames])

  // 部分点入力管理hook
  const {
    partialScoreInput,
    showPartialScoreModal,
    handlePartialScoreInput,
    handlePartialScoreConfirm,
    handlePartialScoreCancel,
    handlePartialScoreBackspace,
    handlePartialScoreChange,
  } = usePartialScore({
    selectedAnswers: state.selectedAnswers,
    currentQuestion,
    onBatchScore: handleBatchScoreWithProgress, // 自動進行機能付きに変更
    onAutoAdvance: handleAutoAdvance,
  })

  // キーボードハンドリングhook
  useScoringKeyboard({
    gradingMode: state.gradingMode,
    selectedAnswers: state.selectedAnswers,
    onBatchScore: handleBatchScoreWithProgress, // 自動進行機能付きに変更
    onSetScore: handleSetScore,
    onNextQuestion: handleNextQuestion,
    onPrevQuestion: handlePrevQuestion,
    onNextStudent: handleNextStudent,
    onPrevStudent: handlePrevStudent,
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onResetZoom: handleResetZoom,
    onToggleViewMode: toggleViewMode,
    onGridNavigation: handleGridNavigation,
    onToggleFilterByScoreKey: handleToggleFilterByScoreKey,
    onRefreshFilter: handleRefreshFilter,
    onPartialScoreInput: handlePartialScoreInput,
    onPartialScoreConfirm: handlePartialScoreConfirm,
    onPartialScoreCancel: handlePartialScoreCancel,
    onPartialScoreBackspace: handlePartialScoreBackspace,
    showPartialScoreModal,
    onToggleFilter: handleToggleFilter,
    onToggleStudentNames: handleToggleStudentNames,
  })

  // 個別表示用のキーボードハンドリング（個別表示モードでのみ有効）
  useIndividualModeKeyboard({
    questionRegions,
    students,
    currentQuestionIndex: state.currentQuestionIndex,
    currentStudentId,
    scoringBehavior,
    enabled: state.gradingMode === "individual", // 個別表示モードでのみ有効
    onQuestionChange: actions.setCurrentQuestionIndex,
    onStudentChange: handleStudentChange,
    onSetScore: handleSetScore,
    onNextQuestion: handleNextQuestion,
    onPrevQuestion: handlePrevQuestion,
    onNextStudent: handleIndividualNextStudent,
    onPrevStudent: handleIndividualPrevStudent,
  })

  // 採点データの初期化
  useEffect(() => {
    const initializeGradingData = async () => {
      if (!loading && project) {
        try {
          // 既存の採点データを読み込み
          const existingScores = await loadExistingScoringData(projectId)
          setScoringData(existingScores)
        } catch (error) {
          console.error("Failed to initialize grading data:", error)
        }
      }
    }

    initializeGradingData()
  }, [projectId, loading, project, loadExistingScoringData, setScoringData])

  // 設定の初期化
  useEffect(() => {
    // 実際の列数を更新（設定フックから取得）
    actions.setEffectiveColumns(itemsPerRow[0])
  }, [itemsPerRow, actions])

  // 設定変更ハンドラー
  const handleItemsPerRowChange = (value: number[]) => {
    setItemsPerRow(value)
    actions.setEffectiveColumns(value[0])
  }

  const handleAutoScrollChange = (enabled: boolean) => {
    setAutoScroll(enabled)
  }

  // 設問別進捗を計算
  const questionProgress = calculateQuestionProgress()

  // ローディング状態
  if (loading) {
    return <ScoringLoadingState />
  }

  // エラー状態
  if (!project || answerSheets.length === 0 || questionRegions.length === 0) {
    return (
      <ScoringErrorState
        project={project}
        answerSheetsLength={answerSheets.length}
        questionRegionsLength={questionRegions.length}
        projectId={projectId}
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Head>
        <title>{`採点 - ${project.examName}`}</title>
      </Head>

      {/* PageHeader */}
      <PageHeader
        title="採点"
        description="答案を採点し、点数を入力します"
        helpButton={helpButton}
      >
        <ScoringHeaderControls
          gradingMode={state.gradingMode}
          onGradingModeChange={actions.setGradingMode}
          showKeyboardHelp={state.showKeyboardHelp}
          onShowKeyboardHelpChange={actions.setShowKeyboardHelp}
          showSidePanel={state.showSidePanel}
          onShowSidePanelChange={actions.setShowSidePanel}
          modifierKeyLabel={state.modifierKeyLabel}
          helpButton={helpButton}
        />
      </PageHeader>

      {/* 採点エリア */}
      <div className="flex min-h-0 flex-1">
        <ScoringContentArea
          gradingMode={state.gradingMode}
          currentAnswerSheet={currentAnswerSheet}
          currentQuestion={currentQuestion}
          allAnswerSheets={answerSheets}
          students={students}
          currentStudentId={currentStudentId}
          onStudentChange={handleStudentChange}
          scoringBehavior={scoringBehavior}
          onScoringBehaviorChange={setScoringBehavior}
          viewMode={viewMode}
          imageZoom={imageZoom}
          imagePosition={imagePosition}
          onZoomChange={setImageZoom}
          onPositionChange={setImagePosition}
          onViewModeChange={setViewMode}
          getGridAnswerData={getGridAnswerData}
          currentQuestionIndex={state.currentQuestionIndex}
          layoutDirection={state.layoutDirection}
          gridSize={gridSize}
          onAnswerSelect={(answerId, isSelected) =>
            handleAnswerSelect(answerId, isSelected, answerSheets)
          }
          onAnswerScore={handleBatchScoreWithProgress}
          selectedAnswers={state.selectedAnswers}
          onEffectiveColumnsChange={actions.setEffectiveColumns}
          itemsPerRow={itemsPerRow}
          autoScroll={autoScroll}
          showStudentNames={showStudentNames}
        />

        {/* 右側サイドパネル */}
        {state.showSidePanel && (
          <ScoringSidePanel
            projectId={projectId}
            questionRegions={questionRegions}
            currentQuestionIndex={state.currentQuestionIndex}
            onQuestionChange={actions.setCurrentQuestionIndex}
            onPrevQuestion={handlePrevQuestion}
            onNextQuestion={handleNextQuestion}
            questionProgress={questionProgress}
            selectedAnswersCount={state.selectedAnswers.size}
            currentQuestion={currentQuestion}
            filterSettings={filterSettings}
            onScore={handleBatchScoreWithProgress}
            onToggleFilter={handleToggleFilter}
            onRefreshFilter={handleRefreshFilter}
            partialScoreInput={partialScoreInput}
            modifierKeyLabel={state.modifierKeyLabel}
            layoutDirection={state.layoutDirection}
            visibleAnswersCount={visibleAnswers.size}
            totalAnswersCount={answerSheets.length}
            onLayoutDirectionChange={actions.setLayoutDirection}
            onGridNavigation={handleGridNavigation}
            onRefreshView={handleRefreshFilter}
            itemsPerRow={itemsPerRow}
            onItemsPerRowChange={handleItemsPerRowChange}
            autoScroll={autoScroll}
            onAutoScrollChange={handleAutoScrollChange}
          />
        )}
      </div>

      {/* モーダル類 */}
      <ScoringModals
        showPartialScoreModal={showPartialScoreModal}
        partialScoreInput={partialScoreInput}
        currentQuestion={currentQuestion}
        onPartialScoreClose={handlePartialScoreCancel}
        onPartialScoreChange={handlePartialScoreChange}
        showScoreComparison={state.showScoreComparison}
        onScoreComparisonClose={() => actions.setShowScoreComparison(false)}
        currentAnswerSheet={currentAnswerSheet}
      />
    </div>
  )
}
