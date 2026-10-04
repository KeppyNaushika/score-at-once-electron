/**
 * @fileoverview 全設問の採点ステータスと点数（全設問マーク・点数描画用）
 */
import { useMemo } from "react"

import {
  findQuestionScore,
  getScoringStatus,
  type ScoringData,
} from "@/components/exams/07-score-at-once/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { QuestionScoreRow } from "@/queries/scoring"

import type { CropRegionWithStatus } from "../core/types"

/** 採点行がまだ1つも無い設問のための空値 */
const EMPTY_SCORES: QuestionScoreRow[] = []

interface UseCropRegionsWithStatusParams {
  cropRegions: QuestionAnswerRegionRow[] | undefined
  questionScoresByCropRegionId: Map<string, QuestionScoreRow[]> | undefined
  currentScoringData: ScoringData | null
  currentUserId: string
}

/**
 * 表示中の答案について、全設問の採点ステータスと点数を求める
 *
 * @returns 設問ごとのステータスと点数（答案が無ければ空）
 */
export function useCropRegionsWithStatus({
  cropRegions,
  questionScoresByCropRegionId,
  currentScoringData,
  currentUserId,
}: UseCropRegionsWithStatusParams): CropRegionWithStatus[] {
  return useMemo(() => {
    if (!cropRegions || !currentScoringData) return []
    const examStudentId = currentScoringData.examStudentId
    return cropRegions.map((cropRegion) => {
      // 採点行は設問ごとに届いている。設問を跨いで探し直す必要は無い
      const questionScores = questionScoresByCropRegionId?.get(cropRegion.id)
      const questionScore = findQuestionScore(
        questionScores ?? EMPTY_SCORES,
        examStudentId,
        currentUserId
      )
      const status = getScoringStatus(
        questionScores,
        examStudentId,
        currentUserId
      )
      const maxScore = cropRegion.points ?? 0
      let actualScore: number | null = null
      switch (status) {
        case "correct":
          actualScore = maxScore
          break
        case "incorrect":
        case "no_answer":
          actualScore = 0
          break
        case "partial":
        case "pending":
          actualScore =
            questionScore?.partialScore != null
              ? Number(questionScore.partialScore)
              : null
          break
      }
      return { cropRegion, status, actualScore }
    })
  }, [
    cropRegions,
    questionScoresByCropRegionId,
    currentUserId,
    currentScoringData,
  ])
}
