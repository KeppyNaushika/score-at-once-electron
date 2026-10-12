import { useCallback, useMemo, useState } from "react"

import { effectiveSelection } from "@/components/exams/07-score-at-once/ScoringMain/utils/effectiveSelection"

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
  const [chosenIds, setChosenIds] = useState<ReadonlySet<string>>(new Set())
  const selectedIds = useMemo(
    () => effectiveSelection(chosenIds, visibleIds),
    [chosenIds, visibleIds]
  )
  const selectedItems = useMemo(
    () => visibleItems.filter((item) => selectedIds.has(item.id)),
    [visibleItems, selectedIds]
  )
  const singleSelectedItem =
    selectedItems.length === 1 ? selectedItems[0] : null

  const setSelection = useCallback((ids: Set<string>) => {
    setChosenIds(ids)
  }, [])

  /** 選んだ答案を忘れる（設問を移ったとき） */
  const clearSelection = useCallback(() => {
    setChosenIds(new Set())
  }, [])

  const handleSelectAnswer = useCallback(
    (id: string, isSelected: boolean) => {
      // 見えている選択（何も選んでいなければ先頭の答案）から足し引きする。
      // 選んだ答案だけから足すと、Ctrl/Cmd+クリックで先頭の答案が選択から落ちる
      setChosenIds((prev) => {
        const next = effectiveSelection(prev, visibleIds)
        if (isSelected) {
          next.add(id)
        } else {
          next.delete(id)
        }
        return next
      })
    },
    [visibleIds]
  )

  const handleSelectAll = useCallback(() => {
    setChosenIds(new Set(visibleIds))
  }, [visibleIds])

  /** 書いた答案のうち最後の答案の次を選ぶ。最後なら選択はそのまま */
  const selectNextAfter = useCallback(
    (writtenIds: readonly string[]) => {
      const lastIndex = Math.max(
        ...writtenIds.map((id) => visibleIds.indexOf(id))
      )
      const nextId = visibleIds[lastIndex + 1]
      if (nextId) {
        setChosenIds(new Set([nextId]))
      }
    },
    [visibleIds]
  )

  const getGridAnswerData = useCallback(
    () =>
      visibleItems.map((item) => ({
        ...item,
        isSelected: selectedIds.has(item.id),
      })),
    [visibleItems, selectedIds]
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
