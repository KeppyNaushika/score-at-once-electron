"use client"

import { useMutation } from "@tanstack/react-query"
import { CheckCheck } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { adoptBlankAnswersMutation } from "@/queries/aiGrading"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import { AiDeleteOldAttemptsButton } from "./AiDeleteOldAttemptsButton"
import { ConfirmActionButton } from "./ConfirmActionButton"
import type { ReviewedAiGradingAnswer } from "./utils/answerReview"
import { isScored } from "./utils/scoreComparison"

interface AiBulkActionsBarProps {
  examId: string
  cropRegion: QuestionAnswerRegionRow
  reviewedAnswers: ReviewedAiGradingAnswer[]
  /** 一覧に表示中の答案の数（絞り込みの後） */
  visibleCount: number
  /** 表示中の答案すべての AI の点を採用する（確かめは選んだ答案の採用と同じ） */
  onAdoptVisible: () => void
  isAdopting: boolean
}

/**
 * 採点反映のタブのまとめての操作。表示答案を全て採用・白紙を無答に・古い判定を消す。
 *
 * 全て採用の対象は一覧の絞り込み（自分の採点・AI の採点・確信度）がそのまま決める。
 * 判定の無い答案は飛ばし、自分が採点済みの答案があれば件数を示して1回だけ上書きを確かめる
 * （選んだ答案の採用と同じ）。白紙と古い判定は件数を先に見せ、確かめてから書く
 */
export function AiBulkActionsBar({
  examId,
  cropRegion,
  reviewedAnswers,
  visibleCount,
  onAdoptVisible,
  isAdopting,
}: AiBulkActionsBarProps) {
  const adoptBlanks = useMutation(
    adoptBlankAnswersMutation(examId, cropRegion.id)
  )

  // 白紙はその場のインク率だけで決める（境界帯・測れなかった答案は含めない）
  const blankUnscoredAnswers = reviewedAnswers.filter(
    (reviewedAnswer) =>
      reviewedAnswer.answer.inkMeasurement?.blankness === "blank" &&
      !isScored(reviewedAnswer.answer.questionScore)
  )

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
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={onAdoptVisible}
        disabled={visibleCount === 0 || isAdopting}
      >
        <CheckCheck className="h-4 w-4" />
        表示答案（{visibleCount}件）を全て採用
      </Button>
      <div className="flex flex-wrap items-center gap-2">
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
    </div>
  )
}
