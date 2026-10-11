import { useCallback, useMemo, useState } from "react"

import { useScoringNavigation } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringNavigation"
import { effectiveSelection } from "@/components/exams/07-score-at-once/ScoringMain/utils/effectiveSelection"
import { findNextAnswerIdAfterScoring } from "@/components/exams/07-score-at-once/ScoringMain/utils/nextAnswerAfterScoring"
import type { LayoutDirection } from "@/components/exams/07-score-at-once/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import type { AiGridViewSettings } from "../types"
import { type FilterSource, isShownByFilter } from "../utils/aiGridFilter"
import { toAiGridItem } from "../utils/aiGridItems"
import type { ReviewedAiGradingAnswer } from "../utils/answerReview"
import { useAiGridShortcuts } from "./useAiGradingShortcuts"

interface UseAiGridSelectionOptions {
  cropRegion: QuestionAnswerRegionRow
  reviewedAnswers: ReviewedAiGradingAnswer[]
  layoutDirection: LayoutDirection
  itemsPerLine: number[]
  /** 絞り込み（設問をまたいで残すので、AI採点モードの根から受け取る） */
  viewSettings: Pick<AiGridViewSettings, "filterSettings" | "setFilterSettings">
  /**
   * 一覧をこの答案（受験者）だけに、この順で絞る（問いかけている問いの答案を確信度の低い順に
   * 見せるとき）。絞り込みと並べ方より優先する。絞らないなら null
   */
  pinnedExamStudentIds?: readonly string[] | null
}

/**
 * AI採点モードの一覧の絞り込み・選択・移動（8. 採点確定と同じ作り）。
 *
 * 選択は利用者が選んだ答案だけを持ち、表示に残っているものに絞って使う。
 * 何も残らなければ先頭の答案を選んでいるものとする（一覧表示と同じ）。
 * 作業場は設問ごとに作り直されるので、ここの状態（選択・残して表示する答案）は設問1つぶん。
 * 絞り込みは設問をまたいで残すので、ここでは持たずに受け取る
 */
export function useAiGridSelection({
  cropRegion,
  reviewedAnswers,
  layoutDirection,
  itemsPerLine,
  viewSettings: { filterSettings, setFilterSettings },
  pinnedExamStudentIds = null,
}: UseAiGridSelectionOptions) {
  /**
   * 絞り込みによらず一覧に残す答案。R（更新）か絞り込みを変えるまで残す。
   * 採用・採点したばかりの答案（一覧表示の「採点したばかりの答案」と同じ。押した答案が
   * 目の前から消えると、何を採用したかを確かめられない）
   */
  const [keptVisibleIds, setKeptVisibleIds] = useState<ReadonlySet<string>>(
    new Set()
  )
  const [chosenIds, setChosenIds] = useState<ReadonlySet<string>>(new Set())

  const gridItems = useMemo(
    () =>
      reviewedAnswers.map((reviewedAnswer) =>
        toAiGridItem(reviewedAnswer, cropRegion)
      ),
    [reviewedAnswers, cropRegion]
  )
  const visibleItems = useMemo(() => {
    if (pinnedExamStudentIds) {
      const gridItemById = new Map(
        gridItems.map((gridItem) => [gridItem.id, gridItem])
      )
      return pinnedExamStudentIds.flatMap((examStudentId) => {
        const gridItem = gridItemById.get(examStudentId)
        return gridItem ? [gridItem] : []
      })
    }
    return gridItems.filter(
      (gridItem) =>
        keptVisibleIds.has(gridItem.id) ||
        isShownByFilter(gridItem.reviewedAnswer, filterSettings)
    )
  }, [gridItems, keptVisibleIds, filterSettings, pinnedExamStudentIds])
  const visibleIds = useMemo(
    () => visibleItems.map((gridItem) => gridItem.id),
    [visibleItems]
  )

  const selectedIds = useMemo(
    () => effectiveSelection(chosenIds, visibleIds),
    [chosenIds, visibleIds]
  )
  const selectedItems = useMemo(
    () => visibleItems.filter((gridItem) => selectedIds.has(gridItem.id)),
    [visibleItems, selectedIds]
  )
  const singleSelectedItem =
    selectedItems.length === 1 ? selectedItems[0] : null

  const setSelection = useCallback((ids: Set<string>) => {
    setChosenIds(ids)
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

  const toggleFilter = useCallback(
    (source: FilterSource, status: ScoringStatus) => {
      setFilterSettings((prev) => ({
        ...prev,
        [source]: { ...prev[source], [status]: !prev[source][status] },
      }))
      setKeptVisibleIds(new Set())
    },
    [setFilterSettings]
  )
  const refresh = useCallback(() => {
    setKeptVisibleIds(new Set())
  }, [])
  const markAdopted = useCallback((ids: readonly string[]) => {
    setKeptVisibleIds((prev) => new Set([...prev, ...ids]))
  }, [])
  /**
   * 自分で採点した答案を残し、選択を次の答案へ移す（一覧表示の採点と同じ規則。
   * 末尾まで来ていれば選択はそのまま）。
   *
   * 次の答案は、この描画の並び＝**書き込む前の並び**で決める。採点した答案が絞り込みから
   * 外れて並びが詰まっても、決めた答案を id で選んでいるのでずれない
   */
  const markScored = useCallback(
    (ids: readonly string[]) => {
      markAdopted(ids)
      const nextId = findNextAnswerIdAfterScoring(visibleIds, new Set(ids))
      if (nextId) setChosenIds(new Set([nextId]))
    },
    [markAdopted, visibleIds]
  )

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
    markAdopted,
    markScored,
  }
}
