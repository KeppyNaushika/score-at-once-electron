"use client"

import CroppedAnswerImage from "@/components/exams/07-score-at-once/ScoringMain/CroppedAnswerImage"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import { toScoringStatus } from "@/types/scoringStatus.types"

import {
  answerImageUrl,
  ATTEMPT_STATE_LABELS,
  confidenceLabel,
  describeJudgement,
  studentDisplayName,
} from "./utils/answerDisplay"
import type { ReviewedAiGradingAnswer } from "./utils/answerReview"
import { REVIEW_REASON_LABELS } from "./utils/reviewReasons"

interface AiAnswerListItemProps {
  cropRegion: QuestionAnswerRegionRow
  reviewedAnswer: ReviewedAiGradingAnswer
  isFocused: boolean
  isSelected: boolean
  onFocus: () => void
  onToggleSelected: () => void
}

/** 答案1件の行。自分の採点・表示中の AI の判定・印を並べる */
export function AiAnswerListItem({
  cropRegion,
  reviewedAnswer,
  isFocused,
  isSelected,
  onFocus,
  onToggleSelected,
}: AiAnswerListItemProps) {
  const { answer, review } = reviewedAnswer
  const { studentAnswerImage, questionScore, inkMeasurement } = answer
  const attempt = review.displayedAttempt?.attempt ?? null
  const studentName = studentDisplayName(studentAnswerImage)

  return (
    <li
      aria-current={isFocused ? "true" : undefined}
      data-testid="ai-answer-item"
      className={`flex cursor-pointer items-stretch gap-3 border-b px-3 py-2 ${
        isFocused ? "bg-blue-50 ring-2 ring-blue-400 ring-inset" : ""
      }`}
      onClick={onFocus}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggleSelected}
        onClick={(event) => event.stopPropagation()}
        aria-label={`${studentName} を選ぶ`}
        className="mt-1"
      />
      <div className="w-40 shrink-0">
        <CroppedAnswerImage
          imageUrl={answerImageUrl(studentAnswerImage)}
          cropRegion={cropRegion}
          alt={`${studentName} の答案`}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{studentName}</span>
          <span className="text-xs text-muted-foreground">
            自分:{" "}
            {questionScore
              ? describeJudgement(
                  toScoringStatus(questionScore.status),
                  questionScore.partialScore
                )
              : "未採点"}
          </span>
        </div>
        <div className="text-xs">
          AI:{" "}
          {attempt === null
            ? "未判定"
            : attempt.state === "succeeded"
              ? `${describeJudgement(attempt.status, attempt.partialScore)}（確信度 ${confidenceLabel(attempt.confidence)}）`
              : ATTEMPT_STATE_LABELS[attempt.state]}
        </div>
        <div className="flex flex-wrap gap-1">
          {inkMeasurement?.blankness === "blank" && (
            <Badge variant="outline">白紙</Badge>
          )}
          {inkMeasurement === null && (
            <Badge variant="outline" className="text-muted-foreground">
              未測定
            </Badge>
          )}
          {review.reviewReasons.map((reviewReason) => (
            <Badge
              key={reviewReason}
              variant="outline"
              className="border-amber-400 text-amber-800"
            >
              {REVIEW_REASON_LABELS[reviewReason]}
            </Badge>
          ))}
          {review.isFromOtherPrompt && (
            <Badge variant="outline" className="text-muted-foreground">
              別のプロンプト
            </Badge>
          )}
          {review.isAdopted && (
            <Badge
              variant="outline"
              className="border-green-500 text-green-700"
            >
              採用済み
            </Badge>
          )}
          {review.isChangedAfterAdoption && (
            <Badge
              variant="outline"
              className="border-purple-400 text-purple-700"
            >
              採用後に変更
            </Badge>
          )}
        </div>
      </div>
    </li>
  )
}
