import { type QueryClient, useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import { examScoreScalesQuery } from "@/queries/scoreScale"
import { toScoringMethod } from "@/types/rubric.types"

import { findScaleLevels } from "../../ScaleLevel/utils/scaleLevelAppearance"
import type { RubricScoringRegion } from "../types"

/** 類型方式でない設問の類型の id（毎回作り直さない） */
const NO_SCALE_LEVEL_IDS: readonly string[] = []

type ScoringRegionSource = Pick<
  QuestionAnswerRegionRow,
  "scoringMethod" | "points" | "scoreScaleId"
>

/**
 * 書き込みの直前に、項目から点を計算する設問を読む（類型方式なら組を読み終えてから）。
 * 画面の `useRubricScoringRegion` は読み込み中に類型が空なので、書き込む計算はこちらを使う
 */
export async function fetchRubricScoringRegion(
  queryClient: QueryClient,
  examId: string,
  cropRegion: ScoringRegionSource
): Promise<RubricScoringRegion> {
  const scaleLevelIds =
    toScoringMethod(cropRegion.scoringMethod) === "scale"
      ? findScaleLevels(
          await queryClient.fetchQuery(examScoreScalesQuery(examId)),
          cropRegion.scoreScaleId
        ).map((scaleLevel) => scaleLevel.id)
      : NO_SCALE_LEVEL_IDS
  return {
    scoringMethod: cropRegion.scoringMethod,
    points: cropRegion.points,
    scaleLevelIds,
  }
}

/**
 * 項目から点を計算するときの設問（配点・方式と、類型方式なら今の組の類型の id）。
 *
 * 類型の組は類型方式の設問でだけ読む（07 の類型のボタンと同じ問い合わせ）。読み込み中は類型が空で、
 * 類型にする項目は保留として計算される — 書き込みの前に `isScaleLevelsPending` を見て待つ
 */
export function useRubricScoringRegion(
  examId: string,
  cropRegion: ScoringRegionSource
) {
  const isScaleQuestion = toScoringMethod(cropRegion.scoringMethod) === "scale"
  const { data: scoreScales, isPending } = useQuery({
    ...examScoreScalesQuery(examId),
    enabled: isScaleQuestion,
  })
  const scaleLevelIds = useMemo(
    () =>
      isScaleQuestion && scoreScales
        ? findScaleLevels(scoreScales, cropRegion.scoreScaleId).map(
            (scaleLevel) => scaleLevel.id
          )
        : NO_SCALE_LEVEL_IDS,
    [isScaleQuestion, scoreScales, cropRegion.scoreScaleId]
  )
  const scoringRegion = useMemo<RubricScoringRegion>(
    () => ({
      scoringMethod: cropRegion.scoringMethod,
      points: cropRegion.points,
      scaleLevelIds,
    }),
    [cropRegion.scoringMethod, cropRegion.points, scaleLevelIds]
  )
  return {
    scoringRegion,
    /** 類型方式の設問で、組をまだ読み込んでいる */
    isScaleLevelsPending: isScaleQuestion && isPending,
  }
}
