"use client"

import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  adoptAiGradingAttemptsMutation,
  adoptBlankAnswersMutation,
} from "@/queries/aiGrading"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

import { AiDeleteOldAttemptsButton } from "./AiDeleteOldAttemptsButton"
import { ConfirmActionButton } from "./ConfirmActionButton"
import type { ReviewedAiGradingAnswer } from "./utils/answerReview"
import {
  BULK_ADOPT_MINIMUM_CONFIDENCE_LABELS,
  BULK_ADOPT_MINIMUM_CONFIDENCES,
  type BulkAdoptMinimumConfidence,
  isBulkAdoptable,
} from "./utils/reviewReasons"
import { isScored } from "./utils/scoreComparison"
import { adoptionOfAnswer } from "./utils/selectionAdoption"

interface AiBulkActionsBarProps {
  examId: string
  cropRegion: QuestionAnswerRegionRow
  pageSize: string
  reviewedAnswers: ReviewedAiGradingAnswer[]
  /** 試行の id → 教員が直した朱書きの下書き（あればそれで採用する） */
  draftAnnotationsByAttemptId: ReadonlyMap<string, DrawingAnnotation[]>
}

/**
 * まとめての操作。採用（確信度の下限を教員が選ぶ）・白紙を無答に・古い判定を消す。
 * どれも件数を先に見せ、確かめてから書く
 */
export function AiBulkActionsBar({
  examId,
  cropRegion,
  pageSize,
  reviewedAnswers,
  draftAnnotationsByAttemptId,
}: AiBulkActionsBarProps) {
  const adoptAttempts = useMutation(
    adoptAiGradingAttemptsMutation(examId, cropRegion.id)
  )
  const adoptBlanks = useMutation(
    adoptBlankAnswersMutation(examId, cropRegion.id)
  )

  const [minimumConfidence, setMinimumConfidence] =
    useState<BulkAdoptMinimumConfidence>("high")
  const bulkAdoptableAnswers = reviewedAnswers.filter((reviewedAnswer) =>
    isBulkAdoptable(
      {
        displayedAttempt: reviewedAnswer.review.displayedAttempt,
        questionScore: reviewedAnswer.answer.questionScore,
        inkMeasurement: reviewedAnswer.answer.inkMeasurement,
        points: cropRegion.points,
      },
      minimumConfidence
    )
  )
  // 確信度以外の要確認の理由（はみ出し・際どい白紙など）がある件数。対象からは外さず示すだけ
  const withOtherReviewReasonCount = bulkAdoptableAnswers.filter(
    (reviewedAnswer) =>
      reviewedAnswer.review.reviewReasons.some(
        (reason) => reason !== "lowConfidence" && reason !== "mediumConfidence"
      )
  ).length
  // 白紙はその場のインク率だけで決める（境界帯・測れなかった答案は含めない）
  const blankUnscoredAnswers = reviewedAnswers.filter(
    (reviewedAnswer) =>
      reviewedAnswer.answer.inkMeasurement?.blankness === "blank" &&
      !isScored(reviewedAnswer.answer.questionScore)
  )

  const handleBulkAdopt = () => {
    const adoptions = bulkAdoptableAnswers.flatMap((reviewedAnswer) => {
      const adoption = adoptionOfAnswer(reviewedAnswer, {
        cropRegion,
        pageSize,
        draftAnnotationsByAttemptId,
      })
      return adoption ? [adoption] : []
    })
    // 点だけを書く。朱書きは「朱書きの反映」で別に確定する
    adoptAttempts.mutate(
      {
        adoptions,
        overwrite: false,
        parts: { score: true, annotation: false },
      },
      {
        onSuccess: (results) => {
          const adoptedCount = results.filter(
            (result) => result.outcome === "adopted"
          ).length
          toast.success(`AI の点を${adoptedCount}件採用しました`)
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
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={minimumConfidence}
        onValueChange={(value) => {
          const chosen = BULK_ADOPT_MINIMUM_CONFIDENCES.find(
            (option) => option === value
          )
          if (chosen) setMinimumConfidence(chosen)
        }}
      >
        <SelectTrigger
          className="h-8 w-40"
          aria-label="まとめて採用する確信度の下限"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BULK_ADOPT_MINIMUM_CONFIDENCES.map((option) => (
            <SelectItem key={option} value={option}>
              {BULK_ADOPT_MINIMUM_CONFIDENCE_LABELS[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ConfirmActionButton
        label={`点をまとめて採用（${bulkAdoptableAnswers.length}件）`}
        title="AI の点をまとめて採用しますか"
        description={`${BULK_ADOPT_MINIMUM_CONFIDENCE_LABELS[minimumConfidence]}の成功した判定のうち、自分がまだ採点していない ${bulkAdoptableAnswers.length} 件の点（判定・部分点・配点理由）を、自分の採点として書きます。朱書きは書きません。${
          withOtherReviewReasonCount > 0
            ? `うち ${withOtherReviewReasonCount} 件には、確信度以外の要確認の理由（枠からのはみ出し・白紙か際どい など）があります。`
            : ""
        }`}
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
