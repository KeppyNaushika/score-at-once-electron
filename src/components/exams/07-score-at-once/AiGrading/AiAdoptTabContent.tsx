"use client"

import { Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

import { AiBulkActionsBar } from "./AiBulkActionsBar"
import { AiBulkAnnotationSection } from "./AiBulkAnnotationSection"
import {
  ADOPT_ACTION_LABELS,
  type AdoptKind,
} from "./hooks/useAiSelectionAdoption"
import type { AiGridItem } from "./types"
import type { ReviewedAiGradingAnswer } from "./utils/answerReview"

interface AiAdoptTabContentProps {
  adoptKind: AdoptKind
  examId: string
  cropRegion: QuestionAnswerRegionRow
  pageSize: string
  reviewedAnswers: ReviewedAiGradingAnswer[]
  draftAnnotationsByAttemptId: ReadonlyMap<string, DrawingAnnotation[]>
  selectedCount: number
  /** 選んだ答案に反映する（I と同じ） */
  onAdoptSelected: () => void
  /** 一覧に表示中の答案（絞り込みの後）。採点反映のタブの「全て採用」の対象 */
  visibleItems: readonly AiGridItem[]
  /** 表示中の答案すべての AI の点を採用する */
  onAdoptVisible: (visibleItems: readonly AiGridItem[]) => void
  isAdopting: boolean
}

/**
 * 左パネルの「採点反映」「アノテーション反映」のタブの中身。
 * 選んだ答案への反映（I）と、まとめての反映を、そのタブのもの（点か朱書きか）だけで並べる
 * （採点反映は表示中の答案すべての点の採用、アノテーション反映は朱書きのまとめての反映）
 */
export function AiAdoptTabContent({
  adoptKind,
  examId,
  cropRegion,
  pageSize,
  reviewedAnswers,
  draftAnnotationsByAttemptId,
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
        選んだ {selectedCount} 件の{ADOPT_ACTION_LABELS[adoptKind]}
        <Kbd variant="tiny">I</Kbd>
      </Button>
      {adoptKind === "score" ? (
        <AiBulkActionsBar
          examId={examId}
          cropRegion={cropRegion}
          reviewedAnswers={reviewedAnswers}
          visibleCount={visibleItems.length}
          onAdoptVisible={() => onAdoptVisible(visibleItems)}
          isAdopting={isAdopting}
        />
      ) : (
        <AiBulkAnnotationSection
          examId={examId}
          cropRegion={cropRegion}
          pageSize={pageSize}
          reviewedAnswers={reviewedAnswers}
          draftAnnotationsByAttemptId={draftAnnotationsByAttemptId}
        />
      )}
    </div>
  )
}
