import { useQuery } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"

import type { GridAnswerItem } from "@/components/exams/07-score-at-once/ScoringGrid/types"
import { findQuestionScore } from "@/components/exams/07-score-at-once/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import { examScoreScalesQuery } from "@/queries/scoreScale"
import type { QuestionScoreRow } from "@/queries/scoring"
import { toScoringMethod } from "@/types/rubric.types"

import {
  findScaleLevels,
  type ScaleCellAppearance,
  scaleCellAppearanceOf,
  type ScaleLevelChoice,
} from "../utils/scaleLevelAppearance"

/** 類型評価でない設問の類型（毎回作り直さない） */
const NO_SCALE_LEVELS: readonly ScaleLevelChoice[] = []

interface UseScaleQuestionOptions {
  examId: string
  currentUserId: string
  currentCropRegion: QuestionAnswerRegionRow | undefined
  /** 今の設問の採点行（採点者を問わない。マスに出すのは自分の行だけ） */
  questionScores: readonly QuestionScoreRow[]
}

/**
 * 今の設問が類型評価か、その類型（並び順）と、一覧のマスの類型の見せ方
 * （docs/vlm-grading-design.md §4-8-5・§4-8-6）。
 *
 * 類型の組は類型評価の設問でだけ読む。マスの見せ方はどの方式の設問でも返す
 * （点の採点の設問に残った評価済みも、方式と合わない採点として示すため）
 */
export function useScaleQuestion({
  examId,
  currentUserId,
  currentCropRegion,
  questionScores,
}: UseScaleQuestionOptions) {
  const scoringMethod = toScoringMethod(currentCropRegion?.scoringMethod)
  const isScaleQuestion =
    currentCropRegion !== undefined && scoringMethod === "scale"
  const { data: scoreScales, isPending } = useQuery({
    ...examScoreScalesQuery(examId),
    enabled: isScaleQuestion,
  })
  const scoreScaleId = currentCropRegion?.scoreScaleId ?? null

  const scaleLevels = useMemo(
    () =>
      isScaleQuestion && scoreScales
        ? findScaleLevels(scoreScales, scoreScaleId)
        : NO_SCALE_LEVELS,
    [isScaleQuestion, scoreScales, scoreScaleId]
  )

  const scaleAppearanceOf = useCallback(
    (answer: GridAnswerItem): ScaleCellAppearance | null => {
      if (answer.status === "master") return null
      const ownScore = findQuestionScore(
        questionScores,
        answer.examStudentId,
        currentUserId
      )
      return scaleCellAppearanceOf({
        scoringMethod,
        status: answer.status,
        scaleLevelId: ownScore?.scaleLevelId ?? null,
        scaleLevels,
      })
    },
    [questionScores, currentUserId, scoringMethod, scaleLevels]
  )

  return {
    isScaleQuestion,
    scaleLevels,
    /** 組を読み込み中（読み込み終わるまで「組が選ばれていない」とは言わない） */
    isScaleLevelsLoading: isScaleQuestion && isPending,
    scaleAppearanceOf,
  }
}
