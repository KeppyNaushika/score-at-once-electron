"use client"

import { useEffect, useRef } from "react"

import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import { AiAnswerListItem } from "./AiAnswerListItem"
import type { ReviewedAiGradingAnswer } from "./utils/answerReview"

interface AiAnswerListProps {
  cropRegion: QuestionAnswerRegionRow
  reviewedAnswers: ReviewedAiGradingAnswer[]
  focusedExamStudentId: string | null
  onFocus: (examStudentId: string) => void
  selectedExamStudentIds: ReadonlySet<string>
  onToggleSelected: (examStudentId: string) => void
}

/** 設問の答案の一覧（↑↓ / W・S で詳細に出す答案を動かす） */
export function AiAnswerList({
  cropRegion,
  reviewedAnswers,
  focusedExamStudentId,
  onFocus,
  selectedExamStudentIds,
  onToggleSelected,
}: AiAnswerListProps) {
  const listRef = useRef<HTMLUListElement>(null)

  // キーで動かした答案を見える位置へ（DOM の操作なので effect）
  useEffect(() => {
    listRef.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView?.({ block: "nearest" })
  }, [focusedExamStudentId])

  if (reviewedAnswers.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        この設問の答案がありません
      </p>
    )
  }

  return (
    <ul ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
      {reviewedAnswers.map((reviewedAnswer) => {
        const { examStudentId } = reviewedAnswer.answer.studentAnswerImage
        return (
          <AiAnswerListItem
            key={reviewedAnswer.answer.studentAnswerImage.id}
            cropRegion={cropRegion}
            reviewedAnswer={reviewedAnswer}
            isFocused={examStudentId === focusedExamStudentId}
            isSelected={selectedExamStudentIds.has(examStudentId)}
            onFocus={() => onFocus(examStudentId)}
            onToggleSelected={() => onToggleSelected(examStudentId)}
          />
        )
      })}
    </ul>
  )
}
