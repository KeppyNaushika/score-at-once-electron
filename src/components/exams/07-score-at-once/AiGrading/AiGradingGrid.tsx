"use client"

import { useMemo } from "react"

import AnswerGridView from "@/components/exams/07-score-at-once/ScoringGrid/AnswerGridView"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import { AiProposalChips } from "./AiProposalChips"
import type { AiGridDisplaySettings, AiGridItem } from "./types"
import { toMasterGridItem } from "./utils/aiGridItems"

interface AiGradingGridProps {
  cropRegion: QuestionAnswerRegionRow
  currentUserId: string
  pageSize: string
  display: AiGridDisplaySettings
  /** 絞り込みに残った答案（表示順） */
  visibleItems: AiGridItem[]
  visibleIds: string[]
  selectedIds: Set<string>
  onSelect: (id: string, isSelected: boolean) => void
  onReplaceSelection: (ids: string[]) => void
  /** 設問の答案の数（絞り込む前） */
  totalCount: number
}

/**
 * AI採点モードの中央。**一覧表示と同じ部品・同じ表示の設定**で答案を並べ
 * （先頭に模範解答、色は自分の採点、採用した朱書きもそのまま描く）、
 * 答案の下に AI の提案を出す（8. 採点確定が採点者ごとの結果を出すのと同じ口）
 */
export function AiGradingGrid({
  cropRegion,
  currentUserId,
  pageSize,
  display,
  visibleItems,
  visibleIds,
  selectedIds,
  onSelect,
  onReplaceSelection,
  totalCount,
}: AiGradingGridProps) {
  const masterAnswerData = useMemo(
    () => toMasterGridItem(cropRegion),
    [cropRegion]
  )
  const gridItemById = useMemo(
    () => new Map(visibleItems.map((gridItem) => [gridItem.id, gridItem])),
    [visibleItems]
  )

  if (visibleItems.length === 0) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        {totalCount === 0
          ? "この設問の答案がありません"
          : "この絞り込みで表示する答案はありません。右の「表示」で絞り込みを変えてください"}
      </p>
    )
  }

  return (
    <AnswerGridView
      allScoringData={visibleItems}
      masterAnswerData={masterAnswerData}
      filteredScoringDataIds={visibleIds}
      selectedScoringDataIds={selectedIds}
      onScoringDataSelect={onSelect}
      onScoringDataReplace={onReplaceSelection}
      layoutDirection={display.layoutDirection}
      itemsPerRow={display.itemsPerLine}
      autoScroll={display.autoScroll}
      showStudentNames={display.showStudentNames}
      expandMargin={display.expandMargin}
      currentCropRegion={cropRegion}
      currentUserId={currentUserId}
      annotationRefreshKey={display.annotationRefreshKey}
      pageSize={pageSize}
      proposalStatusOf={(gridAnswer) => {
        const attempt = gridItemById.get(gridAnswer.id)?.reviewedAnswer.review
          .displayedAttempt?.attempt
        return attempt?.state === "succeeded" ? attempt.status : null
      }}
      renderBeforeStatusMark={(gridAnswer) => {
        const gridItem = gridItemById.get(gridAnswer.id)
        return gridItem ? (
          <AiProposalChips
            reviewedAnswer={gridItem.reviewedAnswer}
            points={cropRegion.points}
          />
        ) : null
      }}
      className="p-4"
    />
  )
}
