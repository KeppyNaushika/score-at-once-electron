"use client"

import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import type { ScoringBehavior } from "@/components/projects/07-score-at-once/ScoringIndividual/ScoringBehaviorSelector"
import { useIndividualModeKeyboard } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useIndividualModeKeyboard"
import { ScoringContentArea } from "@/components/projects/07-score-at-once/ScoringMain/ScoringContentArea"
import { ScoringHeaderControls } from "@/components/projects/07-score-at-once/ScoringMain/ScoringHeaderControls"
import { ScoringModals } from "@/components/projects/07-score-at-once/ScoringMain/ScoringModals"
import {
  ScoringErrorState,
  ScoringLoadingState,
} from "@/components/projects/07-score-at-once/ScoringMain/ScoringStates"
import { useBatchScoringWithProgress } from "@/components/projects/07-score-at-once/ScoringMain/hooks/useBatchScoringWithProgress"
import { useScoringMainState } from "@/components/projects/07-score-at-once/ScoringMain/hooks/useScoringMainState"
import { ScoringSidePanel } from "@/components/projects/07-score-at-once/ScoringSidePanel/ScoringSidePanel"
import { usePartialScore } from "@/components/projects/07-score-at-once/ScoringMain/hooks/usePartialScore"
import { useScoringData } from "@/components/projects/07-score-at-once/ScoringMain/hooks/useScoringData"
import { useScoringDataLoader } from "@/components/projects/07-score-at-once/ScoringMain/hooks/useScoringDataLoader"
import { useScoringFilter } from "@/components/projects/07-score-at-once/ScoringMain/hooks/useScoringFilter"
import { useScoringKeyboard } from "@/components/projects/07-score-at-once/ScoringMain/hooks/useScoringKeyboard"
import { useScoringNavigation } from "@/components/projects/07-score-at-once/ScoringMain/hooks/useScoringNavigation"
import { useScoringSettings } from "@/components/projects/07-score-at-once/ScoringMain/hooks/useScoringSettings"
import Head from "next/head"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

export default function ScoringMainView() {
  const params = useParams()
  const projectId = params.projectId as string
  const { helpButton } = usePageHelp()

  // データローダーフック
  const {
    loading,
    project,
    pageImages,
    cropRegions,
    currentUserId,
    error: _error,
  } = useScoringDataLoader(projectId)

  // 設定管理フック
  const {
    itemsPerLine,
    autoScroll,
    showStudentNames,
    setItemsPerLine,
    setAutoScroll,
    setShowStudentNames,
  } = useScoringSettings()

  // 個別表示用の状態
  const [scoringBehavior, setScoringBehavior] =
    useState<ScoringBehavior>("next-student")

  // メイン状態管理
  const {
    // 個別の状態
    gradingMode,
    selectedPageImageIds,
    layoutDirection,
    currentStudentIndex,
    currentCropRegionId,
    showKeyboardHelp,
    showScoreComparison,
    showSidePanel,
    modifierKeyLabel,
    // アクション関数
    setGradingMode,
    setSelectedPageImageIds,
    setLayoutDirection,
    setCurrentStudentIndex,
    setCurrentCropRegionId,
    setShowKeyboardHelp,
    setShowScoreComparison,
    setShowSidePanel,
    setModifierKeyLabel,
    // ヘルパー関数
    handleAnswerSelect,
  } = useScoringMainState()

  // 個別表示モードに切り替え時、selectedPageImageIdsを単一選択に制限
  useEffect(() => {
    if (gradingMode === "individual" && selectedPageImageIds.size > 1) {
      // 複数選択されている場合は最初の1つだけを残す
      const firstSelected = Array.from(selectedPageImageIds)[0]
      setSelectedPageImageIds(new Set([firstSelected]))
    }
  }, [gradingMode, selectedPageImageIds, setSelectedPageImageIds])

  // 設問が未選択時の自動選択
  useEffect(() => {
    if (cropRegions.length > 0 && !currentCropRegionId) {
      // 設問タイプ'QUESTION_ANSWER'の最初の設問を自動選択
      const firstQuestionRegion = cropRegions.find(
        (region) => region.type === "QUESTION_ANSWER",
      )
      if (firstQuestionRegion) {
        setCurrentCropRegionId(firstQuestionRegion.id)
      }
    }
  }, [cropRegions, currentCropRegionId, setCurrentCropRegionId])

  // 現在の答案と設問
  const currentAnswerSheet = useMemo(() => {
    if (gradingMode === "individual" && selectedPageImageIds.size > 0) {
      // 個別表示モードでは選択された答案を使用
      const selectedAnswerId = Array.from(selectedPageImageIds)[0]
      return pageImages.find((sheet) => sheet.id === selectedAnswerId)
    }
    // 一覧表示モードでは従来通り
    return pageImages[currentStudentIndex]
  }, [gradingMode, selectedPageImageIds, pageImages, currentStudentIndex])

  const currentCropRegion = cropRegions.find(
    (r) => r.id === currentCropRegionId,
  )

  // 個別表示用の生徒データは後で定義（allScoringDataが必要なため）

  // 個別表示用のナビゲーション関数
  const handleStudentChange = useCallback(
    (studentId: string) => {
      // 該当する生徒の答案を選択状態にする
      const studentSheets = pageImages.filter(
        (sheet: any) => sheet.student.id === studentId,
      )
      if (studentSheets.length > 0) {
        // 個別表示では単一選択なので、最初の答案のみを選択
        setSelectedPageImageIds(new Set([studentSheets[0].id]))

        // currentStudentIndex も更新
        const studentIndex = pageImages.findIndex(
          (sheet: any) => sheet.student.id === studentId,
        )
        if (studentIndex !== -1) {
          setCurrentStudentIndex(studentIndex)
        }
      }
    },
    [pageImages, setSelectedPageImageIds, setCurrentStudentIndex],
  )

  // Individual navigation callbacks and effects will be defined after students is available

  // 採点データ管理hook
  const {
    questionScores,
    setQuestionScores,
    loadQuestionScores,
    handleSetScore,
    handleBatchScore,
    calculateQuestionProgress,
  } = useScoringData({
    currentUserId,
    setCurrentUserId: () => {}, // データローダーで管理するため空関数
    gradingMode: gradingMode,
    currentStudentIndex: currentStudentIndex,
    setCurrentStudentIndex: setCurrentStudentIndex,
    currentCropRegionId: currentCropRegionId,
    setCurrentCropRegionId: setCurrentCropRegionId,
    pageImages: pageImages,
    cropRegions,
  })

  // フィルタリング管理hook
  const {
    // 新しいデータ構造
    allScoringData,
    masterAnswerData,
    filteredScoringDataIds,
    selectedScoringDataIds,

    // 従来の互換性維持
    filterSettings,
    visibleAnswers,
    setRecentlyScoredAnswers,
    getGridAnswerData,
    handleRefreshFilter,
    handleToggleFilter,
    handleToggleFilterByScoreKey,
  } = useScoringFilter({
    pageImages,
    cropRegions,
    currentCropRegionId: currentCropRegionId,
    questionScores,
    selectedPageImageIds: selectedPageImageIds,
    setSelectedPageImageIds: setSelectedPageImageIds,
    project,
  })

  // 個別表示用の生徒データ（pageImagesから抽出、useMemoで安定化）
  const students = useMemo(() => {
    if (!pageImages || pageImages.length === 0) return []

    // pageImagesから重複を除いた生徒データを抽出
    const uniqueStudents = new Map()

    pageImages.forEach((sheet) => {
      if (sheet.student && !uniqueStudents.has(sheet.student.id)) {
        uniqueStudents.set(sheet.student.id, {
          id: sheet.student.id,
          studentId: sheet.student.studentId,
          lastName: sheet.student.lastName,
          firstName: sheet.student.firstName,
          customOrder: sheet.student.projectStudents?.[0]?.customOrder || 0,
        })
      }
    })

    // customOrderでソートして配列に変換
    return Array.from(uniqueStudents.values()).sort(
      (a, b) => a.customOrder - b.customOrder,
    )
  }, [pageImages])

  // 個別表示モードで最初の生徒を自動選択
  useEffect(() => {
    if (
      gradingMode === "individual" &&
      students.length > 0 &&
      selectedPageImageIds.size === 0
    ) {
      const sortedStudents = [...students].sort(
        (a, b) => a.customOrder - b.customOrder,
      )
      handleStudentChange(sortedStudents[0].id)
    }
  }, [gradingMode, students, selectedPageImageIds.size, handleStudentChange])

  const handleIndividualNextStudent = useCallback(() => {
    if (selectedPageImageIds.size === 0) return

    const currentAnswerId = Array.from(selectedPageImageIds)[0]
    const currentAnswer = pageImages.find((a: any) => a.id === currentAnswerId)
    if (!currentAnswer) return

    const sortedStudents = [...students].sort(
      (a, b) => a.customOrder - b.customOrder,
    )
    const currentIndex = sortedStudents.findIndex(
      (s) => s.id === currentAnswer.student?.id,
    )
    if (currentIndex < sortedStudents.length - 1) {
      const nextStudent = sortedStudents[currentIndex + 1]
      const nextStudentAnswer = pageImages.find(
        (a: any) => a.student?.id === nextStudent.id,
      )
      if (nextStudentAnswer) {
        setSelectedPageImageIds(new Set([nextStudentAnswer.id]))
      }
    }
  }, [students, selectedPageImageIds, pageImages, setSelectedPageImageIds])

  const handleIndividualPrevStudent = useCallback(() => {
    if (selectedPageImageIds.size === 0) return

    const currentAnswerId = Array.from(selectedPageImageIds)[0]
    const currentAnswer = pageImages.find((a: any) => a.id === currentAnswerId)
    if (!currentAnswer) return

    const sortedStudents = [...students].sort(
      (a, b) => a.customOrder - b.customOrder,
    )
    const currentIndex = sortedStudents.findIndex(
      (s) => s.id === currentAnswer.student?.id,
    )
    if (currentIndex > 0) {
      const prevStudent = sortedStudents[currentIndex - 1]
      const prevStudentAnswer = pageImages.find(
        (a: any) => a.student?.id === prevStudent.id,
      )
      if (prevStudentAnswer) {
        setSelectedPageImageIds(new Set([prevStudentAnswer.id]))
      }
    }
  }, [students, selectedPageImageIds, pageImages, setSelectedPageImageIds])

  // ナビゲーション管理hook
  const {
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
    answerSheetsLength: pageImages.length,
    cropRegionsLength: cropRegions.length,
    currentStudentIndex: currentStudentIndex,
    setCurrentStudentIndex: setCurrentStudentIndex,
    currentCropRegionId: currentCropRegionId,
    setCurrentCropRegionId: setCurrentCropRegionId,
    selectedPageImageIds: selectedPageImageIds,
    setSelectedPageImageIds: setSelectedPageImageIds,
    layoutDirection: layoutDirection,
    getGridAnswerData,
    effectiveColumns: itemsPerLine[0],
    cropRegions: cropRegions,
  })

  // バッチ採点と自動進行
  const { handleBatchScoreWithProgress, handleAutoAdvance } =
    useBatchScoringWithProgress({
      selectedAnswers: selectedPageImageIds,
      gradingMode: gradingMode,
      setRecentlyScoredAnswers,
      handleBatchScore,
      getGridAnswerData,
      setSelectedAnswers: setSelectedPageImageIds,
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
    selectedAnswers: selectedPageImageIds,
    currentCropRegion,
    onBatchScore: handleBatchScoreWithProgress, // 自動進行機能付きに変更
    onAutoAdvance: handleAutoAdvance,
  })

  // キーボードハンドリングhook
  useScoringKeyboard({
    gradingMode: gradingMode,
    selectedAnswers: selectedPageImageIds,
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

  // selectedPageImageIdsから現在の生徒IDを取得
  const currentStudentId = useMemo(() => {
    if (selectedPageImageIds.size > 0) {
      const selectedAnswerId = Array.from(selectedPageImageIds)[0]
      const selectedAnswer = pageImages.find(
        (a: any) => a.id === selectedAnswerId,
      )
      return selectedAnswer?.student?.id || ""
    }
    return ""
  }, [selectedPageImageIds, pageImages])

  // スコア状態の変換関数（ScoreStatus → ScoringStatus）
  const convertScoreStatus = useCallback(
    (
      status:
        | "CORRECT"
        | "INCORRECT"
        | "PARTIAL"
        | "BLANK"
        | "PENDING"
        | "SKIP",
    ) => {
      const statusMap = {
        CORRECT: "correct",
        INCORRECT: "incorrect",
        PARTIAL: "partial",
        BLANK: "no_answer",
        PENDING: "pending",
        SKIP: "proposed",
      } as const
      return statusMap[status] as any
    },
    [],
  )

  // 個別表示用のキーボードハンドリング（個別表示モードでのみ有効）
  useIndividualModeKeyboard({
    cropRegions,
    students,
    currentCropRegionId: currentCropRegionId,
    currentStudentId: currentStudentId,
    scoringBehavior,
    enabled: gradingMode === "individual", // 個別表示モードでのみ有効
    onQuestionChange: setCurrentCropRegionId,
    onStudentChange: handleStudentChange,
    onSetScore: (status) => handleSetScore(convertScoreStatus(status)),
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
          const existingScores = await loadQuestionScores(projectId)
          setQuestionScores(existingScores)
        } catch (error) {
          console.error("Failed to initialize grading data:", error)
        }
      }
    }

    initializeGradingData()
  }, [projectId, loading, project, loadQuestionScores, setQuestionScores])

  // 設定変更ハンドラー
  const handleItemsPerLineChange = (value: number[]) => {
    setItemsPerLine(value)
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
  if (!project || pageImages.length === 0 || cropRegions.length === 0) {
    return (
      <ScoringErrorState
        project={project}
        answerSheetsLength={pageImages.length}
        cropRegionsLength={cropRegions.length}
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
          gradingMode={gradingMode}
          onGradingModeChange={setGradingMode}
          showKeyboardHelp={showKeyboardHelp}
          onShowKeyboardHelpChange={setShowKeyboardHelp}
          showSidePanel={showSidePanel}
          onShowSidePanelChange={setShowSidePanel}
          modifierKeyLabel={modifierKeyLabel}
          helpButton={helpButton}
        />
      </PageHeader>

      {/* 採点エリア - Grid Layout */}
      <div 
        className="grid h-full min-h-0 flex-1"
        style={{
          gridTemplateColumns: showSidePanel ? "1fr 24rem" : "1fr",
          gridTemplateRows: "1fr"
        }}
      >
        <ScoringContentArea
          gradingMode={gradingMode}
          allScoringData={allScoringData}
          masterAnswerData={masterAnswerData}
          filteredScoringDataIds={filteredScoringDataIds}
          selectedScoringDataIds={selectedScoringDataIds}
          currentCropRegion={currentCropRegion}
          pageImages={pageImages}
          onScoringDataSelect={(dataId, isSelected) =>
            handleAnswerSelect(dataId, isSelected, pageImages)
          }
          onScoringDataScore={handleBatchScoreWithProgress}
          layoutDirection={layoutDirection}
          itemsPerLine={itemsPerLine}
          autoScroll={autoScroll}
          showStudentNames={showStudentNames}
        />

        {/* 右側サイドパネル */}
        {showSidePanel && (
          <ScoringSidePanel
            projectId={projectId}
            cropRegions={cropRegions}
            currentCropRegion={currentCropRegion}
            onCropRegionChange={(cropRegion) => {
              setCurrentCropRegionId(cropRegion?.id || null)
            }}
            onPrevQuestion={handlePrevQuestion}
            onNextQuestion={handleNextQuestion}
            questionProgress={questionProgress}
            selectedPageImageIds={selectedPageImageIds}
            selectedAnswersCount={selectedPageImageIds.size}
            filterSettings={filterSettings}
            onScore={handleBatchScoreWithProgress}
            onToggleFilter={handleToggleFilter}
            onRefreshFilter={handleRefreshFilter}
            partialScoreInput={partialScoreInput}
            modifierKeyLabel={modifierKeyLabel}
            layoutDirection={layoutDirection}
            visibleAnswersCount={visibleAnswers.size}
            totalAnswersCount={pageImages.length}
            onLayoutDirectionChange={setLayoutDirection}
            onGridNavigation={handleGridNavigation}
            onRefreshView={handleRefreshFilter}
            itemsPerLine={itemsPerLine}
            onItemsPerLineChange={handleItemsPerLineChange}
            autoScroll={autoScroll}
            onAutoScrollChange={handleAutoScrollChange}
            gradingMode={gradingMode}
            students={students}
            onStudentChange={handleStudentChange}
            pageImages={pageImages}
            scoringBehavior={scoringBehavior}
            onScoringBehaviorChange={(behavior) => setScoringBehavior(behavior)}
          />
        )}
      </div>

      {/* モーダル類 */}
      <ScoringModals
        showPartialScoreModal={showPartialScoreModal}
        partialScoreInput={partialScoreInput}
        currentCropRegion={currentCropRegion}
        onPartialScoreClose={handlePartialScoreCancel}
        onPartialScoreChange={handlePartialScoreChange}
        showScoreComparison={showScoreComparison}
        onScoreComparisonClose={() => setShowScoreComparison(false)}
        currentAnswerSheet={currentAnswerSheet}
      />
    </div>
  )
}
