/**
 * @fileoverview 採点設定フック（統合版）
 * @description 各設定は独立したフックで管理され、このフックは互換性のために統合して返す。
 */

import { useAnswerSortOrder } from "./useAnswerSortOrder"
import { useAutoScroll } from "./useAutoScroll"
import { useClickScoringConfig } from "./useClickScoringConfig"
import { useExpandMargin } from "./useExpandMargin"
import { useItemsPerLine } from "./useItemsPerLine"
import { useLayoutDirection } from "./useLayoutDirection"
import { useMasterAnswerSettings } from "./useMasterAnswerSettings"
import { useShowStudentNames } from "./useShowStudentNames"

/** 各種採点設定フックを統合し、採点画面全体の設定を一括提供するフック */
export function useScoringSettings() {
  const { itemsPerLine, setItemsPerLine } = useItemsPerLine()
  const { autoScroll, setAutoScroll } = useAutoScroll()
  const { showStudentNames, setShowStudentNames } = useShowStudentNames()
  const { layoutDirection, setLayoutDirection } = useLayoutDirection()
  const { answerSortOrder, setAnswerSortOrder } = useAnswerSortOrder()
  const { expandMargin, setExpandMargin } = useExpandMargin()
  const {
    clickScoringConfig,
    clickScoringDebounceMs,
    setClickAction,
    setClickScoringDebounceMs,
  } = useClickScoringConfig()
  const {
    masterAnswerDisplayMode,
    masterAnswerOpacity,
    masterAnswerKeyBehavior,
    setMasterAnswerDisplayMode,
    setMasterAnswerOpacity,
    setMasterAnswerKeyBehavior,
  } = useMasterAnswerSettings()

  return {
    itemsPerLine,
    autoScroll,
    showStudentNames,
    layoutDirection,
    answerSortOrder,
    expandMargin,
    clickScoringConfig,
    clickScoringDebounceMs,
    masterAnswerDisplayMode,
    masterAnswerOpacity,
    masterAnswerKeyBehavior,
    setItemsPerLine,
    setAutoScroll,
    setShowStudentNames,
    setLayoutDirection,
    setAnswerSortOrder,
    setExpandMargin,
    setClickAction,
    setClickScoringDebounceMs,
    setMasterAnswerDisplayMode,
    setMasterAnswerOpacity,
    setMasterAnswerKeyBehavior,
  }
}
