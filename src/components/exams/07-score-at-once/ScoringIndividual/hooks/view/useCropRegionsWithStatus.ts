/**
 * @fileoverview 全設問の採点ステータスと点数（全設問マーク・点数描画用）
 */
import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import {
  findScaleLevels,
  type ScaleLevelChoice,
} from "@/components/exams/07-score-at-once/ScaleLevel/utils/scaleLevelAppearance"
import {
  findQuestionScore,
  getScoringStatus,
  type ScoringData,
} from "@/components/exams/07-score-at-once/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import { examScoreScalesQuery } from "@/queries/scoreScale"
import type { QuestionScoreRow } from "@/queries/scoring"
import { toScoringMethod } from "@/types/rubric.types"

import { cropRegionScoreDisplayOf } from "../../utils/cropRegionScoreDisplay"
import type { CropRegionWithStatus } from "../core/types"

/** 採点行がまだ1つも無い設問のための空値 */
const EMPTY_SCORES: QuestionScoreRow[] = []

/** 類型評価でない設問の類型（毎回作り直さない） */
const NO_SCALE_LEVELS: readonly ScaleLevelChoice[] = []

interface UseCropRegionsWithStatusParams {
  cropRegions: QuestionAnswerRegionRow[] | undefined
  questionScoresByCropRegionId: Map<string, QuestionScoreRow[]> | undefined
  currentScoringData: ScoringData | null
  currentUserId: string
  examId: string
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
  examId,
}: UseCropRegionsWithStatusParams): CropRegionWithStatus[] {
  // 類型の組は類型評価の設問があるときだけ読む
  const hasScaleQuestion =
    cropRegions?.some(
      (cropRegion) => toScoringMethod(cropRegion.scoringMethod) === "scale"
    ) ?? false
  const { data: scoreScales } = useQuery({
    ...examScoreScalesQuery(examId),
    enabled: hasScaleQuestion && examId !== "",
  })

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
      // 点数は出力と同じ得点化で求める。類型評価の評価済みは類型の記号と点数を出す
      const scaleLevels =
        toScoringMethod(cropRegion.scoringMethod) === "scale" && scoreScales
          ? findScaleLevels(scoreScales, cropRegion.scoreScaleId)
          : NO_SCALE_LEVELS
      const { actualScore, scaleLevelLabel } = cropRegionScoreDisplayOf({
        cropRegion,
        status,
        questionScore: questionScore ?? null,
        scaleLevels,
      })
      return { cropRegion, status, actualScore, scaleLevelLabel }
    })
  }, [
    cropRegions,
    questionScoresByCropRegionId,
    currentUserId,
    currentScoringData,
    scoreScales,
  ])
}
