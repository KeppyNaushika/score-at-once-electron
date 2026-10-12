import { useMemo, useState } from "react"

import { useScaleQuestion } from "@/components/exams/07-score-at-once/ScaleLevel/hooks/useScaleQuestion"
import { effectiveMouseBrushOf } from "@/components/exams/07-score-at-once/ScaleLevel/utils/scaleMouseBrush"
import { useDecisionEntry } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useDecisionEntry"
import { useGuardedScoring } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useGuardedScoring"
import { useMasterAnswerPages } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useMasterAnswerPages"
import { useMasterAnswerVisibility } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useMasterAnswerVisibility"
import { useRubricAnswerFlow } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useRubricAnswerFlow"
import { useScoringAnswerList } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringAnswerList"
import { useScoringDataLoader } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringDataLoader"
import { useScoringEffects } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringEffects"
import { useScoringMainState } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringMainState"
import { useScoringMode } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringMode"
import { useScoringNavigation } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringNavigation"
import { useScoringScope } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringScope"
import { useScoringScreenKeyboard } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringScreenKeyboard"
import { useScoringScreenSettings } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringScreenSettings"
import { useStudentAnswerManagement } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useStudentAnswerManagement"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import { useRouteParams } from "@/hooks/useRouteParams"
import type { QuestionScoreRow } from "@/queries/scoring"

/** 採点行がまだ届いていない設問の空の並び（毎回作り直さない） */
const NO_QUESTION_SCORES: QuestionScoreRow[] = []

interface UseScoringScreenOptions {
  /**
   * AI採点（実験的機能）が今の利用者に解放されているか（`useAiGradingAvailability`）。
   * 解放されていなければ「AI採点」を選んでいても一覧表示として扱う
   */
  isAiGradingAvailable: boolean
}

/**
 * 採点画面（07）の配線。データ・利用者の設定・選択・絞り込み・採点の口・キー操作を
 * つなぎ、画面（`ScoringMainView`）が描くものだけを返す。描き方は画面が持つ。
 *
 * 各フックの返り値のうち、ここで配線にだけ使うものを名前で取り出し、残りは
 * そのまま画面へ渡す（`...rest` で返すものが、画面が描くものである）。
 */
export function useScoringScreen({
  isAiGradingAvailable,
}: UseScoringScreenOptions) {
  const params = useRouteParams()
  const examId = params.examId ?? ""
  const currentUser = useCurrentUser()

  /** 操作モード管理 */
  const {
    scoringOperationMode,
    mouseBrush: chosenMouseBrush,
    mouseScaleLevelId: chosenMouseScaleLevelId,
    ...scoringModeControls
  } = useScoringMode(currentUser.id)
  const effectiveMode = scoringOperationMode ?? "keyboard"

  /** データローダーフック */
  const {
    loading,
    exam,
    studentAnswerImages: loadedStudentAnswerImages,
    cropRegions,
    questionScoresByCropRegionId,
  } = useScoringDataLoader(examId)

  /**
   * 採点担当と匿名採点で扱う範囲を決める。**ここから先は絞った答案だけを扱う**
   * （名前と並びも匿名採点の置き換え済み）
   */
  const {
    studentAnswerImages,
    isEnforcedForMe,
    selectableCropRegions,
    memberCount,
    canDecideScores,
    ...assignmentFilter
  } = useScoringScope({
    examId,
    userId: currentUser.id,
    loadedStudentAnswerImages,
    cropRegions,
  })

  /** 利用者ごとの設定（名前の表示は匿名採点の固定が優先） */
  const { setItemsPerLine, handleToggleStudentNames, ...scoringPreferences } =
    useScoringScreenSettings({ userId: currentUser.id, isEnforcedForMe })

  const [questionChangeVersion, setQuestionChangeVersion] = useState(0)

  /** メイン状態管理 */
  const {
    gradingMode: chosenGradingMode,
    selectedStudentAnswerImageIds,
    currentCropRegionId,
    setGradingMode,
    setSelectedPageImageIds,
    setCurrentCropRegionId,
    replaceSelection,
    manualSelectionVersion,
    ...panelState
  } = useScoringMainState()

  /**
   * 実際に使う採点モード。AI採点を選んだまま同意を取り消した（キーを消した）ときは
   * 一覧表示として扱う。選んだ値は書き換えない（解放し直せばそのまま戻る）
   */
  const gradingMode =
    chosenGradingMode === "ai" && !isAiGradingAvailable
      ? "grid"
      : chosenGradingMode

  /** 現在の設問 */
  const currentCropRegion = cropRegions.find(
    (cropRegion) => cropRegion.id === currentCropRegionId
  )

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
    handleIndividualNextStudent,
    handleIndividualPrevStudent,
    ...studentSwitching
  } = useStudentAnswerManagement({
    studentAnswerImages,
    selectedStudentAnswerImageIds,
    gradingMode,
    currentCropRegion,
    setSelectedPageImageIds,
  })

  /** 採点確定の段への導線と、裁定待ちの件数（裁定そのものは「8. 採点確定」の段） */
  const decisionEntry = useDecisionEntry(
    examId,
    currentUser.id,
    memberCount,
    canDecideScores
  )

  /** 一覧に出す答案（白さの先読み・採点状態での絞り込みと並び・選択） */
  const { setRecentlyScoredAnswers, getGridAnswerData, ...answerList } =
    useScoringAnswerList({
      studentAnswerImages,
      cropRegions,
      questionScoresByCropRegionId,
      currentCropRegionId,
      currentExamPageId: currentCropRegion?.examPageId ?? null,
      currentUserId: currentUser.id,
      selectedStudentAnswerImageIds,
      setSelectedPageImageIds,
      replaceSelection,
      exam,
      gradingMode,
      questionChangeVersion,
      manualSelectionVersion,
      answerSortOrder: scoringPreferences.answerSortOrder,
    })

  const questionNavigation = useScoringNavigation({
    answerSheetsLength: studentAnswerImages.length,
    currentCropRegionId,
    setCurrentCropRegionId,
    selectedStudentAnswerImageIds,
    setSelectedPageImageIds,
    layoutDirection: scoringPreferences.layoutDirection,
    getGridAnswerData,
    effectiveColumns: scoringPreferences.itemsPerLine[0],
    cropRegions: selectableCropRegions,
  })

  /** 今の設問が類型評価なら、その類型と一覧のマスの見せ方 */
  const scaleQuestion = useScaleQuestion({
    examId,
    currentUserId: currentUser.id,
    currentCropRegion,
    questionScores: currentCropRegionId
      ? (questionScoresByCropRegionId.get(currentCropRegionId) ??
        NO_QUESTION_SCORES)
      : NO_QUESTION_SCORES,
  })

  /**
   * マウスモードで効くブラシ。今の設問の方式で効かないブラシ（点の採点の設問の類型・類型方式の設問の
   * 正答など・消えた類型）は「選択」として読み、古い類型や止められる採点を書かない。選んだ値は書き換えない
   */
  const { mouseBrush, mouseScaleLevelId } = effectiveMouseBrushOf({
    mouseBrush: chosenMouseBrush,
    mouseScaleLevelId: chosenMouseScaleLevelId,
    isScaleQuestion: scaleQuestion.isScaleQuestion,
    scaleLevels: scaleQuestion.scaleLevels,
  })

  /**
   * 個別表示で、現在の設問のページが表示中の答案に無いか（判定は個別表示の描画側が持ち、
   * `onCurrentQuestionPageMissingChange` で伝えてくる）。無い間は採点の口を止める。
   * 個別表示を離れると（`AnswerIndividualView` が外れると）false に戻る
   */
  const [isCurrentQuestionPageMissing, setIsCurrentQuestionPageMissing] =
    useState(false)

  const { calculateQuestionProgress, ...guardedScoring } = useGuardedScoring({
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
      scoringBehavior: scoringPreferences.scoringBehavior,
      setRecentlyScoredAnswers,
      getGridAnswerData,
      setSelectedAnswers: setSelectedPageImageIds,
      handleNextStudent: handleIndividualNextStudent,
      handleNextQuestion: questionNavigation.handleNextQuestion,
    },
    clickScoring: {
      clickScoringConfig: scoringPreferences.clickScoringConfig,
      allScoringData: answerList.allScoringData,
      filteredScoringDataIds: answerList.filteredScoringDataIds,
      replaceSelection,
      setGradingMode,
      mouseScaleLevelId,
    },
    currentCropRegion,
    scaleQuestion,
    isCurrentQuestionPageMissing,
  })

  /** 模範解答の表示（トグル／押している間だけ） */
  const masterAnswerVisibility = useMasterAnswerVisibility({
    masterAnswerDisplayMode: scoringPreferences.masterAnswerDisplayMode,
    masterAnswerKeyBehavior: scoringPreferences.masterAnswerKeyBehavior,
    gradingMode,
  })

  /** 用紙サイズと、全ページの模範解答画像（ページ番号順。答案とは examPageId で対応させる） */
  const masterAnswerPages = useMasterAnswerPages(exam?.examPages)

  /** キー操作の文脈・ショートカット・担当外の設問からの退避 */
  useScoringScreenKeyboard({
    gradingMode,
    // AI採点モードでは一覧の選択は見えていない。見えない選択に採点キーを効かせない
    hasSelectedAnswers:
      gradingMode !== "ai" && selectedStudentAnswerImageIds.size > 0,
    partialScoreModalOpen: guardedScoring.showPartialScoreModal,
    scoringOperationMode: effectiveMode,
    currentCropRegionId,
    selectableCropRegions,
    setCurrentCropRegionId,
    itemsPerLine: scoringPreferences.itemsPerLine,
    setItemsPerLine,
    layoutDirection: scoringPreferences.layoutDirection,
    setGradingMode,
    handleIndividualNextStudent,
    handleIndividualPrevStudent,
    handlePartialScoreConfirm: guardedScoring.handlePartialScoreConfirm,
    shortcuts: {
      handleToggleStudentNames,
      handleRefreshFilter: answerList.handleRefreshFilter,
      handleNextQuestion: questionNavigation.handleNextQuestion,
      handlePrevQuestion: questionNavigation.handlePrevQuestion,
      handleGridNavigation: questionNavigation.handleGridNavigation,
      handlePartialScoreInput: guardedScoring.handlePartialScoreInput,
      handlePartialScoreCancel: guardedScoring.handlePartialScoreCancel,
      handlePartialScoreBackspace: guardedScoring.handlePartialScoreBackspace,
      handleScore: guardedScoring.handleBatchScoreWithProgress,
      handleToggleFilter: answerList.handleToggleFilter,
      handleSelectAll: answerList.handleSelectAll,
      handleToggleMasterAnswer: masterAnswerVisibility.handleToggleMasterAnswer,
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

  /** ルーブリック項目のパネルと選択のつなぎ（減点・加点方式の設問だけで使う） */
  const rubricAnswerFlow = useRubricAnswerFlow({
    gradingMode,
    studentAnswerImages,
    selectedStudentAnswerImageIds,
    setSelectedPageImageIds,
    setRecentlyScoredAnswers,
    getGridAnswerData,
    handleIndividualNextStudent,
  })

  return {
    ...scoringModeControls,
    ...assignmentFilter,
    ...scoringPreferences,
    ...panelState,
    ...studentSwitching,
    ...decisionEntry,
    ...answerList,
    ...questionNavigation,
    ...guardedScoring,
    ...masterAnswerVisibility,
    ...masterAnswerPages,
    cropRegions,
    currentCropRegion,
    currentExamStudentId,
    currentUser,
    effectiveMode,
    exam,
    examId,
    gradingMode,
    handleCurrentQuestionPageMissingChange: setIsCurrentQuestionPageMissing,
    isCurrentQuestionPageMissing,
    loading,
    mouseBrush,
    mouseScaleLevelId,
    questionProgress,
    questionScoresByCropRegionId,
    rubricAnswerFlow,
    scaleQuestion,
    selectableCropRegions,
    selectedStudentAnswerImageIds,
    setCurrentCropRegionId,
    setGradingMode,
    studentAnswerImages,
  }
}
