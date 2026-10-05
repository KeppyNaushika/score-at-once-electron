"use client"

import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { SCORING_STATUS_LABELS } from "@/lib/scoringStatusColors"
import { adoptAiGradingAttemptsMutation } from "@/queries/aiGrading"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

import { ConfirmActionButton } from "./ConfirmActionButton"
import {
  ANNOTATION_TARGET_STATUSES,
  type AnnotationTargetStatus,
  DEFAULT_ANNOTATION_TARGET_STATUSES,
  selectAnnotationAdoptionTargets,
} from "./utils/annotationAdoption"
import type { ReviewedAiGradingAnswer } from "./utils/answerReview"
import { adoptionOfAnswer } from "./utils/selectionAdoption"

interface AiBulkAnnotationSectionProps {
  examId: string
  cropRegion: QuestionAnswerRegionRow
  pageSize: string
  reviewedAnswers: ReviewedAiGradingAnswer[]
  draftAnnotationsByAttemptId: ReadonlyMap<string, readonly DrawingAnnotation[]>
}

/**
 * 朱書きだけをまとめて反映する（採点の確定とは別）。
 * AI の判定の状態で、どの答案に朱書きを入れるかを選ぶ（既定は部分点だけ）。
 * 点は書かないので、採点済みの答案にも朱書きを入れられる
 */
export function AiBulkAnnotationSection({
  examId,
  cropRegion,
  pageSize,
  reviewedAnswers,
  draftAnnotationsByAttemptId,
}: AiBulkAnnotationSectionProps) {
  const adoptAttempts = useMutation(
    adoptAiGradingAttemptsMutation(examId, cropRegion.id)
  )
  const [targetStatuses, setTargetStatuses] = useState<
    ReadonlySet<AnnotationTargetStatus>
  >(DEFAULT_ANNOTATION_TARGET_STATUSES)
  const targetAnswers = selectAnnotationAdoptionTargets(
    reviewedAnswers,
    targetStatuses
  )

  const toggleStatus = (targetStatus: AnnotationTargetStatus) => {
    setTargetStatuses((prev) => {
      const next = new Set(prev)
      if (next.has(targetStatus)) next.delete(targetStatus)
      else next.add(targetStatus)
      return next
    })
  }

  const handleAdoptAnnotations = () => {
    const adoptions = targetAnswers.flatMap((reviewedAnswer) => {
      const adoption = adoptionOfAnswer(reviewedAnswer, {
        cropRegion,
        pageSize,
        draftAnnotationsByAttemptId,
      })
      return adoption ? [adoption] : []
    })
    adoptAttempts.mutate(
      {
        adoptions,
        overwrite: false,
        parts: { score: false, annotation: true },
      },
      {
        onSuccess: (results) => {
          const adoptedCount = results.filter(
            (result) => result.outcome === "adopted"
          ).length
          toast.success(`朱書きを${adoptedCount}件反映しました`)
        },
      }
    )
  }

  const targetStatusLabels = ANNOTATION_TARGET_STATUSES.filter((targetStatus) =>
    targetStatuses.has(targetStatus)
  )
    .map((targetStatus) => SCORING_STATUS_LABELS[targetStatus])
    .join("・")

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">
        まとめて反映する答案（AI の判定の状態）
      </p>
      <div
        className="flex flex-wrap gap-1"
        role="group"
        aria-label="朱書きを入れる AI の判定"
      >
        {ANNOTATION_TARGET_STATUSES.map((targetStatus) => {
          const isOn = targetStatuses.has(targetStatus)
          return (
            <Button
              key={targetStatus}
              size="sm"
              variant={isOn ? "default" : "outline"}
              aria-pressed={isOn}
              className="h-7 px-2 text-xs"
              onClick={() => toggleStatus(targetStatus)}
            >
              {SCORING_STATUS_LABELS[targetStatus]}
            </Button>
          )
        })}
      </div>
      <ConfirmActionButton
        label={`朱書きを反映（${targetAnswers.length}件）`}
        title="AI の朱書きをまとめて反映しますか"
        description={`AI の判定が「${targetStatusLabels || "なし"}」の答案のうち、朱書きがあり、まだ反映していない ${targetAnswers.length} 件に、朱書きだけを書きます。点は書きません（採点済みの答案の点もそのままです）。`}
        confirmLabel="反映する"
        disabled={targetAnswers.length === 0 || adoptAttempts.isPending}
        onConfirm={handleAdoptAnnotations}
      />
    </div>
  )
}
