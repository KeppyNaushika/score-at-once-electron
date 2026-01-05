/**
 * @fileoverview 採点設定フック（統合版）
 * @description 機能G: ユーザー採点設定の永続化
 *
 * 各設定は独立したフックで管理され、このフックは互換性のために統合して返す。
 * 楽観的更新時のレースコンディションを防ぐため、各設定は独立したstateを持つ。
 */

import { useItemsPerLine } from "./useItemsPerLine"
import { useAutoScroll } from "./useAutoScroll"
import { useShowStudentNames } from "./useShowStudentNames"
import { useLayoutDirection } from "./useLayoutDirection"
import { useExpandMargin } from "./useExpandMargin"

/**
 * 全採点設定を統合して返すフック
 * @description 各設定は独立したフックで管理されるため、競合なく楽観的更新が可能
 * @returns itemsPerLine - 1行あたりの表示件数（配列形式）
 * @returns autoScroll - 自動スクロール設定
 * @returns showStudentNames - 生徒名表示設定
 * @returns layoutDirection - レイアウト方向
 * @returns expandMargin - 表示領域拡張率
 * @returns setItemsPerLine - 表示件数更新関数
 * @returns setAutoScroll - 自動スクロール更新関数
 * @returns setShowStudentNames - 生徒名表示更新関数
 * @returns setLayoutDirection - レイアウト方向更新関数
 * @returns setExpandMargin - 拡張率更新関数
 * @returns isLoading - いずれかの設定が読み込み中かどうか
 */
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

  const isLoading =
    isLoadingItemsPerLine ||
    isLoadingAutoScroll ||
    isLoadingShowStudentNames ||
    isLoadingLayoutDirection ||
    isLoadingExpandMargin

  return {
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
    isLoading,
  }
}

// 個別フックも再エクスポート
export { useItemsPerLine } from "./useItemsPerLine"
export { useAutoScroll } from "./useAutoScroll"
export { useShowStudentNames } from "./useShowStudentNames"
export { useLayoutDirection } from "./useLayoutDirection"
export { useExpandMargin } from "./useExpandMargin"
