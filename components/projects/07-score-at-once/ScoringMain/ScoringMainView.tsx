"use client"

import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import type { ScoringBehavior } from "@/components/projects/07-score-at-once/ScoringIndividual/ScoringBehaviorSelector"
import { ScoringContentArea } from "@/components/projects/07-score-at-once/ScoringMain/ScoringContentArea"
import { ScoringHeaderControls } from "@/components/projects/07-score-at-once/ScoringMain/ScoringHeaderControls"
import { ScoringModals } from "@/components/projects/07-score-at-once/ScoringMain/ScoringModals"
import {
  ScoringErrorState,
  ScoringLoadingState,
} from "@/components/projects/07-score-at-once/ScoringMain/ScoringStates"
import {
  ShortcutProvider,
  useShortcutContext,
} from "@/components/projects/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import { useBatchScoringWithProgress } from "@/components/projects/07-score-at-once/ScoringMain/hooks/useBatchScoringWithProgress"
import { usePartialScore } from "@/components/projects/07-score-at-once/ScoringMain/hooks/usePartialScore"
import { useScoringActions } from "@/components/projects/07-score-at-once/ScoringMain/hooks/useScoringActions"
import { useScoringData } from "@/components/projects/07-score-at-once/ScoringMain/hooks/useScoringData"
import { useScoringDataLoader } from "@/components/projects/07-score-at-once/ScoringMain/hooks/useScoringDataLoader"
import { useScoringEffects } from "@/components/projects/07-score-at-once/ScoringMain/hooks/useScoringEffects"
import { useScoringFilter } from "@/components/projects/07-score-at-once/ScoringMain/hooks/useScoringFilter"
import { useScoringMainState } from "@/components/projects/07-score-at-once/ScoringMain/hooks/useScoringMainState"
import { useScoringNavigation } from "@/components/projects/07-score-at-once/ScoringMain/hooks/useScoringNavigation"
import { useScoringSettings } from "@/components/projects/07-score-at-once/ScoringMain/hooks/useScoringSettings"
import { useScoringShortcuts } from "@/components/projects/07-score-at-once/ScoringMain/hooks/useScoringShortcuts"
import { useStudentAnswerManagement } from "@/components/projects/07-score-at-once/ScoringMain/hooks/useStudentAnswerManagement"
import { ScoringSidePanel } from "@/components/projects/07-score-at-once/ScoringSidePanel/ScoringSidePanel"
import { useContextValue } from "@/components/projects/07-score-at-once/hooks/useContextValue"
import Head from "next/head"
import { useParams } from "next/navigation"
import { useCallback, useMemo, useState } from "react"

/** 内部コンポーネント（ShortcutProvider内で使用） */
function ScoringMainViewContent() {
  const params = useParams()
  const projectId = params.projectId as string
  const { helpButton } = usePageHelp()
  const { keyBindings } = useShortcutContext()

  /** モーダル用のキーバインディング */
  const modalKeyBindings = useMemo(
    () => ({
      partialKey: keyBindings["scoring.partial"],
      pendingKey: keyBindings["scoring.pending"],
      cancelKey: keyBindings["modal.cancel"],
    }),
    [keyBindings]
  )

  /** データローダーフック */
  const { loading, project, pageImages, cropRegions, currentUserId } =
    useScoringDataLoader(projectId)

  /** 設定管理フック */
  const {
    itemsPerLine,
    autoScroll,
    showStudentNames,
    layoutDirection,
    setItemsPerLine,
    setAutoScroll,
    setShowStudentNames,
    setLayoutDirection,
  } = useScoringSettings()

  const [questionChangeVersion, setQuestionChangeVersion] = useState(0)

  /** 個別表示用の状態 */
  const [scoringBehavior, setScoringBehavior] =
    useState<ScoringBehavior>("next-student")

  /** メイン状態管理 */
  const {
    /** 個別の状態 */
    gradingMode,
    selectedPageImageIds,
    currentStudentIndex,
    currentCropRegionId,
    showKeyboardHelp,
    showScoreComparison,
    showSidePanel,
    modifierKeyLabel,
    /** アクション関数 */
    setGradingMode,
    setSelectedPageImageIds,
    setCurrentStudentIndex,
    setCurrentCropRegionId,
    setShowKeyboardHelp,
    setShowScoreComparison,
    setShowSidePanel,
    /** ヘルパー関数 */
    handleAnswerSelect,
    replaceSelection,
    manualSelectionVersion,
  } = useScoringMainState()

  /** 現在の答案と設問 */
  const currentAnswerSheet = useMemo(() => {
    if (gradingMode === "individual" && selectedPageImageIds.size > 0) {
      const selectedAnswerId = Array.from(selectedPageImageIds)[0]
      return pageImages.find((sheet) => sheet.id === selectedAnswerId)
    }
    return pageImages[currentStudentIndex]
  }, [gradingMode, selectedPageImageIds, pageImages, currentStudentIndex])

  const currentCropRegion = cropRegions.find(
    (r) => r.id === currentCropRegionId
  )

  /** Effect処理フック */
  useScoringEffects({
    gradingMode,
    selectedPageImageIds,
    pageImages,
    cropRegions,
    currentCropRegionId,
    setSelectedPageImageIds,
    setCurrentCropRegionId,
    setQuestionChangeVersion,
  })

  /** 生徒・答案管理フック */
  const { students, handleStudentChange, handleIndividualNextStudent } =
    useStudentAnswerManagement({
      pageImages,
      selectedPageImageIds,
      gradingMode,
      currentCropRegion,
      setSelectedPageImageIds,
      setCurrentStudentIndex,
    })

  /** 採点データ管理hook */
  const {
    questionScores,
    setQuestionScores,
    loadQuestionScores,
    handleBatchScore,
    calculateQuestionProgress,
  } = useScoringData({
    currentUserId,
    setCurrentUserId: () => {},
    currentCropRegionId,
    pageImages,
    cropRegions,
  })

  /** フィルタリング管理hook */
  const {
    /** 新しいデータ構造 */
    allScoringData,
    masterAnswerData,
    filteredScoringDataIds,
    selectedScoringDataIds,

    /** 従来の互換性維持 */
    filterSettings,
    visibleAnswers,
    setRecentlyScoredAnswers,
    getGridAnswerData,
    handleRefreshFilter,
    handleToggleFilter,
  } = useScoringFilter({
    pageImages,
    cropRegions,
    currentCropRegionId: currentCropRegionId,
    questionScores,
    selectedPageImageIds: selectedPageImageIds,
    setSelectedPageImageIds: setSelectedPageImageIds,
    project,
    gradingMode,
    questionChangeVersion,
    manualSelectionVersion,
  })

  const handleReplaceSelection = useCallback(
    (ids: string[]) => {
      replaceSelection(ids)
    },
    [replaceSelection]
  )

  const {
    handleNextQuestion,
    handlePrevQuestion,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleGridNavigation,
  } = useScoringNavigation({
    answerSheetsLength: pageImages.length,
    currentCropRegionId: currentCropRegionId,
    setCurrentCropRegionId: setCurrentCropRegionId,
    selectedPageImageIds: selectedPageImageIds,
    setSelectedPageImageIds: setSelectedPageImageIds,
    layoutDirection: layoutDirection,
    getGridAnswerData,
    effectiveColumns: itemsPerLine[0],
    cropRegions: cropRegions,
  })

  const { handleBatchScoreWithProgress, handleAutoAdvance } =
    useBatchScoringWithProgress({
      selectedAnswers: selectedPageImageIds,
      gradingMode: gradingMode,
      scoringBehavior: scoringBehavior,
      setRecentlyScoredAnswers,
      handleBatchScore,
      getGridAnswerData,
      setSelectedAnswers: setSelectedPageImageIds,
      handleGridNavigation,
      handleNextStudent: handleIndividualNextStudent,
      handleNextQuestion,
    })

  /** 採点アクションフック */
  const {
    handleToggleStudentNames,
    handleItemsPerLineChange,
    handleAutoScrollChange,
  } = useScoringActions({
    projectId,
    loading,
    project,
    loadQuestionScores,
    setQuestionScores,
    showStudentNames,
    setShowStudentNames,
    setItemsPerLine,
    setAutoScroll,
  })

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
    onBatchScore: handleBatchScoreWithProgress,
    onAutoAdvance: handleAutoAdvance,
  })

  /** コンテキスト値の設定 */
  useContextValue("gradingMode", gradingMode)
  useContextValue("hasSelectedAnswers", selectedPageImageIds.size > 0)
  useContextValue("sidePanelVisible", showSidePanel)
  useContextValue("partialScoreModalOpen", showPartialScoreModal)
  useContextValue("modalOpen", showPartialScoreModal || showScoreComparison)

  /** キーボードショートカット登録 */
  useScoringShortcuts({
    handleToggleStudentNames,
    handleRefreshFilter,
    handleNextQuestion,
    handlePrevQuestion,
    handleGridNavigation,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handlePartialScoreInput,
    handlePartialScoreConfirmPartial: () =>
      handlePartialScoreConfirm("partial"),
    handlePartialScoreConfirmPending: () =>
      handlePartialScoreConfirm("pending"),
    handlePartialScoreCancel,
    handlePartialScoreBackspace,
  })

  const currentStudentId = useMemo(() => {
    if (selectedPageImageIds.size > 0) {
      const selectedAnswerId = Array.from(selectedPageImageIds)[0]
      const selectedAnswer = pageImages.find((a) => a.id === selectedAnswerId)
      return selectedAnswer?.student?.id || ""
    }
    return ""
  }, [selectedPageImageIds, pageImages])

  const questionProgress = calculateQuestionProgress()

  if (loading) {
    return <ScoringLoadingState />
  }

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
      <PageHeader title="一括採点" helpButton={helpButton}>
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
          gridTemplateRows: "1fr",
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
          onScoringDataReplace={handleReplaceSelection}
          layoutDirection={layoutDirection}
          itemsPerLine={itemsPerLine}
          autoScroll={autoScroll}
          showStudentNames={showStudentNames}
          currentStudentId={currentStudentId || undefined}
          currentUserId={currentUserId || undefined}
          questionScores={questionScores}
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
            layoutDirection={layoutDirection}
            visibleAnswersCount={visibleAnswers.length}
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
        onPartialScoreConfirmPartial={() => handlePartialScoreConfirm("partial")}
        onPartialScoreConfirmPending={() => handlePartialScoreConfirm("pending")}
        keyBindings={modalKeyBindings}
        showScoreComparison={showScoreComparison}
        onScoreComparisonClose={() => setShowScoreComparison(false)}
        currentAnswerSheet={currentAnswerSheet}
      />
    </div>
  )
}

export default function ScoringMainView() {
  return (
    <ShortcutProvider>
      <ScoringMainViewContent />
    </ShortcutProvider>
  )
}
