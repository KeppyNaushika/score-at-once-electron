"use client"

import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"

import { DEFAULT_DRAWING_SETTINGS } from "@/components/exams/07-score-at-once/ScoringIndividual/constants/drawingConstants"
import {
  adoptAiGradingAttemptsMutation,
  adoptBlankAnswersMutation,
} from "@/queries/aiGrading"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import { AiDeleteOldAttemptsButton } from "./AiDeleteOldAttemptsButton"
import { ConfirmActionButton } from "./ConfirmActionButton"
import {
  buildAdoption,
  placeAdoptionAnnotation,
} from "./utils/adoptionAnnotation"
import type { ReviewedAiGradingAnswer } from "./utils/answerReview"
import { isScored } from "./utils/scoreComparison"

interface AiBulkActionsBarProps {
  examId: string
  cropRegion: QuestionAnswerRegionRow
  pageSize: string
  reviewedAnswers: ReviewedAiGradingAnswer[]
}

/**
 * まとめての操作。採用（要確認の理由が無いものだけ）・白紙を無答に・古い判定を消す。
 * どれも件数を先に見せ、確かめてから書く
 */
export function AiBulkActionsBar({
  examId,
  cropRegion,
  pageSize,
  reviewedAnswers,
}: AiBulkActionsBarProps) {
  const adoptAttempts = useMutation(
    adoptAiGradingAttemptsMutation(examId, cropRegion.id)
  )
  const adoptBlanks = useMutation(
    adoptBlankAnswersMutation(examId, cropRegion.id)
  )

  const bulkAdoptableAnswers = reviewedAnswers.filter(
    (reviewedAnswer) => reviewedAnswer.review.isBulkAdoptable
  )
  // 白紙はその場のインク率だけで決める（境界帯・測れなかった答案は含めない）
  const blankUnscoredAnswers = reviewedAnswers.filter(
    (reviewedAnswer) =>
      reviewedAnswer.answer.inkMeasurement?.blankness === "blank" &&
      !isScored(reviewedAnswer.answer.questionScore)
  )

  const handleBulkAdopt = () => {
    const adoptions = bulkAdoptableAnswers.flatMap((reviewedAnswer) => {
      const displayedAttempt = reviewedAnswer.review.displayedAttempt
      if (!displayedAttempt) return []
      const placement = placeAdoptionAnnotation({
        annotationText: displayedAttempt.attempt.annotationText,
        inkGrid: reviewedAnswer.answer.inkMeasurement?.inkGrid ?? null,
        region: cropRegion,
        pageSize,
        fontSizeMm: DEFAULT_DRAWING_SETTINGS.fontSize,
      })
      return [buildAdoption(displayedAttempt.attempt.id, placement)]
    })
    adoptAttempts.mutate(
      { adoptions, overwrite: false },
      {
        onSuccess: (results) => {
          const adoptedCount = results.filter(
            (result) => result.outcome === "adopted"
          ).length
          toast.success(`AI の判定を${adoptedCount}件採用しました`)
        },
      }
    )
  }

  const handleAdoptBlanks = () => {
    adoptBlanks.mutate(
      {
        cropRegionId: cropRegion.id,
        examStudentIds: blankUnscoredAnswers.map(
          (reviewedAnswer) =>
            reviewedAnswer.answer.studentAnswerImage.examStudentId
        ),
        overwrite: false,
      },
      {
        onSuccess: (results) => {
          const adoptedCount = results.filter(
            (result) => result.outcome === "adopted"
          ).length
          toast.success(`白紙の答案${adoptedCount}件を無答にしました`)
        },
      }
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-3 py-1.5">
      <ConfirmActionButton
        label={`確認不要の判定を採用（${bulkAdoptableAnswers.length}件）`}
        title="AI の判定をまとめて採用しますか"
        description={`成功・確信度が高い・はみ出しや食い違いの無い判定のうち、自分がまだ採点していない ${bulkAdoptableAnswers.length} 件を、自分の採点として書きます。`}
        confirmLabel="採用する"
        disabled={bulkAdoptableAnswers.length === 0 || adoptAttempts.isPending}
        onConfirm={handleBulkAdopt}
      />
      <ConfirmActionButton
        label={`白紙を無答に（${blankUnscoredAnswers.length}件）`}
        title="白紙の答案を無答にしますか"
        description={`インク率で白紙と判定した、未採点の ${blankUnscoredAnswers.length} 件を無答として書きます（境界帯の答案は含めません）。`}
        confirmLabel="無答にする"
        disabled={blankUnscoredAnswers.length === 0 || adoptBlanks.isPending}
        onConfirm={handleAdoptBlanks}
      />
      <AiDeleteOldAttemptsButton
        examId={examId}
        cropRegionId={cropRegion.id}
        reviewedAnswers={reviewedAnswers}
      />
    </div>
  )
}
