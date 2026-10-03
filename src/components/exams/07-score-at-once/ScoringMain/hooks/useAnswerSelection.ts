import { useCallback } from "react"

import type { ScoringData } from "@/components/exams/07-score-at-once/types"

interface UseAnswerSelectionOptions {
  allScoringData: ScoringData[]
  filteredScoringDataIds: string[]
  /** 未採点の表示フィルタが入っているか */
  filterSettings: { unscored: boolean }
  handleToggleFilter: (key: string) => void
  replaceSelection: (answerIds: string[]) => void
}

/** 答案の選択（置き換え・表示中を全選択・未採点を全選択） */
export function useAnswerSelection({
  allScoringData,
  filteredScoringDataIds,
  filterSettings,
  handleToggleFilter,
  replaceSelection,
}: UseAnswerSelectionOptions) {
  const handleReplaceSelection = useCallback(
    (answerIds: string[]) => {
      replaceSelection(answerIds)
    },
    [replaceSelection]
  )

  /** 全選択：表示中（フィルタ適用後）の答案をすべて選択 */
  const handleSelectAll = useCallback(() => {
    replaceSelection(filteredScoringDataIds)
  }, [replaceSelection, filteredScoringDataIds])

  /** 未採点の生徒を全て選択（フィルターで非表示なら強制表示） */
  const handleSelectUnscored = useCallback(() => {
    // 未採点フィルターが無効なら有効にする
    if (!filterSettings.unscored) {
      handleToggleFilter("unscored")
    }
    // 次のレンダー後に選択するためqueueMicrotaskで遅延
    queueMicrotask(() => {
      const unscoredIds = allScoringData
        .filter((scoringData) => scoringData.status === "unscored")
        .map((scoringData) => scoringData.id)
      replaceSelection(unscoredIds)
    })
  }, [allScoringData, replaceSelection, filterSettings, handleToggleFilter])

  return { handleReplaceSelection, handleSelectAll, handleSelectUnscored }
}
