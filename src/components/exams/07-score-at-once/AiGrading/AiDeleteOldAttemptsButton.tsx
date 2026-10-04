"use client"

import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"

import { deleteAiGradingAttemptsMutation } from "@/queries/aiGrading"

import { ConfirmActionButton } from "./ConfirmActionButton"
import type { ReviewedAiGradingAnswer } from "./utils/answerReview"
import { selectDeletableOldAttemptIds } from "./utils/attemptSelection"

interface AiDeleteOldAttemptsButtonProps {
  examId: string
  cropRegionId: string
  reviewedAnswers: ReviewedAiGradingAnswer[]
}

/** この設問の古い判定（採用しておらず、答案ごとの最新でもないもの）を消す（設計 §4-4） */
export function AiDeleteOldAttemptsButton({
  examId,
  cropRegionId,
  reviewedAnswers,
}: AiDeleteOldAttemptsButtonProps) {
  const deleteAttempts = useMutation(
    deleteAiGradingAttemptsMutation(examId, cropRegionId)
  )
  const deletableAttemptIds = selectDeletableOldAttemptIds(
    reviewedAnswers.map((reviewedAnswer) => reviewedAnswer.answer.attempts)
  )
  return (
    <ConfirmActionButton
      label={`古い判定を消す（${deletableAttemptIds.length}件）`}
      title="古い AI の判定を消しますか"
      description={`採用しておらず、答案ごとの最新でもない ${deletableAttemptIds.length} 件の判定を消します。元に戻せません。`}
      confirmLabel="消す"
      disabled={deletableAttemptIds.length === 0 || deleteAttempts.isPending}
      onConfirm={() =>
        deleteAttempts.mutate(deletableAttemptIds, {
          onSuccess: (deletedCount) =>
            toast.success(`古い判定を${deletedCount}件消しました`),
        })
      }
    />
  )
}
