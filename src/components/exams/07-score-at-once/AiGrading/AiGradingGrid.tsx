"use client"

import { useMemo } from "react"

import AnswerGridView from "@/components/exams/07-score-at-once/ScoringGrid/AnswerGridView"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { ScoringStatus } from "@/types/scoringStatus.types"

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
  /**
   * 確定すると付く予定の状態（問いかけの下書き。受験者 → 状態）。そのマスに斜線を重ねる。
   * 問いかけのタブでなければ渡さない
   */
  draftStatusByExamStudentId?: ReadonlyMap<string, ScoringStatus>
}

/**
 * AI採点モードの中央。**一覧表示と同じ部品・同じ表示の設定**で答案を並べ
 * （先頭に模範解答、色は自分の採点、保存した注釈もそのまま描く）、
 * 答案の下に AI の提案を出す（8. 採点確定が採点者ごとの結果を出すのと同じ口）。
 * 問いかけのタブでは、確定すると付く予定の点を同じ斜線で重ねる（新しい印は足さない）
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
  draftStatusByExamStudentId,
}: AiGradingGridProps) {
  const masterAnswerData = useMemo(
    () => toMasterGridItem(cropRegion),
    [cropRegion]
  )
  const gridItemById = useMemo(
    () => new Map(visibleItems.map((gridItem) => [gridItem.id, gridItem])),
    [visibleItems]
  )

  // 模範解答は絞り込みに関係なく常に先頭に出す（答案が0件でも一覧は描く）
  return (
    <div className="flex h-full min-h-0 flex-col">
      {totalCount === 0 && (
        <p className="shrink-0 border-b px-4 py-2 text-sm text-muted-foreground">
          この設問の答案がありません
        </p>
      )}
      <div className="min-h-0 flex-1">
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
            const attempt = gridItemById.get(gridAnswer.id)?.reviewedAnswer
              .review.displayedAttempt?.attempt
            return attempt?.state === "succeeded" ? attempt.status : null
          }}
          draftStatusOf={(gridAnswer) =>
            draftStatusByExamStudentId?.get(gridAnswer.examStudentId) ?? null
          }
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
      </div>
    </div>
  )
}
