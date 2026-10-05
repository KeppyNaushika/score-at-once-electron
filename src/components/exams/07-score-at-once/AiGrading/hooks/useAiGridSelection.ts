import { useCallback, useMemo, useState } from "react"

import { useScoringNavigation } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringNavigation"
import type { LayoutDirection } from "@/components/exams/07-score-at-once/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import {
  ALL_STATUSES_VISIBLE,
  type FilterBasis,
  isShownByFilter,
  type StatusFilterSettings,
} from "../utils/aiGridFilter"
import { toAiGridItem } from "../utils/aiGridItems"
import type { ReviewedAiGradingAnswer } from "../utils/answerReview"
import { useAiGridShortcuts } from "./useAiGradingShortcuts"

interface UseAiGridSelectionOptions {
  cropRegion: QuestionAnswerRegionRow
  reviewedAnswers: ReviewedAiGradingAnswer[]
  layoutDirection: LayoutDirection
  itemsPerLine: number[]
}

/**
 * AI採点モードの一覧の絞り込み・選択・移動（8. 採点確定と同じ作り）。
 *
 * 選択は利用者が選んだ答案だけを持ち、表示に残っているものに絞って使う。
 * 何も残らなければ先頭の答案を選んでいるものとする（一覧表示と同じ）。
 * 作業場は設問ごとに作り直されるので、ここの状態は設問1つぶん
 */
export function useAiGridSelection({
  cropRegion,
  reviewedAnswers,
  layoutDirection,
  itemsPerLine,
}: UseAiGridSelectionOptions) {
  const [filterSettings, setFilterSettings] =
    useState<StatusFilterSettings>(ALL_STATUSES_VISIBLE)
  const [filterBasis, setFilterBasis] = useState<FilterBasis>("ai")
  /**
   * 採用したばかりの答案。絞り込みから外れても、R（更新）か絞り込みを変えるまでは
   * 一覧に残す（一覧表示の「採点したばかりの答案」と同じ。押した答案が目の前から
   * 消えると、何を採用したかを確かめられない）
   */
  const [recentlyAdoptedIds, setRecentlyAdoptedIds] = useState<
    ReadonlySet<string>
  >(new Set())
  const [chosenIds, setChosenIds] = useState<ReadonlySet<string>>(new Set())

  const gridItems = useMemo(
    () =>
      reviewedAnswers.map((reviewedAnswer) =>
        toAiGridItem(reviewedAnswer, cropRegion)
      ),
    [reviewedAnswers, cropRegion]
  )
  const visibleItems = useMemo(
    () =>
      gridItems.filter(
        (gridItem) =>
          recentlyAdoptedIds.has(gridItem.id) ||
          isShownByFilter(gridItem.reviewedAnswer, filterSettings, filterBasis)
      ),
    [gridItems, recentlyAdoptedIds, filterSettings, filterBasis]
  )
  const visibleIds = useMemo(
    () => visibleItems.map((gridItem) => gridItem.id),
    [visibleItems]
  )

  const selectedIds = useMemo(() => {
    const stillVisible = visibleIds.filter((id) => chosenIds.has(id))
    return new Set(
      stillVisible.length > 0 ? stillVisible : visibleIds.slice(0, 1)
    )
  }, [chosenIds, visibleIds])
  const selectedItems = useMemo(
    () => visibleItems.filter((gridItem) => selectedIds.has(gridItem.id)),
    [visibleItems, selectedIds]
  )
  const singleSelectedItem =
    selectedItems.length === 1 ? selectedItems[0] : null

  const setSelection = useCallback((ids: Set<string>) => {
    setChosenIds(ids)
  }, [])
  const handleSelectAnswer = useCallback((id: string, isSelected: boolean) => {
    setChosenIds((prev) => {
      const next = new Set(prev)
      if (isSelected) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }, [])
  const handleSelectAll = useCallback(() => {
    setChosenIds(new Set(visibleIds))
  }, [visibleIds])

  const toggleFilter = useCallback((status: ScoringStatus) => {
    setFilterSettings((prev) => ({ ...prev, [status]: !prev[status] }))
    setRecentlyAdoptedIds(new Set())
  }, [])
  const changeFilterBasis = useCallback((basis: FilterBasis) => {
    setFilterBasis(basis)
    setRecentlyAdoptedIds(new Set())
  }, [])
  const refresh = useCallback(() => {
    setRecentlyAdoptedIds(new Set())
  }, [])
  const markAdopted = useCallback((ids: readonly string[]) => {
    setRecentlyAdoptedIds((prev) => new Set([...prev, ...ids]))
  }, [])

  const getGridAnswerData = useCallback(
    () =>
      visibleItems.map((gridItem) => ({
        ...gridItem,
        isSelected: selectedIds.has(gridItem.id),
      })),
    [visibleItems, selectedIds]
  )
  // 設問の移動は採点画面が受け持つので、ここでは一覧の中の移動だけを使う
  const { handleGridNavigation } = useScoringNavigation({
    answerSheetsLength: visibleItems.length,
    currentCropRegionId: cropRegion.id,
    setCurrentCropRegionId: () => undefined,
    selectedStudentAnswerImageIds: selectedIds,
    setSelectedPageImageIds: setSelection,
    layoutDirection,
    getGridAnswerData,
    effectiveColumns: itemsPerLine[0],
  })

  useAiGridShortcuts({
    onGridNavigation: handleGridNavigation,
    onSelectAll: handleSelectAll,
    onToggleFilter: toggleFilter,
    onRefresh: refresh,
  })

  return {
    gridItems,
    visibleItems,
    visibleIds,
    selectedIds,
    selectedItems,
    singleSelectedItem,
    setSelection,
    handleSelectAnswer,
    filterSettings,
    toggleFilter,
    filterBasis,
    changeFilterBasis,
    markAdopted,
  }
}
