import { useQuery } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"

import type { ScaleQuestionState } from "@/components/exams/07-score-at-once/ScaleLevel/hooks/useScaleScoringGate"
import {
  findScaleLevels,
  scaleCellAppearanceOf,
  type ScaleLevelChoice,
} from "@/components/exams/07-score-at-once/ScaleLevel/utils/scaleLevelAppearance"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import { examScoreScalesQuery } from "@/queries/scoreScale"
import { toScoringMethod } from "@/types/rubric.types"

import type { ScaleAppearanceOfVerdict } from "../types"

/** 類型評価でない設問の類型（毎回作り直さない） */
const NO_SCALE_LEVELS: readonly ScaleLevelChoice[] = []

/**
 * 08 で開いている設問が類型評価か、その類型（並び順）と、結果の類型の見せ方
 * （docs/vlm-grading-design.md §4-8-5）。
 *
 * 07 の `useScaleQuestion` と同じ組・同じ色を使う。07 はマスに自分の採点行を出すが、
 * 08 はマスに確定を、答案の下に採点者ごとの結果を出すので、見せ方は判定と類型から引く
 */
export function useFinalizeScaleQuestion(
  examId: string,
  currentCropRegion: QuestionAnswerRegionRow | null
) {
  const scoringMethod = toScoringMethod(currentCropRegion?.scoringMethod)
  const isScaleQuestion =
    currentCropRegion !== null && scoringMethod === "scale"
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

  const scaleQuestion = useMemo(
    (): ScaleQuestionState => ({
      isScaleQuestion,
      scaleLevels,
      // 読み込み終わるまで「組が選ばれていない」とは言わない
      isScaleLevelsLoading: isScaleQuestion && isPending,
    }),
    [isScaleQuestion, scaleLevels, isPending]
  )

  /** 判定と類型の見せ方（類型の記号と色・方式と合わない採点の印）。採点状態のままでよければ null */
  const scaleAppearanceOfVerdict = useCallback<ScaleAppearanceOfVerdict>(
    (status, scaleLevelId) =>
      scaleCellAppearanceOf({
        scoringMethod,
        status,
        scaleLevelId,
        scaleLevels,
      }),
    [scoringMethod, scaleLevels]
  )

  return { scaleQuestion, scaleAppearanceOfVerdict }
}
