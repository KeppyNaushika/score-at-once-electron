/**
 * @fileoverview 採点設定フック（統合版）
 * @description 各設定は独立したフックで管理され、このフックは互換性のために統合して返す。
 */

import { useAutoScroll } from "./useAutoScroll"
import { useExpandMargin } from "./useExpandMargin"
import { useItemsPerLine } from "./useItemsPerLine"
import { useLayoutDirection } from "./useLayoutDirection"
import { useMasterAnswerSettings } from "./useMasterAnswerSettings"
import { useShowStudentNames } from "./useShowStudentNames"

export function useScoringSettings() {
  const {
    itemsPerLine,
    setItemsPerLine,
    isLoading: isLoadingItemsPerLine,
  } = useItemsPerLine()
  const {
    autoScroll,
    setAutoScroll,
    isLoading: isLoadingAutoScroll,
  } = useAutoScroll()
  const {
    showStudentNames,
    setShowStudentNames,
    isLoading: isLoadingShowStudentNames,
  } = useShowStudentNames()
  const {
    layoutDirection,
    setLayoutDirection,
    isLoading: isLoadingLayoutDirection,
  } = useLayoutDirection()
  const {
    expandMargin,
    setExpandMargin,
    isLoading: isLoadingExpandMargin,
  } = useExpandMargin()
  const {
    masterAnswerDisplayMode,
    masterAnswerOpacity,
    masterAnswerKeyBehavior,
    setMasterAnswerDisplayMode,
    setMasterAnswerOpacity,
    setMasterAnswerKeyBehavior,
    isLoading: isLoadingMasterAnswer,
  } = useMasterAnswerSettings()

  const isLoading =
    isLoadingItemsPerLine ||
    isLoadingAutoScroll ||
    isLoadingShowStudentNames ||
    isLoadingLayoutDirection ||
    isLoadingExpandMargin ||
    isLoadingMasterAnswer

  return {
    itemsPerLine,
    autoScroll,
    showStudentNames,
    layoutDirection,
    expandMargin,
    masterAnswerDisplayMode,
    masterAnswerOpacity,
    masterAnswerKeyBehavior,
    setItemsPerLine,
    setAutoScroll,
    setShowStudentNames,
    setLayoutDirection,
    setExpandMargin,
    setMasterAnswerDisplayMode,
    setMasterAnswerOpacity,
    setMasterAnswerKeyBehavior,
    isLoading,
  }
}

// 個別フックも再エクスポート
export { useAutoScroll } from "./useAutoScroll"
export { useExpandMargin } from "./useExpandMargin"
export { useItemsPerLine } from "./useItemsPerLine"
export { useLayoutDirection } from "./useLayoutDirection"
export { useMasterAnswerSettings } from "./useMasterAnswerSettings"
export { useShowStudentNames } from "./useShowStudentNames"
