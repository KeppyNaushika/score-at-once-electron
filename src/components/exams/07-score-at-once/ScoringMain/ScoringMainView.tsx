"use client"

import { useQueryClient } from "@tanstack/react-query"
import Head from "next/head"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

import { useGradeLock } from "@/components/common/grade-lock/GradeLockProvider"
import { useContextValue } from "@/components/exams/07-score-at-once/hooks/useContextValue"
import { OMRAutoScoringModal } from "@/components/exams/07-score-at-once/OMRRecognition/OMRAutoScoringModal"
import {
  ShortcutProvider,
  useShortcutContext,
} from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import { useAnnotationVersions } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useAnnotationVersions"
import { useAnswerSelection } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useAnswerSelection"
import { useAnswerWhiteness } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useAnswerWhiteness"
import { useAssignedCropRegions } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useAssignedCropRegions"
import { useBatchScoringWithProgress } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useBatchScoringWithProgress"
import { useClickAndMouseScoring } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useClickAndMouseScoring"
import { useDecisionEntry } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useDecisionEntry"
import { useGridZoom } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useGridZoom"
import { useIndividualNavigation } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useIndividualNavigation"
import { useMasterAnswerPages } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useMasterAnswerPages"
import { useMasterAnswerVisibility } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useMasterAnswerVisibility"
import { usePartialScore } from "@/components/exams/07-score-at-once/ScoringMain/hooks/usePartialScore"
import { useScoringActions } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringActions"
import { useScoringData } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringData"
import { useScoringDataLoader } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringDataLoader"
import { useScoringEffects } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringEffects"
import { useScoringFilter } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringFilter"
import { useScoringMainState } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringMainState"
import { useScoringMode } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringMode"
import { useScoringNavigation } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringNavigation"
import { useScoringPreferences } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringPreferences"
import { useScoringShortcuts } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringShortcuts"
import { useStudentAnswerManagement } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useStudentAnswerManagement"
import { ScoringContentArea } from "@/components/exams/07-score-at-once/ScoringMain/ScoringContentArea"
import { ScoringHeaderControls } from "@/components/exams/07-score-at-once/ScoringMain/ScoringHeaderControls"
import { ScoringModals } from "@/components/exams/07-score-at-once/ScoringMain/ScoringModals"
import { ScoringModeModal } from "@/components/exams/07-score-at-once/ScoringMain/ScoringModeModal"
import {
  ScoringErrorState,
  ScoringLoadingState,
} from "@/components/exams/07-score-at-once/ScoringMain/ScoringStates"
import { ScoringSidePanel } from "@/components/exams/07-score-at-once/ScoringSidePanel/ScoringSidePanel"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import { examWorkflowSteps, workflowStepHref } from "@/lib/shared/workflowSteps"
import { questionScoresScope } from "@/queries/scoring"

/** 内部コンポーネント（ShortcutProvider内で使用） */
function ScoringMainViewContent() {
  const params = useParams()
  const examId = params.examId as string
  const currentUser = useCurrentUser()
  const { keyBindings } = useShortcutContext()
  const queryClient = useQueryClient()

  /** 操作モード管理 */
  const {
    scoringOperationMode,
    showModeSelectionModal,
    selectMode,
    setScoringOperationMode,
    closeModeSelectionModal,
    mouseBrush,
    setMouseBrush,
  } = useScoringMode(currentUser.id)
  const effectiveMode = scoringOperationMode ?? "keyboard"

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
  const {
    loading,
    exam,
    studentAnswerImages,
    cropRegions,
    questionScoresByCropRegionId,
  } = useScoringDataLoader(examId)

  /** 設定管理フック */
  const { scoringSettings, clickScoringConfig, setClickAction } =
    useScoringPreferences(currentUser.id)
  const {
    itemsPerLine,
    autoScroll,
    showStudentNames,
    layoutDirection,
    answerSortOrder,
    expandMargin,
    clickScoringDebounceMs,
    masterAnswerDisplayMode,
    masterAnswerOpacity,
    masterAnswerKeyBehavior,
    scoringBehavior,
    setItemsPerLine,
    setAutoScroll,
    setShowStudentNames,
    setLayoutDirection,
    setAnswerSortOrder,
    setExpandMargin,
    setClickScoringDebounceMs,
    setMasterAnswerDisplayMode,
    setMasterAnswerOpacity,
    setMasterAnswerKeyBehavior,
    setScoringBehavior,
  } = scoringSettings

  const [questionChangeVersion, setQuestionChangeVersion] = useState(0)

  /** アノテーション双方向連携用バージョンカウンター */
  const {
    annotationVersionForBrowser,
    annotationVersionForCanvas,
    annotationVersionForGrid,
    handleCanvasAnnotationChanged,
    handleBrowserAnnotationAdded,
  } = useAnnotationVersions()

  /** OMR自動採点モーダル */
  const [showOmrModal, setShowOmrModal] = useState(false)

  /** メイン状態管理 */
  const {
    /** 個別の状態 */
    gradingMode,
    selectedStudentAnswerImageIds,
    currentCropRegionId,
    showKeyboardHelp,
    showSidePanel,
    modifierKeyLabel,
    /** アクション関数 */
    setGradingMode,
    setSelectedPageImageIds,
    setCurrentCropRegionId,
    setShowKeyboardHelp,
    setShowSidePanel,
    /** ヘルパー関数 */
    handleAnswerSelect,
    replaceSelection,
    manualSelectionVersion,
  } = useScoringMainState()

  /** 現在の設問 */
  const currentCropRegion = cropRegions.find(
    (cropRegion) => cropRegion.id === currentCropRegionId
  )

  /**
   * 採点担当による設問の絞り込み。
   * 自動選択・前後移動・設問ナビゲーターの選択肢だけをこの集合に置き換える
   * （描画やスコア引き当ては全設問を見る必要があるため差し替えない）。
   */
  const {
    selectableCropRegions,
    memberCount,
    isFiltered: isQuestionSetFiltered,
  } = useAssignedCropRegions({
    examId,
    userId: currentUser.id,
    cropRegions,
  })

  /** 白さ順ソート用: 一覧表示中のページの白さを先読みする */
  const { whitenessByAnswerId, isWhitenessReady } = useAnswerWhiteness({
    studentAnswerImages,
    cropRegions,
    currentExamPageId: currentCropRegion?.examPageId ?? null,
    enabled: gradingMode === "grid",
  })

  /**
   * 白さ順・濃さ順は、並べる材料が揃うまで答案を出さない（表示も選択もしない）。
   * 表示順で並べて見せておくと、算出が終わった瞬間に並びが総入れ替えになり、
   * 見ていた答案と操作の対象がずれる。並び順は利用者ごとに憶えているので、
   * 常用している人は一覧を開いた時点でこの状態から始まる。
   */
  const isWhitenessPending =
    gradingMode === "grid" &&
    (answerSortOrder === "whiteness" || answerSortOrder === "darkness") &&
    !isWhitenessReady

  /** Effect処理フック */
  useScoringEffects({
    gradingMode,
    selectedStudentAnswerImageIds,
    studentAnswerImages,
    cropRegions: selectableCropRegions,
    currentCropRegionId,
    setSelectedPageImageIds,
    setCurrentCropRegionId,
    setQuestionChangeVersion,
  })

  /** 生徒・答案管理フック */
  const {
    examStudents,
    handleStudentChange,
    handleIndividualNextStudent,
    handleIndividualPrevStudent,
  } = useStudentAnswerManagement({
    studentAnswerImages,
    selectedStudentAnswerImageIds,
    gradingMode,
    currentCropRegion,
    setSelectedPageImageIds,
  })

  /** 採点データ管理hook */
  const {
    handleBatchScore: handleBatchScoreUnguarded,
    calculateQuestionProgress,
  } = useScoringData({
    examId,
    currentUserId: currentUser.id,
    currentCropRegionId,
    studentAnswerImages,
    cropRegions,
    questionScoresByCropRegionId,
  })

  /**
   * 成績算出が使う試験は、試験ごとロックされる（layout の `GradeLockProvider`）。
   * 書き込みそのものは中央で止まるが、採点の口（キー操作・クリック・部分点・OMR）は
   * ここでも包み、採点の後の自動進行やモーダルまで止めて通知だけ出す
   */
  const { guard: guardScoring } = useGradeLock()
  const handleBatchScore = useMemo(
    () => guardScoring(handleBatchScoreUnguarded),
    [guardScoring, handleBatchScoreUnguarded]
  )

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

  /** 採点確定の段への導線と、裁定待ちの件数（裁定そのものは「8. 採点確定」の段） */
  const { showDecisionEntry, pendingDecisionCount } = useDecisionEntry(
    examId,
    currentUser.id,
    memberCount
  )

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
    questionScoresByCropRegionId,
    currentCropRegionId: currentCropRegionId,
    currentUserId: currentUser.id,
    selectedStudentAnswerImageIds: selectedStudentAnswerImageIds,
    setSelectedPageImageIds: setSelectedPageImageIds,
    exam,
    gradingMode,
    questionChangeVersion,
    manualSelectionVersion,
    answerSortOrder,
    whitenessByAnswerId,
    isWhitenessPending,
  })

  const { handleReplaceSelection, handleSelectAll, handleSelectUnscored } =
    useAnswerSelection({
      allScoringData,
      filteredScoringDataIds,
      filterSettings,
      handleToggleFilter,
      replaceSelection,
    })

  const { handleNextQuestion, handlePrevQuestion, handleGridNavigation } =
    useScoringNavigation({
      answerSheetsLength: studentAnswerImages.length,
      currentCropRegionId: currentCropRegionId,
      setCurrentCropRegionId: setCurrentCropRegionId,
      selectedStudentAnswerImageIds: selectedStudentAnswerImageIds,
      setSelectedPageImageIds: setSelectedPageImageIds,
      layoutDirection: layoutDirection,
      getGridAnswerData,
      effectiveColumns: itemsPerLine[0],
      cropRegions: selectableCropRegions,
    })

  /** 1行あたりの表示件数を増減（ショートカットキー =/-） */
  const { handleZoomIn, handleZoomOut, handleResetZoom } = useGridZoom(
    itemsPerLine,
    setItemsPerLine
  )

  /** 個別モード用ナビゲーション（レイアウト方向に応じて次/前の生徒へ） */
  const handleIndividualNavigation = useIndividualNavigation({
    layoutDirection,
    handleIndividualNextStudent,
    handleIndividualPrevStudent,
  })

  const {
    handleBatchScoreWithProgress: handleBatchScoreWithProgressUnguarded,
  } = useBatchScoringWithProgress({
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
  // ロック中は採点しないだけでなく、採点の後の自動進行もさせない
  const handleBatchScoreWithProgress = useMemo(
    () => guardScoring(handleBatchScoreWithProgressUnguarded),
    [guardScoring, handleBatchScoreWithProgressUnguarded]
  )

  /** 採点アクションフック */
  const {
    handleToggleStudentNames,
    handleItemsPerLineChange,
    handleAutoScrollChange,
  } = useScoringActions({
    showStudentNames,
    setShowStudentNames,
    setItemsPerLine,
    setAutoScroll,
  })

  const {
    partialScoreInput,
    showPartialScoreModal,
    openPartialScoreModal: openPartialScoreModalUnguarded,
    handlePartialScoreInput: handlePartialScoreInputUnguarded,
    handlePartialScoreConfirm,
    handlePartialScoreCancel,
    handlePartialScoreBackspace,
    handlePartialScoreChange,
  } = usePartialScore({
    selectedAnswers: selectedStudentAnswerImageIds,
    currentCropRegion,
    onBatchScore: handleBatchScoreWithProgress,
  })
  // 部分点の入力はモーダルを開くところから止める（開いても確定できないため）
  const openPartialScoreModal = useMemo(
    () => guardScoring(openPartialScoreModalUnguarded),
    [guardScoring, openPartialScoreModalUnguarded]
  )
  const handlePartialScoreInput = useMemo(
    () => guardScoring(handlePartialScoreInputUnguarded),
    [guardScoring, handlePartialScoreInputUnguarded]
  )

  /**
   * 答案を採点し、「いま採点した」印も付ける（クリック・ブラシ・表示中の一括）。
   *
   * 印付けまでを1つにして包む。採点だけを包むと、ロック中に断った採点にも
   * 印が付き、採点していない答案が採点済みの並びへ寄せられる
   */
  const scoreAnswers = useMemo(
    () =>
      guardScoring(
        (
          status: Parameters<typeof handleBatchScoreUnguarded>[0],
          answerIds: string[]
        ) => {
          handleBatchScoreUnguarded(status, null, null, new Set(answerIds))
          setRecentlyScoredAnswers((prev) => {
            const newSet = new Set(prev)
            answerIds.forEach((answerId) => newSet.add(answerId))
            return newSet
          })
        }
      ),
    [guardScoring, handleBatchScoreUnguarded, setRecentlyScoredAnswers]
  )

  const {
    handleClickScoring,
    handleMouseScoring,
    handleBatchScoreVisibleUnscored,
    visibleUnscoredCount,
    hiddenUnscoredCount,
  } = useClickAndMouseScoring({
    clickScoringConfig,
    allScoringData,
    filteredScoringDataIds,
    replaceSelection,
    setGradingMode,
    openPartialScoreModal,
    scoreAnswers,
  })

  /** 表示モード切り替え（グリッド⇔個別） */
  const handleToggleViewMode = useCallback(
    () => setGradingMode((prev) => (prev === "grid" ? "individual" : "grid")),
    [setGradingMode]
  )

  /** 模範解答の表示（トグル／押している間だけ） */
  const {
    masterAnswerVisible,
    handleToggleMasterAnswer,
    handleMasterAnswerShow,
    handleMasterAnswerHide,
  } = useMasterAnswerVisibility({
    masterAnswerDisplayMode,
    masterAnswerKeyBehavior,
    gradingMode,
  })

  /** 用紙サイズと、全ページの模範解答画像URL（ページ番号順） */
  const { pageSize, allMasterImageUrls } = useMasterAnswerPages(exam?.examPages)

  /** コンテキスト値の設定 */
  useContextValue("gradingMode", gradingMode)
  useContextValue("hasSelectedAnswers", selectedStudentAnswerImageIds.size > 0)
  useContextValue("sidePanelVisible", showSidePanel)
  useContextValue("partialScoreModalOpen", showPartialScoreModal)
  // 確定は「8. 採点確定」の段へ出たので、ここで殺すのは部分点モーダルだけ。
  // 別ページなら 07 のキー操作はそもそも載っていない（ガードが要らなくなった）
  useContextValue("modalOpen", showPartialScoreModal)
  useContextValue("scoringOperationMode", effectiveMode)

  /**
   * 担当が外れて選べなくなった設問に留まらせない。
   * null に戻すと useScoringEffects が担当集合の先頭を選び直す。
   */
  useEffect(() => {
    if (!currentCropRegionId || selectableCropRegions.length === 0) return
    const isSelectable = selectableCropRegions.some(
      (cropRegion) => cropRegion.id === currentCropRegionId
    )
    if (!isSelectable) {
      setCurrentCropRegionId(null)
    }
  }, [currentCropRegionId, selectableCropRegions, setCurrentCropRegionId])

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
    handleToggleMasterAnswer,
  })

  const currentExamStudentId = useMemo(() => {
    if (selectedStudentAnswerImageIds.size > 0) {
      const selectedAnswerId = Array.from(selectedStudentAnswerImageIds)[0]
      const selectedAnswer = studentAnswerImages.find(
        (answerImage) => answerImage.id === selectedAnswerId
      )
      return selectedAnswer?.examStudentId || ""
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

      {/* 採点エリア */}
      <div className="relative flex h-full min-h-0 flex-1 overflow-hidden">
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
              currentQuestionScores={
                currentCropRegion
                  ? questionScoresByCropRegionId.get(currentCropRegion.id)
                  : undefined
              }
              onCropRegionChange={(cropRegion) => {
                setCurrentCropRegionId(cropRegion?.id || null)
              }}
              onPrevQuestion={handlePrevQuestion}
              onNextQuestion={handleNextQuestion}
              questionProgress={questionProgress}
              isQuestionSetFiltered={isQuestionSetFiltered}
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
              selectedScoringDataIds={Array.from(selectedStudentAnswerImageIds)}
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
