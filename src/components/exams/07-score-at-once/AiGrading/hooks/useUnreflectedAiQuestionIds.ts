"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { aiGradingRunsOfExamQuery } from "@/queries/aiGrading"
import type { QuestionScoreRow } from "@/queries/scoring"

import type { AiGradingRunOfExamRow } from "../types"
import { selectQuestionsWithUnreflectedAiJudgements } from "../utils/unreflectedQuestions"

/** 実行がまだ届いていない・読まないときの空の配列（毎回作り直さない） */
const NO_RUNS: AiGradingRunOfExamRow[] = []

/**
 * 設問一覧の印をオレンジにする設問（自分の AI の判定があるのに、自分がまだ採点していない
 * 答案のある設問）。採点のどのモード（一覧表示・個別表示・AI採点）でも同じ印を出す。
 *
 * `isAiGradingAvailable` が偽（AI採点を解放していない）なら実行を読みに行かず、空を返す。
 */
export function useUnreflectedAiQuestionIds({
  examId,
  currentUserId,
  questionScoresByCropRegionId,
  isAiGradingAvailable,
}: {
  examId: string
  currentUserId: string
  questionScoresByCropRegionId: ReadonlyMap<string, readonly QuestionScoreRow[]>
  isAiGradingAvailable: boolean
}): ReadonlySet<string> {
  const { data: runsOfExam = NO_RUNS } = useQuery({
    ...aiGradingRunsOfExamQuery(examId),
    enabled: isAiGradingAvailable,
  })
  return useMemo(
    () =>
      selectQuestionsWithUnreflectedAiJudgements(
        isAiGradingAvailable ? runsOfExam : NO_RUNS,
        questionScoresByCropRegionId,
        currentUserId
      ),
    [
      isAiGradingAvailable,
      runsOfExam,
      questionScoresByCropRegionId,
      currentUserId,
    ]
  )
}
