/**
 * 設問一覧の印（右上の丸）を、AI の判定を反映していない設問だけオレンジにするための判定。
 */

import type { CropRegion } from "@prisma/client"

import type { QuestionScoreRow } from "@/queries/scoring"
import { isStage1RunPurpose } from "@/types/aiGrading.types"

import type { AiGradingRunOfExamRow } from "../types"
import { findOwnQuestionScore, isScored } from "./scoreComparison"

/**
 * 自分の成功した AI の判定があるのに、自分がまだ採点していない答案を持つ設問の id。
 * 方式と合わない自分の採点は未採点として読む（§4-8-8）。設問一覧に無い設問の実行は見ない
 *
 * @param cropRegions 試験の設問（方式を引く）
 */
export function selectQuestionsWithUnreflectedAiJudgements(
  runs: readonly AiGradingRunOfExamRow[],
  cropRegions: readonly Pick<CropRegion, "id" | "scoringMethod">[],
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
        const cropRegion = cropRegions.find(
          (cropRegionRow) => cropRegionRow.id === run.prompt.cropRegionId
        )
        if (!cropRegion) return false
        const questionScores =
          questionScoresByCropRegionId.get(cropRegion.id) ?? []
        return run.attempts.some(
          (attempt) =>
            attempt.state === "succeeded" &&
            !isScored(
              findOwnQuestionScore(
                questionScores,
                cropRegion,
                attempt.examStudentId,
                currentUserId
              )
            )
        )
      })
      .map((run) => run.prompt.cropRegionId)
  )
}
