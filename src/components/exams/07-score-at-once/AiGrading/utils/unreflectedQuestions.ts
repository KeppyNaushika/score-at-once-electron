/**
 * 設問一覧の印（右上の丸）を、AI の判定を反映していない設問だけオレンジにするための判定。
 */

import type { QuestionScoreRow } from "@/queries/scoring"
import { isStage1RunPurpose } from "@/types/aiGrading.types"

import type { AiGradingRunOfExamRow } from "../types"
import { findOwnQuestionScore, isScored } from "./scoreComparison"

/**
 * 自分の成功した AI の判定があるのに、自分がまだ採点していない答案を持つ設問の id
 */
export function selectQuestionsWithUnreflectedAiJudgements(
  runs: readonly AiGradingRunOfExamRow[],
  questionScoresByCropRegionId: ReadonlyMap<
    string,
    readonly QuestionScoreRow[]
  >,
  currentUserId: string
): Set<string> {
  return new Set(
    runs
      .filter((run) => {
        if (!isStage1RunPurpose(run.purpose)) return false
        const cropRegionId = run.prompt.cropRegionId
        const questionScores =
          questionScoresByCropRegionId.get(cropRegionId) ?? []
        return run.attempts.some(
          (attempt) =>
            attempt.state === "succeeded" &&
            !isScored(
              findOwnQuestionScore(
                questionScores,
                cropRegionId,
                attempt.examStudentId,
                currentUserId
              )
            )
        )
      })
      .map((run) => run.prompt.cropRegionId)
  )
}
