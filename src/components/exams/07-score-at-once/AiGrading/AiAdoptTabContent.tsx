"use client"

import { Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import { AiBulkActionsBar } from "./AiBulkActionsBar"
import type { AiGridItem } from "./types"
import type { ReviewedAiGradingAnswer } from "./utils/answerReview"

interface AiAdoptTabContentProps {
  examId: string
  cropRegion: QuestionAnswerRegionRow
  reviewedAnswers: ReviewedAiGradingAnswer[]
  selectedCount: number
  /** 選んだ答案の点を採用する（I と同じ） */
  onAdoptSelected: () => void
  /** 一覧に表示中の答案（絞り込みの後）。「全て採用」の対象 */
  visibleItems: readonly AiGridItem[]
  /** 表示中の答案すべての AI の点を採用する */
  onAdoptVisible: (visibleItems: readonly AiGridItem[]) => void
  isAdopting: boolean
}

/**
 * 左パネルの「採点反映」のタブの頭。選んだ答案の点の採用（I）と、まとめての操作
 * （表示中の答案すべての点の採用・古い判定を消す）を並べる
 */
export function AiAdoptTabContent({
  examId,
  cropRegion,
  reviewedAnswers,
  selectedCount,
  onAdoptSelected,
  visibleItems,
  onAdoptVisible,
  isAdopting,
}: AiAdoptTabContentProps) {
  return (
    <div className="space-y-3 py-3">
      <Button
        className="w-full"
        size="sm"
        onClick={onAdoptSelected}
        disabled={selectedCount === 0 || isAdopting}
      >
        <Check className="h-4 w-4" />
        選んだ {selectedCount} 件の点を採用
        <Kbd variant="tiny">I</Kbd>
      </Button>
      <AiBulkActionsBar
        examId={examId}
        cropRegion={cropRegion}
        reviewedAnswers={reviewedAnswers}
        visibleCount={visibleItems.length}
        onAdoptVisible={() => onAdoptVisible(visibleItems)}
        isAdopting={isAdopting}
      />
    </div>
  )
}
