"use client"

import { CheckCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import { AiDeleteOldAttemptsButton } from "./AiDeleteOldAttemptsButton"
import type { ReviewedAiGradingAnswer } from "./utils/answerReview"

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
 * 採点反映のタブのまとめての操作。表示答案を全て採用・古い判定を消す。
 *
 * 全て採用の対象は一覧の絞り込み（自分の採点・AI の採点）がそのまま決める。
 * 判定の無い答案は飛ばし、自分が採点済みの答案があれば件数を示して1回だけ上書きを確かめる
 * （選んだ答案の採用と同じ）。古い判定は件数を先に見せ、確かめてから書く。
 *
 * 白紙はアプリが判定しない。白さ順の一覧で、教員が自分で無答を付ける
 */
export function AiBulkActionsBar({
  examId,
  cropRegion,
  reviewedAnswers,
  visibleCount,
  onAdoptVisible,
  isAdopting,
}: AiBulkActionsBarProps) {
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
        <AiDeleteOldAttemptsButton
          examId={examId}
          cropRegionId={cropRegion.id}
          reviewedAnswers={reviewedAnswers}
        />
      </div>
    </div>
  )
}
