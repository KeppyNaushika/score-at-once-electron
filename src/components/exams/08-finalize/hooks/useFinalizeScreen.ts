import { useCallback, useState } from "react"

import { useGradeLock } from "@/components/common/grade-lock/GradeLockProvider"
import { useGridZoom } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useGridZoom"
import { useScoringNavigation } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringNavigation"
import { useScoringPreferences } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringPreferences"
import { useCurrentUser } from "@/contexts/CurrentUserContext"

import { useDecisionComment } from "./useDecisionComment"
import { useDecisionCommit } from "./useDecisionCommit"
import { useDecisionGridItems } from "./useDecisionGridItems"
import { useDecisionKeys } from "./useDecisionKeys"
import { useDecisionSelection } from "./useDecisionSelection"
import { useFinalizeData } from "./useFinalizeData"
import { useFinalizeScaleQuestion } from "./useFinalizeScaleQuestion"

/**
 * 「8. 採点確定」の画面の状態と操作。
 *
 * 07 と同じ部品（一覧・移動・部分点の入力・表示の設定）を、裁定サマリの上で回す。
 * **判定キーを押した時点で確定を書き、次の答案へ進む**（07 の採点と同じ手触り）。
 * 確定は上書きできるので、確定済みの答案もそのまま選んで確定し直せる。
 *
 * 中身は役割ごとのフックに分けてあり、ここはそれらをつなぐだけ:
 * 一覧に並べる答案（`useDecisionGridItems`）・選択（`useDecisionSelection`）・
 * 覚え書き（`useDecisionComment`）・確定の書き込み（`useDecisionCommit`）・
 * 部分点と数字キー（`useDecisionKeys`）
 */
export function useFinalizeScreen(examId: string) {
  const currentUser = useCurrentUser()
  const [selectedCropRegionId, setSelectedCropRegionId] = useState<
    string | null
  >(null)

  const data = useFinalizeData(examId, currentUser.id, selectedCropRegionId)
  const {
    summary,
    currentCropRegionId,
    currentCropRegion,
    gridItems,
    decisionCropRegions,
  } = data

  // 成績算出が使う試験は試験ごとロックされる（layout）。ロック中は確定させない
  const { locked } = useGradeLock()
  const canDecide = summary?.canDecide ?? false
  const editable = canDecide && !locked
  /** 確定できないときの理由（できるなら null） */
  const readOnlyReason = !canDecide
    ? "採点結果の確定は試験の所有者（OWNER）のみが行えます"
    : locked
      ? "成績算出で使われているため確定できません"
      : null

  // 類型評価の設問は、正答・誤答・部分点の代わりに類型を選んで確定する（§4-8-5）
  const { scaleQuestion, scaleAppearanceOfVerdict } = useFinalizeScaleQuestion(
    examId,
    currentCropRegion
  )

  const { scoringSettings } = useScoringPreferences(currentUser.id)
  const zoom = useGridZoom(
    scoringSettings.itemsPerLine,
    scoringSettings.setItemsPerLine
  )

  const {
    filterSettings,
    handleToggleFilter,
    displayedItems,
    visibleItems,
    visibleIds,
    scaleAppearanceOf,
    showWrittenDecisions,
    forgetRecentlyDecided,
  } = useDecisionGridItems({
    summary,
    currentCropRegionId,
    gridItems,
    scaleLevels: scaleQuestion.scaleLevels,
    scaleAppearanceOfVerdict,
  })

  const {
    selectedIds,
    selectedItems,
    singleSelectedItem,
    setSelection,
    clearSelection,
    handleSelectAnswer,
    handleSelectAll,
    selectNextAfter,
    getGridAnswerData,
  } = useDecisionSelection(visibleItems, visibleIds)

  const changeQuestion = useCallback(
    (cropRegionId: string | null) => {
      setSelectedCropRegionId(cropRegionId)
      clearSelection()
    },
    [clearSelection]
  )

  const { handleNextQuestion, handlePrevQuestion, handleGridNavigation } =
    useScoringNavigation({
      answerSheetsLength: visibleItems.length,
      currentCropRegionId,
      setCurrentCropRegionId: changeQuestion,
      selectedStudentAnswerImageIds: selectedIds,
      setSelectedPageImageIds: setSelection,
      layoutDirection: scoringSettings.layoutDirection,
      getGridAnswerData,
      effectiveColumns: scoringSettings.itemsPerLine[0],
      cropRegions: decisionCropRegions,
    })

  const { decisionComment, changeDecisionComment, saveDecisionComment } =
    useDecisionComment({
      examId,
      currentUserId: currentUser.id,
      currentCropRegionId,
      singleSelectedItem,
      readOnlyReason,
    })

  const { decide, decideScaleLevel } = useDecisionCommit({
    examId,
    currentUserId: currentUser.id,
    currentCropRegionId,
    isScaleQuestion: scaleQuestion.isScaleQuestion,
    readOnlyReason,
    selectedItems,
    singleSelectedItem,
    decisionComment,
    showWrittenDecisions,
    selectNextAfter,
  })

  const {
    partialScore,
    openPartialScoreModal,
    openPendingInput,
    handleDigitKey,
  } = useDecisionKeys({
    selectedIds,
    currentCropRegion,
    scaleQuestion,
    decide,
    decideScaleLevel,
  })

  const handleRefresh = useCallback(() => {
    forgetRecentlyDecided()
    void data.refresh()
  }, [forgetRecentlyDecided, data])

  return {
    ...data,
    scoringSettings,
    zoom,
    editable,
    readOnlyReason,
    filterSettings,
    handleToggleFilter,
    handleRefresh,
    handleSelectAll,
    displayedItems,
    visibleItems,
    visibleIds,
    selectedIds,
    selectedItems,
    singleSelectedItem,
    handleSelectAnswer,
    setSelection,
    changeQuestion,
    handleNextQuestion,
    handlePrevQuestion,
    handleGridNavigation,
    decide,
    decideScaleLevel,
    openPartialScoreModal,
    openPendingInput,
    handleDigitKey,
    scaleQuestion,
    scaleAppearanceOfVerdict,
    scaleAppearanceOf,
    decisionComment,
    changeDecisionComment,
    saveDecisionComment,
    partialScore,
  }
}
