"use client"

import { useMutation } from "@tanstack/react-query"
import { CheckCheck, SquareDashedMousePointer } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { adoptBlankAnswersMutation } from "@/queries/aiGrading"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import { AiDeleteOldAttemptsButton } from "./AiDeleteOldAttemptsButton"
import { ConfirmActionButton } from "./ConfirmActionButton"
import type { ReviewedAiGradingAnswer } from "./utils/answerReview"
import { blankUnscoredExamStudentIds } from "./utils/blankAnswers"

interface AiBulkActionsBarProps {
  examId: string
  cropRegion: QuestionAnswerRegionRow
  reviewedAnswers: ReviewedAiGradingAnswer[]
  /** 一覧に表示中の答案の数（絞り込みの後） */
  visibleCount: number
  /** 一覧に表示中の答案（受験者の id。絞り込みの後） */
  visibleIds: readonly string[]
  /** 白紙を無答にする対象を一覧で選ぶ（絞り込みで隠れているものも一覧に出す） */
  onSelectBlankTargets: (examStudentIds: readonly string[]) => void
  /** 表示中の答案すべての AI の点を採用する（確かめは選んだ答案の採用と同じ） */
  onAdoptVisible: () => void
  isAdopting: boolean
}

/**
 * 採点反映のタブのまとめての操作。表示答案を全て採用・白紙を無答に・古い判定を消す。
 *
 * 全て採用の対象は一覧の絞り込み（自分の採点・AI の採点・確信度）がそのまま決める。
 * 判定の無い答案は飛ばし、自分が採点済みの答案があれば件数を示して1回だけ上書きを確かめる
 * （選んだ答案の採用と同じ）。白紙と古い判定は件数を先に見せ、確かめてから書く。
 *
 * 白紙の対象は一覧の絞り込みによらず設問の答案すべてから数える（一覧のマスには「白紙」の印）。
 * 「対象を選ぶ」はその全件を選び、絞り込みで隠れている答案も一覧に出す（件数と選ぶ数を揃える）
 */
export function AiBulkActionsBar({
  examId,
  cropRegion,
  reviewedAnswers,
  visibleCount,
  visibleIds,
  onSelectBlankTargets,
  onAdoptVisible,
  isAdopting,
}: AiBulkActionsBarProps) {
  const adoptBlanks = useMutation(
    adoptBlankAnswersMutation(examId, cropRegion.id)
  )

  // 白紙はその場のインク率だけで決める（境界帯・測れなかった答案は含めない）
  const blankTargetIds = blankUnscoredExamStudentIds(reviewedAnswers)
  const visibleIdSet = new Set(visibleIds)
  const hiddenBlankTargetCount = blankTargetIds.filter(
    (examStudentId) => !visibleIdSet.has(examStudentId)
  ).length

  const handleAdoptBlanks = () => {
    adoptBlanks.mutate(
      {
        cropRegionId: cropRegion.id,
        examStudentIds: blankTargetIds,
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
          label={`白紙を無答に（${blankTargetIds.length}件）`}
          title="白紙の答案を無答にしますか"
          description={
            <>
              一覧で「白紙」の印が付いた答案のうち、まだ自分が採点していない{" "}
              {blankTargetIds.length}{" "}
              件を無答として書きます（印はインク率で付けたもので、AI
              は関わりません。破線の「白紙?」の印＝境界帯の答案は含めません）。
              {hiddenBlankTargetCount > 0 &&
                `うち ${hiddenBlankTargetCount} 件は今の絞り込みで一覧から隠れています。`}
              書く前に確かめるなら「対象を選ぶ」で一覧に出して選べます。
            </>
          }
          confirmLabel="無答にする"
          disabled={blankTargetIds.length === 0 || adoptBlanks.isPending}
          onConfirm={handleAdoptBlanks}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSelectBlankTargets(blankTargetIds)}
          disabled={blankTargetIds.length === 0}
          title="白紙を無答にする対象を一覧で選ぶ（絞り込みで隠れているものも一覧に出す）"
        >
          <SquareDashedMousePointer className="h-4 w-4" />
          対象を選ぶ
        </Button>
        <AiDeleteOldAttemptsButton
          examId={examId}
          cropRegionId={cropRegion.id}
          reviewedAnswers={reviewedAnswers}
        />
      </div>
      {hiddenBlankTargetCount > 0 && (
        <p
          className="text-xs text-muted-foreground"
          data-testid="ai-hidden-blank-target-count"
        >
          白紙の対象のうち {hiddenBlankTargetCount}{" "}
          件は今の絞り込みで隠れています（「対象を選ぶ」で一覧に出します）
        </p>
      )}
    </div>
  )
}
