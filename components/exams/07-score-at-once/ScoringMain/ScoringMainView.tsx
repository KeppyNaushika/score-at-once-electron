"use client"

import Head from "next/head"
import { useParams } from "next/navigation"
import { useCallback, useMemo, useState } from "react"

import { useContextValue } from "@/components/exams/07-score-at-once/hooks/useContextValue"
import { OMRAutoScoringModal } from "@/components/exams/07-score-at-once/OMRRecognition/OMRAutoScoringModal"
import type { ScoringBehavior } from "@/components/exams/07-score-at-once/ScoringIndividual/ScoringBehaviorSelector"
import {
  ShortcutProvider,
  useShortcutContext,
} from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import { useBatchScoringWithProgress } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useBatchScoringWithProgress"
import { usePartialScore } from "@/components/exams/07-score-at-once/ScoringMain/hooks/usePartialScore"
import { useScoringActions } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringActions"
import { useScoringData } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringData"
import { useScoringDataLoader } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringDataLoader"
import { useScoringEffects } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringEffects"
import { useScoringFilter } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringFilter"
import { useScoringMainState } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringMainState"
import { useScoringNavigation } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringNavigation"
import { useScoringSettings } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringSettings"
import { useScoringShortcuts } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringShortcuts"
import { useStudentAnswerManagement } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useStudentAnswerManagement"
import { ScoringContentArea } from "@/components/exams/07-score-at-once/ScoringMain/ScoringContentArea"
import { ScoringHeaderControls } from "@/components/exams/07-score-at-once/ScoringMain/ScoringHeaderControls"
import { ScoringModals } from "@/components/exams/07-score-at-once/ScoringMain/ScoringModals"
import {
  ScoringErrorState,
  ScoringLoadingState,
} from "@/components/exams/07-score-at-once/ScoringMain/ScoringStates"
import { ScoringSidePanel } from "@/components/exams/07-score-at-once/ScoringSidePanel/ScoringSidePanel"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import { useAuth } from "@/contexts/AuthContext"

/** 内部コンポーネント（ShortcutProvider内で使用） */
function ScoringMainViewContent() {
  const params = useParams()
  const examId = params.examId as string
  const { user: authUser } = useAuth()
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
  const { loading, exam, studentAnswerImages, cropRegions, currentUserId } =
    useScoringDataLoader(examId, authUser?.id ?? null)

  /** 設定管理フック */
  const {
    itemsPerLine,
    autoScroll,
    showStudentNames,
    layoutDirection,
    expandMargin,
    setItemsPerLine,
    setAutoScroll,
    setShowStudentNames,
    setLayoutDirection,
    setExpandMargin,
  } = useScoringSettings()

  const [questionChangeVersion, setQuestionChangeVersion] = useState(0)

  /** アノテーション双方向連携用バージョンカウンター */
  const [annotationVersionForBrowser, setAnnotationVersionForBrowser] =
    useState(0)
  const [annotationVersionForCanvas, setAnnotationVersionForCanvas] =
    useState(0)
  const [annotationVersionForGrid, setAnnotationVersionForGrid] = useState(0)

  // キャンバスでアノテーション変更 → ブラウザパネル一覧 + Grid一覧をリロード
  const handleCanvasAnnotationChanged = useCallback(() => {
    setAnnotationVersionForBrowser((v) => v + 1)
    setAnnotationVersionForGrid((v) => v + 1)
  }, [])

  // ブラウザの+ボタンでアノテーション追加 → キャンバスプレビュー + Grid一覧をリロード
  const handleBrowserAnnotationAdded = useCallback(() => {
    setAnnotationVersionForCanvas((v) => v + 1)
    setAnnotationVersionForGrid((v) => v + 1)
  }, [])

  /** OMR自動採点モーダル */
  const [showOmrModal, setShowOmrModal] = useState(false)

  /** 個別表示用の状態 */
  const [scoringBehavior, setScoringBehavior] =
    useState<ScoringBehavior>("next-student")

  /** メイン状態管理 */
  const {
    /** 個別の状態 */
    gradingMode,
    selectedStudentAnswerImageIds,
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
    if (
      gradingMode === "individual" &&
      selectedStudentAnswerImageIds.size > 0
    ) {
      const selectedAnswerId = Array.from(selectedStudentAnswerImageIds)[0]
      return studentAnswerImages.find((sheet) => sheet.id === selectedAnswerId)
    }
    return studentAnswerImages[currentStudentIndex]
  }, [
    gradingMode,
    selectedStudentAnswerImageIds,
    studentAnswerImages,
    currentStudentIndex,
  ])

  const currentCropRegion = cropRegions.find(
    (r) => r.id === currentCropRegionId
  )

  /** Effect処理フック */
  useScoringEffects({
    gradingMode,
    selectedStudentAnswerImageIds,
    studentAnswerImages,
    cropRegions,
    currentCropRegionId,
    setSelectedPageImageIds,
    setCurrentCropRegionId,
    setQuestionChangeVersion,
  })

  /** 生徒・答案管理フック */
  const {
    students,
    handleStudentChange,
    handleIndividualNextStudent,
    handleIndividualPrevStudent,
  } = useStudentAnswerManagement({
    studentAnswerImages,
    selectedStudentAnswerImageIds,
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
    studentAnswerImages,
    cropRegions,
  })

  /** QuestionScore作成後のリロードコールバック */
  const handleQuestionScoreCreated = useCallback(async () => {
    const scores = await loadQuestionScores(examId)
    setQuestionScores(scores)
  }, [loadQuestionScores, examId, setQuestionScores])

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
    studentAnswerImages,
    cropRegions,
    currentCropRegionId: currentCropRegionId,
    questionScores,
    selectedStudentAnswerImageIds: selectedStudentAnswerImageIds,
    setSelectedPageImageIds: setSelectedPageImageIds,
    exam,
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

  /** 全選択：表示中（フィルタ適用後）の答案をすべて選択 */
  const handleSelectAll = useCallback(() => {
    replaceSelection(filteredScoringDataIds)
  }, [replaceSelection, filteredScoringDataIds])

  const {
    handleNextQuestion,
    handlePrevQuestion,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleGridNavigation,
  } = useScoringNavigation({
    answerSheetsLength: studentAnswerImages.length,
    currentCropRegionId: currentCropRegionId,
    setCurrentCropRegionId: setCurrentCropRegionId,
    selectedStudentAnswerImageIds: selectedStudentAnswerImageIds,
    setSelectedPageImageIds: setSelectedPageImageIds,
    layoutDirection: layoutDirection,
    getGridAnswerData,
    effectiveColumns: itemsPerLine[0],
    cropRegions: cropRegions,
  })

  /**
   * 個別モード用ナビゲーション
   * レイアウト方向に応じてWASD/矢印キーを次/前の生徒に変換
   */
  const handleIndividualNavigation = useCallback(
    (key: string) => {
      // レイアウト方向ごとに「次の生徒」方向のキーを判定
      let isNext = false
      let isPrev = false

      switch (layoutDirection) {
        case "right-down":
          // 右→下: d/s/ArrowDown = next, a/w/ArrowUp = prev
          isNext = key === "d" || key === "s" || key === "ArrowDown"
          isPrev = key === "a" || key === "w" || key === "ArrowUp"
          break
        case "left-down":
          // 左→下: a/s/ArrowDown = next, d/w/ArrowUp = prev
          isNext = key === "a" || key === "s" || key === "ArrowDown"
          isPrev = key === "d" || key === "w" || key === "ArrowUp"
          break
        case "down-right":
          // 下→右: s/d/ArrowDown = next, w/a/ArrowUp = prev
          isNext = key === "s" || key === "d" || key === "ArrowDown"
          isPrev = key === "w" || key === "a" || key === "ArrowUp"
          break
        case "down-left":
          // 下→左: s/a/ArrowDown = next, w/d/ArrowUp = prev
          isNext = key === "s" || key === "a" || key === "ArrowDown"
          isPrev = key === "w" || key === "d" || key === "ArrowUp"
          break
      }

      if (isNext) {
        handleIndividualNextStudent()
      } else if (isPrev) {
        handleIndividualPrevStudent()
      }
    },
    [layoutDirection, handleIndividualNextStudent, handleIndividualPrevStudent]
  )

  const { handleBatchScoreWithProgress } = useBatchScoringWithProgress({
    selectedAnswers: selectedStudentAnswerImageIds,
    gradingMode: gradingMode,
    scoringBehavior: scoringBehavior,
    setRecentlyScoredAnswers,
    handleBatchScore,
    getGridAnswerData,
    setSelectedAnswers: setSelectedPageImageIds,
    handleNextStudent: handleIndividualNextStudent,
    handleNextQuestion,
  })

  /** 採点アクションフック */
  const {
    handleToggleStudentNames,
    handleItemsPerLineChange,
    handleAutoScrollChange,
  } = useScoringActions({
    examId,
    loading,
    exam,
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
    selectedAnswers: selectedStudentAnswerImageIds,
    currentCropRegion,
    onBatchScore: handleBatchScoreWithProgress,
  })

  /** 表示モード切り替え（グリッド⇔個別） */
  const handleToggleViewMode = useCallback(
    () => setGradingMode((prev) => (prev === "grid" ? "individual" : "grid")),
    [setGradingMode]
  )

  /** コンテキスト値の設定 */
  useContextValue("gradingMode", gradingMode)
  useContextValue("hasSelectedAnswers", selectedStudentAnswerImageIds.size > 0)
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
    handleIndividualNavigation,
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
    handleScore: handleBatchScoreWithProgress,
    handleToggleFilter,
    handleSelectAll,
    handleToggleViewMode: handleToggleViewMode,
  })

  const currentStudentId = useMemo(() => {
    if (selectedStudentAnswerImageIds.size > 0) {
      const selectedAnswerId = Array.from(selectedStudentAnswerImageIds)[0]
      const selectedAnswer = studentAnswerImages.find(
        (a) => a.id === selectedAnswerId
      )
      return selectedAnswer?.student?.id || ""
    }
    return ""
  }, [selectedStudentAnswerImageIds, studentAnswerImages])

  const questionProgress = calculateQuestionProgress()

  if (loading) {
    return <ScoringLoadingState />
  }

  if (!exam || studentAnswerImages.length === 0 || cropRegions.length === 0) {
    return (
      <ScoringErrorState
        exam={exam}
        answerSheetsLength={studentAnswerImages.length}
        cropRegionsLength={cropRegions.length}
        examId={examId}
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Head>
        <title>{`採点 - ${exam.examName}`}</title>
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
          onOmrRecognitionClick={() => setShowOmrModal(true)}
        />
      </PageHeader>

      {/* 採点エリア */}
      <div className="relative flex h-full min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1">
          <ScoringContentArea
            gradingMode={gradingMode}
            allScoringData={allScoringData}
            masterAnswerData={masterAnswerData}
            filteredScoringDataIds={filteredScoringDataIds}
            selectedScoringDataIds={selectedScoringDataIds}
            currentCropRegion={currentCropRegion}
            cropRegions={cropRegions}
            studentAnswerImages={studentAnswerImages}
            onScoringDataSelect={(dataId, isSelected) =>
              handleAnswerSelect(dataId, isSelected, studentAnswerImages)
            }
            onScoringDataReplace={handleReplaceSelection}
            layoutDirection={layoutDirection}
            itemsPerLine={itemsPerLine}
            autoScroll={autoScroll}
            showStudentNames={showStudentNames}
            currentStudentId={currentStudentId || undefined}
            currentUserId={currentUserId || undefined}
            questionScores={questionScores}
            onQuestionScoreCreated={handleQuestionScoreCreated}
            expandMargin={expandMargin}
            onAnnotationChanged={handleCanvasAnnotationChanged}
            annotationRefreshKey={annotationVersionForCanvas}
            gridAnnotationRefreshKey={annotationVersionForGrid}
          />
        </div>

        {/* 右側サイドパネル（スライドイン/アウト） */}
        <div
          className="shrink-0 transition-[width] duration-300 ease-in-out"
          style={{ width: showSidePanel ? "24rem" : "0" }}
        >
          <div className="h-full w-96">
            <ScoringSidePanel
              examId={examId}
              cropRegions={cropRegions}
              currentCropRegion={currentCropRegion}
              onCropRegionChange={(cropRegion) => {
                setCurrentCropRegionId(cropRegion?.id || null)
              }}
              onPrevQuestion={handlePrevQuestion}
              onNextQuestion={handleNextQuestion}
              questionProgress={questionProgress}
              selectedStudentAnswerImageIds={selectedStudentAnswerImageIds}
              selectedAnswersCount={selectedStudentAnswerImageIds.size}
              filterSettings={filterSettings}
              onScore={handleBatchScoreWithProgress}
              onToggleFilter={handleToggleFilter}
              onRefreshFilter={handleRefreshFilter}
              partialScoreInput={partialScoreInput}
              layoutDirection={layoutDirection}
              visibleAnswersCount={visibleAnswers.length}
              totalAnswersCount={studentAnswerImages.length}
              onLayoutDirectionChange={setLayoutDirection}
              onGridNavigation={handleGridNavigation}
              onRefreshView={handleRefreshFilter}
              itemsPerLine={itemsPerLine}
              onItemsPerLineChange={handleItemsPerLineChange}
              autoScroll={autoScroll}
              onAutoScrollChange={handleAutoScrollChange}
              gradingMode={gradingMode}
              expandMargin={expandMargin}
              onExpandMarginChange={setExpandMargin}
              students={students}
              onStudentChange={handleStudentChange}
              studentAnswerImages={studentAnswerImages}
              scoringBehavior={scoringBehavior}
              onScoringBehaviorChange={(behavior) =>
                setScoringBehavior(behavior)
              }
              currentUserId={currentUserId ?? undefined}
              selectedScoringDataIds={Array.from(selectedStudentAnswerImageIds)}
              questionScores={questionScores}
              allScoringData={allScoringData}
              onQuestionScoreCreated={handleQuestionScoreCreated}
              annotationRefreshKey={annotationVersionForBrowser}
              onAnnotationAddedFromBrowser={handleBrowserAnnotationAdded}
            />
          </div>
        </div>
      </div>

      {/* OMR自動採点モーダル */}
      <OMRAutoScoringModal
        examId={examId}
        userId={currentUserId ?? ""}
        open={showOmrModal}
        onOpenChange={setShowOmrModal}
        onScoresApplied={handleQuestionScoreCreated}
      />

      {/* モーダル類 */}
      <ScoringModals
        showPartialScoreModal={showPartialScoreModal}
        partialScoreInput={partialScoreInput}
        currentCropRegion={currentCropRegion}
        onPartialScoreClose={handlePartialScoreCancel}
        onPartialScoreChange={handlePartialScoreChange}
        onPartialScoreConfirmPartial={() =>
          handlePartialScoreConfirm("partial")
        }
        onPartialScoreConfirmPending={() =>
          handlePartialScoreConfirm("pending")
        }
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
