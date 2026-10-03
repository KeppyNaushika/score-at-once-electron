import { useParams } from "next/navigation"
import { useCallback, useMemo, useState } from "react"

import { useAnswerSelection } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useAnswerSelection"
import { useAnswerWhiteness } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useAnswerWhiteness"
import { useAssignedCropRegions } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useAssignedCropRegions"
import { useDecisionEntry } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useDecisionEntry"
import { useGridZoom } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useGridZoom"
import { useGuardedScoring } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useGuardedScoring"
import { useIndividualNavigation } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useIndividualNavigation"
import { useMasterAnswerPages } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useMasterAnswerPages"
import { useMasterAnswerVisibility } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useMasterAnswerVisibility"
import { useScoringActions } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringActions"
import { useScoringDataLoader } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringDataLoader"
import { useScoringEffects } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringEffects"
import { useScoringFilter } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringFilter"
import { useScoringMainState } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringMainState"
import { useScoringMode } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringMode"
import { useScoringNavigation } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringNavigation"
import { useScoringPreferences } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringPreferences"
import { useScoringScreenBindings } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringScreenBindings"
import { useStudentAnswerManagement } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useStudentAnswerManagement"
import { useCurrentUser } from "@/contexts/CurrentUserContext"

/**
 * 採点画面（07）の配線。データ・利用者の設定・選択・絞り込み・採点の口・キー操作を
 * つなぎ、画面（`ScoringMainView`）が描くものだけを返す。描き方は画面が持つ。
 */
export function useScoringScreen() {
  const params = useParams()
  const examId = params.examId as string
  const currentUser = useCurrentUser()

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
    guardScoring,
    calculateQuestionProgress,
    handleBatchScoreWithProgress,
    partialScoreInput,
    showPartialScoreModal,
    openPartialScoreModal,
    handlePartialScoreInput,
    handlePartialScoreConfirm,
    handlePartialScoreCancel,
    handlePartialScoreBackspace,
    handlePartialScoreChange,
    handleClickScoring,
    handleMouseScoring,
    handleBatchScoreVisibleUnscored,
    visibleUnscoredCount,
    hiddenUnscoredCount,
  } = useGuardedScoring({
    scoringData: {
      examId,
      currentUserId: currentUser.id,
      currentCropRegionId,
      studentAnswerImages,
      cropRegions,
      questionScoresByCropRegionId,
    },
    progress: {
      selectedAnswers: selectedStudentAnswerImageIds,
      gradingMode,
      scoringBehavior,
      setRecentlyScoredAnswers,
      getGridAnswerData,
      setSelectedAnswers: setSelectedPageImageIds,
      handleNextStudent: handleIndividualNextStudent,
      handleNextQuestion,
    },
    clickScoring: {
      clickScoringConfig,
      allScoringData,
      filteredScoringDataIds,
      replaceSelection,
      setGradingMode,
    },
    currentCropRegion,
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

  /** キー操作の文脈・ショートカット・担当外の設問からの退避 */
  useScoringScreenBindings({
    gradingMode,
    hasSelectedAnswers: selectedStudentAnswerImageIds.size > 0,
    sidePanelVisible: showSidePanel,
    partialScoreModalOpen: showPartialScoreModal,
    scoringOperationMode: effectiveMode,
    currentCropRegionId,
    selectableCropRegions,
    setCurrentCropRegionId,
    shortcuts: {
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
    },
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

  return {
    allMasterImageUrls,
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
  }
}
