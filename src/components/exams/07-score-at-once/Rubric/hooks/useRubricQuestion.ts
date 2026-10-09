/**
 * 設問のルーブリック項目と、自分の採点行に当たっている項目（docs/vlm-grading-design.md §4-3）。
 *
 * 左の項目のパネルと、一覧のマスの印が同じものを読む（取得は設問ごとのキーで共有される）。
 */

import { useQuery } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"

import {
  type RubricApplicationRow,
  rubricApplicationsQuery,
  type RubricItemRow,
  rubricItemsQuery,
} from "@/queries/rubric"
import type { QuestionScoreRow } from "@/queries/scoring"

import {
  groupAppliedItemIds,
  type OwnRubricCell,
  ownRubricCellOf,
} from "../utils/rubricApplicationState"

/** 取得が終わるまでの空の並び（毎回作り直さない） */
const NO_RUBRIC_ITEMS: RubricItemRow[] = []
const NO_RUBRIC_APPLICATIONS: RubricApplicationRow[] = []
const NO_APPLIED_ITEM_IDS: ReadonlySet<string> = new Set()

interface UseRubricQuestionOptions {
  examId: string
  /** 設問。ルーブリック採点でない（points）なら null を渡し、何も読まない */
  cropRegionId: string | null
  currentUserId: string
  /** その設問の採点行（採点者を問わない） */
  questionScores: readonly QuestionScoreRow[]
}

export function useRubricQuestion({
  examId,
  cropRegionId,
  currentUserId,
  questionScores,
}: UseRubricQuestionOptions) {
  const { data: rubricItems = NO_RUBRIC_ITEMS } = useQuery({
    ...rubricItemsQuery(examId, cropRegionId ?? ""),
    enabled: cropRegionId !== null,
  })
  const { data: rubricApplications = NO_RUBRIC_APPLICATIONS } = useQuery({
    ...rubricApplicationsQuery(examId, cropRegionId ?? ""),
    enabled: cropRegionId !== null,
  })

  const appliedItemIdsByQuestionScoreId = useMemo(
    () => groupAppliedItemIds(rubricApplications),
    [rubricApplications]
  )

  /** 受験者1人の、自分の採点行と当たっている項目 */
  const ownCellOf = useCallback(
    (examStudentId: string): OwnRubricCell =>
      ownRubricCellOf(
        questionScores,
        appliedItemIdsByQuestionScoreId,
        examStudentId,
        currentUserId
      ),
    [questionScores, appliedItemIdsByQuestionScoreId, currentUserId]
  )

  /** 自分の採点行がある答案の、当たっている項目（重なった助言の洗い出しに使う） */
  const ownAppliedCells = useMemo(
    () =>
      questionScores
        .filter((questionScore) => questionScore.userId === currentUserId)
        .map((questionScore) => ({
          examStudentId: questionScore.examStudentId,
          appliedItemIds:
            appliedItemIdsByQuestionScoreId.get(questionScore.id) ??
            NO_APPLIED_ITEM_IDS,
        })),
    [questionScores, currentUserId, appliedItemIdsByQuestionScoreId]
  )

  return { rubricItems, ownCellOf, ownAppliedCells }
}
