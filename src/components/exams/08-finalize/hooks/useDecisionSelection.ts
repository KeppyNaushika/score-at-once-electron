import { useCallback, useMemo } from "react"

import { useVisibleAnswerSelection } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useVisibleAnswerSelection"

import type { DecisionGridItem } from "./useFinalizeData"

/**
 * 08 の一覧で選んでいる答案。
 *
 * 選択は「利用者が選んだ答案」だけを持ち、表示に残っているものに絞って使う。
 * 何も残らなければ先頭の答案を選んでいるものとする（07 の一覧と同じ）
 */
export function useDecisionSelection(
  visibleItems: readonly DecisionGridItem[],
  visibleIds: readonly string[]
) {
  const {
    selectedIds,
    setSelection,
    handleSelectAnswer,
    handleSelectAll,
    getGridAnswerData,
  } = useVisibleAnswerSelection(visibleItems, visibleIds)
  const selectedItems = useMemo(
    () => visibleItems.filter((item) => selectedIds.has(item.id)),
    [visibleItems, selectedIds]
  )
  const singleSelectedItem =
    selectedItems.length === 1 ? selectedItems[0] : null

  /** 選んだ答案を忘れる（設問を移ったとき） */
  const clearSelection = useCallback(() => {
    setSelection(new Set())
  }, [setSelection])

  /** 書いた答案のうち最後の答案の次を選ぶ。最後なら選択はそのまま */
  const selectNextAfter = useCallback(
    (writtenIds: readonly string[]) => {
      const lastIndex = Math.max(
        ...writtenIds.map((id) => visibleIds.indexOf(id))
      )
      const nextId = visibleIds[lastIndex + 1]
      if (nextId) {
        setSelection(new Set([nextId]))
      }
    },
    [visibleIds, setSelection]
  )

  return {
    selectedIds,
    selectedItems,
    singleSelectedItem,
    setSelection,
    clearSelection,
    handleSelectAnswer,
    handleSelectAll,
    selectNextAfter,
    getGridAnswerData,
  }
}
