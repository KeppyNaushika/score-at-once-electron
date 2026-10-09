import { useCallback } from "react"

import type { GridAnswerItem } from "@/components/exams/07-score-at-once/ScoringGrid/types"
import type { GradingMode } from "@/components/exams/07-score-at-once/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { QuestionScoreRow } from "@/queries/scoring"
import { toScoringMethod } from "@/types/rubric.types"

import { RubricCellMark } from "../RubricCellMark"
import { useRubricQuestion } from "./useRubricQuestion"

/** 採点行がまだ届いていない設問の空の並び（毎回作り直さない） */
const NO_QUESTION_SCORES: QuestionScoreRow[] = []

interface UseRubricScreenOptions {
  examId: string
  currentUserId: string
  gradingMode: GradingMode
  currentCropRegion: QuestionAnswerRegionRow | undefined
  questionScoresByCropRegionId: ReadonlyMap<string, QuestionScoreRow[]>
}

/**
 * 07 の一覧表示・個別表示で、今の設問がルーブリック採点（減点・加点方式）かと、
 * 一覧のマスに置く印を決める。
 *
 * 直接採点（points）の設問では `rubricCropRegion` が null になり、印も出さず項目も
 * 読まない（画面はこれまでと同じ）。AI採点モードは自前の左パネルを持つので、ここでは扱わない
 */
export function useRubricScreen({
  examId,
  currentUserId,
  gradingMode,
  currentCropRegion,
  questionScoresByCropRegionId,
}: UseRubricScreenOptions) {
  const rubricCropRegion =
    gradingMode !== "ai" &&
    currentCropRegion &&
    toScoringMethod(currentCropRegion.scoringMethod) !== "points"
      ? currentCropRegion
      : null
  const questionScores = currentCropRegion
    ? (questionScoresByCropRegionId.get(currentCropRegion.id) ??
      NO_QUESTION_SCORES)
    : NO_QUESTION_SCORES

  const { ownCellOf } = useRubricQuestion({
    examId,
    cropRegionId: rubricCropRegion?.id ?? null,
    currentUserId,
    questionScores,
  })

  const renderRubricCellMark = useCallback(
    (answer: GridAnswerItem) => (
      <RubricCellMark cell={ownCellOf(answer.examStudentId)} />
    ),
    [ownCellOf]
  )

  return {
    rubricCropRegion,
    questionScores,
    renderRubricCellMark: rubricCropRegion ? renderRubricCellMark : undefined,
  }
}
