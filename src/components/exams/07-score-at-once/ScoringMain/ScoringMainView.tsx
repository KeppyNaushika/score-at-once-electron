"use client"

import { useQueryClient } from "@tanstack/react-query"
import Head from "next/head"
import { useCallback, useMemo, useState } from "react"

import { AiGradingMode } from "@/components/exams/07-score-at-once/AiGrading/AiGradingMode"
import { useUnreflectedAiQuestionIds } from "@/components/exams/07-score-at-once/AiGrading/hooks/useUnreflectedAiQuestionIds"
import { OMRAutoScoringModal } from "@/components/exams/07-score-at-once/OMRRecognition/OMRAutoScoringModal"
import { useRubricScreen } from "@/components/exams/07-score-at-once/Rubric/hooks/useRubricScreen"
import { RubricPanel } from "@/components/exams/07-score-at-once/Rubric/RubricPanel"
import {
  ShortcutProvider,
  useShortcutContext,
} from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import { useAnnotationVersions } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useAnnotationVersions"
import { useScoringScreen } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringScreen"
import { ScoringContentArea } from "@/components/exams/07-score-at-once/ScoringMain/ScoringContentArea"
import { ScoringHeaderControls } from "@/components/exams/07-score-at-once/ScoringMain/ScoringHeaderControls"
import { ScoringModals } from "@/components/exams/07-score-at-once/ScoringMain/ScoringModals"
import { ScoringModeModal } from "@/components/exams/07-score-at-once/ScoringMain/ScoringModeModal"
import {
  ScoringErrorState,
  ScoringLoadingState,
} from "@/components/exams/07-score-at-once/ScoringMain/ScoringStates"
import { ScoringSidePanel } from "@/components/exams/07-score-at-once/ScoringSidePanel/ScoringSidePanel"
import { useAiGradingAvailability } from "@/hooks/useAiGradingAvailability"
import { examWorkflowSteps, workflowStepHref } from "@/lib/shared/workflowSteps"
import { questionScoresScope } from "@/queries/scoring"

/** 内部コンポーネント（ShortcutProvider内で使用） */
function ScoringMainViewContent() {
  /** AI採点（実験的機能）を解放した事業者。1つも無ければ「AI採点」モードは出ない */
  const { unlockedProviders } = useAiGradingAvailability()
  const {
    allMasterImageUrls,
    assignmentScope,
    allScoringData,
    answerSortOrder,
    autoScroll,
    clickScoringConfig,
    clickScoringDebounceMs,
    closeModeSelectionModal,
    cropRegions,
    currentCropRegion,
    currentExamStudentId,
    currentUser,
    effectiveMode,
    exam,
    examId,
    examStudents,
    expandMargin,
    filterSettings,
    filteredScoringDataIds,
    gradingMode,
    guardScoring,
    handleAnswerSelect,
    handleAutoScrollChange,
    handleBatchScoreVisibleUnscored,
    handleBatchScoreWithProgress,
    handleClickScoring,
    handleGridNavigation,
    handleItemsPerLineChange,
    handleMasterAnswerHide,
    handleMasterAnswerShow,
    handleMouseScoring,
    handleNextQuestion,
    handlePartialScoreBackspace,
    handlePartialScoreCancel,
    handlePartialScoreChange,
    handlePartialScoreConfirm,
    handlePartialScoreInput,
    handlePrevQuestion,
    handleRefreshFilter,
    handleReplaceSelection,
    handleSelectAll,
    handleSelectUnscored,
    handleStudentChange,
    handleToggleFilter,
    handleToggleMasterAnswer,
    hiddenUnscoredCount,
    isQuestionSetFiltered,
    isWhitenessPending,
    isWhitenessReady,
    itemsPerLine,
    layoutDirection,
    loading,
    masterAnswerData,
    masterAnswerDisplayMode,
    masterAnswerKeyBehavior,
    masterAnswerOpacity,
    masterAnswerVisible,
    modifierKeyLabel,
    mouseBrush,
    openPartialScoreModal,
    pageSize,
    partialScoreInput,
    pendingDecisionCount,
    questionProgress,
    questionScoresByCropRegionId,
    rubricAnswerFlow,
    scoringBehavior,
    selectMode,
    selectableCropRegions,
    selectedScoringDataIds,
    selectedStudentAnswerImageIds,
    setAnswerSortOrder,
    setClickAction,
    setClickScoringDebounceMs,
    setCurrentCropRegionId,
    setExpandMargin,
    setGradingMode,
    setLayoutDirection,
    setMasterAnswerDisplayMode,
    setMasterAnswerKeyBehavior,
    setMasterAnswerOpacity,
    setMouseBrush,
    setScoringBehavior,
    setScoringOperationMode,
    setShowKeyboardHelp,
    setShowSidePanel,
    showDecisionEntry,
    showKeyboardHelp,
    showModeSelectionModal,
    showPartialScoreModal,
    showSidePanel,
    showStudentNames,
    studentAnswerImages,
    visibleAnswers,
    visibleUnscoredCount,
  } = useScoringScreen({
    isAiGradingAvailable: unlockedProviders.length > 0,
  })
  const { keyBindings } = useShortcutContext()
  /** 今の設問がルーブリック採点（減点・加点方式）なら、左の項目のパネルとマスの印を出す */
  const {
    rubricCropRegion,
    questionScores: currentQuestionScores,
    renderRubricCellMark,
  } = useRubricScreen({
    examId,
    currentUserId: currentUser.id,
    gradingMode,
    currentCropRegion,
    questionScoresByCropRegionId,
  })
  const queryClient = useQueryClient()
  /** 設問一覧のオレンジの印（AI の判定が未反映）。どの採点モードでも出す */
  const unreflectedAiQuestionIds = useUnreflectedAiQuestionIds({
    examId,
    currentUserId: currentUser.id,
    questionScoresByCropRegionId,
    isAiGradingAvailable: unlockedProviders.length > 0,
  })

  /** モーダル用のキーバインディング */
  const modalKeyBindings = useMemo(
    () => ({
      partialKey: keyBindings["scoring.partial"],
      pendingKey: keyBindings["scoring.pending"],
      cancelKey: keyBindings["modal.cancel"],
    }),
    [keyBindings]
  )

  /** アノテーション双方向連携用バージョンカウンター */
  const {
    annotationVersionForBrowser,
    annotationVersionForCanvas,
    annotationVersionForGrid,
    handleCanvasAnnotationChanged,
    handleBrowserAnnotationAdded,
    handleAnnotationsChangedElsewhere,
  } = useAnnotationVersions()

  /** OMR自動採点モーダル */
  const [showOmrModal, setShowOmrModal] = useState(false)

  /**
   * 採点行を全部取り直す。
   *
   * 採点の書き込みは自分の設問だけを取り直すので、これが要るのは**手で頼まれたとき**
   * （裁定パネルの再読み込みボタン・OMR の取り込み後）だけである。どの設問が変わった
   * かを絞れない場面なので、ここは前方一致でまとめて当てる。
   *
   * 手書き注釈の保存も採点行を増やしうるが、増えるのは `status:"unscored"` の行だけで
   * 画面の表示は行の有無で変わらない（行が無いのと未採点は同じに読まれる）。
   */
  const refetchQuestionScores = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: questionScoresScope(examId),
    })
  }, [queryClient, examId])

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

      {/*
        採点の操作だけを並べる帯。段の題・使い方・次へはヘッダー（layout の
        `WorkflowTabHeader`）が出すので、ここでは持たない
      */}
      <div className="flex shrink-0 items-center justify-end gap-2 border-b px-3 py-2">
        <ScoringHeaderControls
          gradingMode={gradingMode}
          onGradingModeChange={setGradingMode}
          showKeyboardHelp={showKeyboardHelp}
          onShowKeyboardHelpChange={setShowKeyboardHelp}
          showSidePanel={showSidePanel}
          onShowSidePanelChange={setShowSidePanel}
          modifierKeyLabel={modifierKeyLabel}
          onOmrRecognitionClick={guardScoring(() => setShowOmrModal(true))}
          scoreDecisionHref={
            showDecisionEntry
              ? workflowStepHref(
                  `/exams/${examId}`,
                  examWorkflowSteps,
                  "08-finalize"
                )
              : undefined
          }
          pendingDecisionCount={pendingDecisionCount}
        />
      </div>

      {/* 採点エリア（AI採点モードは設問・一覧・右パネルの3列を自前で持つ。一覧と表示の設定は一覧表示と同じ） */}
      {gradingMode === "ai" ? (
        <div className="relative flex h-full min-h-0 flex-1 overflow-hidden">
          <AiGradingMode
            examId={examId}
            currentUserId={currentUser.id}
            cropRegions={selectableCropRegions}
            currentCropRegion={currentCropRegion}
            onCropRegionChange={(cropRegion) => {
              setCurrentCropRegionId(cropRegion?.id || null)
            }}
            onPrevQuestion={handlePrevQuestion}
            onNextQuestion={handleNextQuestion}
            questionProgress={questionProgress}
            isQuestionSetFiltered={isQuestionSetFiltered}
            studentAnswerImages={studentAnswerImages}
            questionScoresByCropRegionId={questionScoresByCropRegionId}
            pageSize={pageSize}
            unlockedProviders={unlockedProviders}
            unreflectedAiQuestionIds={unreflectedAiQuestionIds}
            display={{
              layoutDirection,
              onLayoutDirectionChange: setLayoutDirection,
              itemsPerLine,
              onItemsPerLineChange: handleItemsPerLineChange,
              expandMargin,
              onExpandMarginChange: setExpandMargin,
              autoScroll,
              showStudentNames,
              annotationRefreshKey: annotationVersionForGrid,
            }}
          />
        </div>
      ) : (
        <div className="relative flex h-full min-h-0 flex-1 overflow-hidden">
          {/* 左のルーブリック項目（減点・加点方式の設問だけ。直接採点の設問では出さない） */}
          {rubricCropRegion && (
            <RubricPanel
              key={rubricCropRegion.id}
              examId={examId}
              cropRegion={rubricCropRegion}
              currentUserId={currentUser.id}
              questionScores={currentQuestionScores}
              selectedExamStudentIds={rubricAnswerFlow.selectedExamStudentIds}
              onAdvance={rubricAnswerFlow.advanceToNextAnswer}
              onScored={rubricAnswerFlow.markExamStudentsScored}
              studentAnswerImages={studentAnswerImages}
              scoringDatas={allScoringData}
              pageSize={pageSize}
              onAnnotationsChanged={handleAnnotationsChangedElsewhere}
            />
          )}
          <div className="min-w-0 flex-1">
            <ScoringContentArea
              gradingMode={gradingMode}
              isWhitenessPending={isWhitenessPending}
              allScoringData={allScoringData}
              masterAnswerData={masterAnswerData}
              filteredScoringDataIds={filteredScoringDataIds}
              selectedScoringDataIds={selectedScoringDataIds}
              currentCropRegion={currentCropRegion}
              cropRegions={cropRegions}
              questionScoresByCropRegionId={questionScoresByCropRegionId}
              studentAnswerImages={studentAnswerImages}
              onScoringDataSelect={(dataId, isSelected) =>
                handleAnswerSelect(dataId, isSelected, studentAnswerImages)
              }
              onScoringDataReplace={handleReplaceSelection}
              layoutDirection={layoutDirection}
              itemsPerLine={itemsPerLine}
              autoScroll={autoScroll}
              showStudentNames={showStudentNames}
              currentExamStudentId={currentExamStudentId || undefined}
              currentUserId={currentUser.id}
              expandMargin={expandMargin}
              onAnnotationChanged={handleCanvasAnnotationChanged}
              annotationRefreshKey={annotationVersionForCanvas}
              gridAnnotationRefreshKey={annotationVersionForGrid}
              masterAnswerDisplayMode={masterAnswerDisplayMode}
              masterAnswerOpacity={masterAnswerOpacity}
              masterAnswerVisible={masterAnswerVisible}
              allMasterImageUrls={allMasterImageUrls}
              pageSize={pageSize}
              onClickScoring={handleClickScoring}
              clickScoringDebounceMs={clickScoringDebounceMs}
              scoringOperationMode={effectiveMode}
              mouseBrush={mouseBrush}
              onMouseScoring={handleMouseScoring}
              renderBeforeStatusMark={renderRubricCellMark}
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
                cropRegions={selectableCropRegions}
                currentCropRegion={currentCropRegion}
                currentQuestionScores={currentQuestionScores}
                onCropRegionChange={(cropRegion) => {
                  setCurrentCropRegionId(cropRegion?.id || null)
                }}
                onPrevQuestion={handlePrevQuestion}
                onNextQuestion={handleNextQuestion}
                questionProgress={questionProgress}
                unreflectedAiQuestionIds={unreflectedAiQuestionIds}
                assignmentScope={assignmentScope}
                selectedStudentAnswerImageIds={selectedStudentAnswerImageIds}
                selectedAnswersCount={selectedStudentAnswerImageIds.size}
                filterSettings={filterSettings}
                onScore={handleBatchScoreWithProgress}
                onToggleFilter={handleToggleFilter}
                onRefreshFilter={handleRefreshFilter}
                onSelectAll={handleSelectAll}
                onSelectUnscored={handleSelectUnscored}
                onOpenPartialScoreModal={openPartialScoreModal}
                partialScoreInput={partialScoreInput}
                clickScoringConfig={clickScoringConfig}
                clickScoringDebounceMs={clickScoringDebounceMs}
                onClickActionChange={(clickCount, action) =>
                  setClickAction({ clickCount, action })
                }
                onClickScoringDebounceMsChange={setClickScoringDebounceMs}
                layoutDirection={layoutDirection}
                visibleAnswersCount={visibleAnswers.length}
                totalAnswersCount={studentAnswerImages.length}
                onLayoutDirectionChange={setLayoutDirection}
                onGridNavigation={handleGridNavigation}
                itemsPerLine={itemsPerLine}
                onItemsPerLineChange={handleItemsPerLineChange}
                autoScroll={autoScroll}
                onAutoScrollChange={handleAutoScrollChange}
                gradingMode={gradingMode}
                answerSortOrder={answerSortOrder}
                onAnswerSortOrderChange={setAnswerSortOrder}
                isWhitenessReady={isWhitenessReady}
                expandMargin={expandMargin}
                onExpandMarginChange={setExpandMargin}
                examStudents={examStudents}
                onStudentChange={handleStudentChange}
                studentAnswerImages={studentAnswerImages}
                scoringBehavior={scoringBehavior}
                onScoringBehaviorChange={setScoringBehavior}
                currentUserId={currentUser.id}
                selectedScoringDataIds={Array.from(
                  selectedStudentAnswerImageIds
                )}
                allScoringData={allScoringData}
                annotationRefreshKey={annotationVersionForBrowser}
                onAnnotationAddedFromBrowser={handleBrowserAnnotationAdded}
                masterAnswerDisplayMode={masterAnswerDisplayMode}
                masterAnswerOpacity={masterAnswerOpacity}
                masterAnswerKeyBehavior={masterAnswerKeyBehavior}
                onMasterAnswerDisplayModeChange={setMasterAnswerDisplayMode}
                onMasterAnswerOpacityChange={setMasterAnswerOpacity}
                onMasterAnswerKeyBehaviorChange={setMasterAnswerKeyBehavior}
                masterAnswerVisible={masterAnswerVisible}
                onToggleMasterAnswer={handleToggleMasterAnswer}
                onMasterAnswerShow={handleMasterAnswerShow}
                onMasterAnswerHide={handleMasterAnswerHide}
                scoringOperationMode={effectiveMode}
                onScoringOperationModeChange={setScoringOperationMode}
                mouseBrush={mouseBrush}
                onMouseBrushChange={setMouseBrush}
                visibleUnscoredCount={visibleUnscoredCount}
                hiddenUnscoredCount={hiddenUnscoredCount}
                onBatchScoreVisibleUnscored={handleBatchScoreVisibleUnscored}
              />
            </div>
          </div>
        </div>
      )}

      {/* OMR自動採点モーダル */}
      <OMRAutoScoringModal
        examId={examId}
        userId={currentUser.id}
        open={showOmrModal}
        onOpenChange={setShowOmrModal}
        onScoresApplied={refetchQuestionScores}
      />

      {/* モード選択モーダル */}
      <ScoringModeModal
        open={showModeSelectionModal}
        onSelect={selectMode}
        onClose={closeModeSelectionModal}
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
        onPartialScoreDigit={handlePartialScoreInput}
        onPartialScoreBackspace={handlePartialScoreBackspace}
        keyBindings={modalKeyBindings}
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
