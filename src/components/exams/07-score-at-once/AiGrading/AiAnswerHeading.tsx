"use client"

import { toScoringStatus } from "@/types/scoringStatus.types"

import type { AiGridItem } from "./types"
import { describeJudgement } from "./utils/answerDisplay"

interface AiAnswerHeadingProps {
  gridItem: AiGridItem
}

/** 選んだ答案の見出し（生徒の名前と、自分の採点） */
export function AiAnswerHeading({ gridItem }: AiAnswerHeadingProps) {
  const { questionScore } = gridItem.reviewedAnswer.answer
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h3 className="font-medium">{gridItem.studentName}</h3>
      <span className="text-sm text-muted-foreground">
        自分:{" "}
        {questionScore
          ? describeJudgement(
              toScoringStatus(questionScore.status),
              questionScore.partialScore
            )
          : "未採点"}
      </span>
    </div>
  )
}
