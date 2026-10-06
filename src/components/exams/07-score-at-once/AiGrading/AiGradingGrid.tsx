"use client"

import { useMemo } from "react"

import AnswerGridView from "@/components/exams/07-score-at-once/ScoringGrid/AnswerGridView"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

import { AiBlanknessBadge } from "./AiBlanknessBadge"
import { AiProposalChips } from "./AiProposalChips"
import type { AiGridDisplaySettings, AiGridItem } from "./types"
import { toMasterGridItem } from "./utils/aiGridItems"
import { pendingAnnotationsOfAnswer } from "./utils/selectionAdoption"

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
  /** 試行の id → 教員が直した朱書きの下書き（未反映の朱書きを、直した形で見せる） */
  draftAnnotationsByAttemptId: ReadonlyMap<string, readonly DrawingAnnotation[]>
}

/**
 * AI採点モードの中央。**一覧表示と同じ部品・同じ表示の設定**で答案を並べ
 * （先頭に模範解答、色は自分の採点、採用した朱書きもそのまま描く。未反映の AI の朱書きも重ねる）、
 * 答案の下に AI の提案を出す（8. 採点確定が採点者ごとの結果を出すのと同じ口）。
 * インク率で白紙・境界帯と測った答案には、提案の札の左に「白紙」の印を出す
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
  draftAnnotationsByAttemptId,
}: AiGradingGridProps) {
  const masterAnswerData = useMemo(
    () => toMasterGridItem(cropRegion),
    [cropRegion]
  )
  const gridItemById = useMemo(
    () => new Map(visibleItems.map((gridItem) => [gridItem.id, gridItem])),
    [visibleItems]
  )

  // まだ反映していない朱書き（反映したらこの形で書かれる）を、保存した注釈に重ねて見せる。
  // まとめて反映する前に中身を一覧で確かめられるように
  const pendingAnnotationsById = useMemo(
    () =>
      new Map(
        visibleItems.map((gridItem) => [
          gridItem.id,
          pendingAnnotationsOfAnswer(gridItem.reviewedAnswer, {
            cropRegion,
            pageSize,
            draftAnnotationsByAttemptId,
          }),
        ])
      ),
    [visibleItems, cropRegion, pageSize, draftAnnotationsByAttemptId]
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
          pendingAnnotationsOf={(gridAnswer) =>
            pendingAnnotationsById.get(gridAnswer.id) ?? []
          }
          renderBeforeStatusMark={(gridAnswer) => {
            const gridItem = gridItemById.get(gridAnswer.id)
            return gridItem ? (
              <>
                <AiBlanknessBadge
                  inkMeasurement={gridItem.reviewedAnswer.answer.inkMeasurement}
                />
                <AiProposalChips
                  reviewedAnswer={gridItem.reviewedAnswer}
                  points={cropRegion.points}
                />
              </>
            ) : null
          }}
          className="p-4"
        />
      </div>
    </div>
  )
}
