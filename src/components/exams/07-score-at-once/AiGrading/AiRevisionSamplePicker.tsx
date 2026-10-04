"use client"

import { Checkbox } from "@/components/ui/checkbox"

import { studentDisplayName } from "./utils/answerDisplay"
import type { ReviewedAiGradingAnswer } from "./utils/answerReview"
import { REVIEW_REASON_LABELS } from "./utils/reviewReasons"

interface AiRevisionSamplePickerProps {
  reviewedAnswers: ReviewedAiGradingAnswer[]
  sampleExamStudentIds: ReadonlySet<string>
  onSampleExamStudentIdsChange: (
    sampleExamStudentIds: ReadonlySet<string>
  ) => void
}

/** 改訂に添える答案を選ぶ（既定は選んでいる答案、無ければ AI と自分が食い違う答案） */
export function AiRevisionSamplePicker({
  reviewedAnswers,
  sampleExamStudentIds,
  onSampleExamStudentIdsChange,
}: AiRevisionSamplePickerProps) {
  const toggleSample = (examStudentId: string) => {
    const next = new Set(sampleExamStudentIds)
    if (next.has(examStudentId)) {
      next.delete(examStudentId)
    } else {
      next.add(examStudentId)
    }
    onSampleExamStudentIdsChange(next)
  }

  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">
        添える答案（{sampleExamStudentIds.size}件）
      </legend>
      <ul className="max-h-48 overflow-y-auto rounded border p-1 text-sm">
        {reviewedAnswers.map((reviewedAnswer) => {
          const { studentAnswerImage } = reviewedAnswer.answer
          const checkboxId = `ai-revision-sample-${studentAnswerImage.id}`
          return (
            <li key={studentAnswerImage.id} className="flex items-center gap-2">
              <Checkbox
                id={checkboxId}
                checked={sampleExamStudentIds.has(
                  studentAnswerImage.examStudentId
                )}
                onCheckedChange={() =>
                  toggleSample(studentAnswerImage.examStudentId)
                }
              />
              <label htmlFor={checkboxId} className="flex-1">
                {studentDisplayName(studentAnswerImage)}
              </label>
              <span className="text-xs text-muted-foreground">
                {reviewedAnswer.review.reviewReasons
                  .map((reviewReason) => REVIEW_REASON_LABELS[reviewReason])
                  .join("・")}
              </span>
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}
