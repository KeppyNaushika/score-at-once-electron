/**
 * 当て外ししたマスの点を項目から計算して書く（docs/vlm-grading-design.md §4-4）。
 *
 * main が当て外ししたマスの採点行（適用付き）を返したあとに呼ぶ。計算は renderer、main は書くだけ。
 * 手で当てる（`useRubricApplying`）と、AI の項目の案に答える（`useAiProposalAnswering`）が使う。
 */

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { toast } from "sonner"

import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import { rubricItemsQuery, writeRubricScoresMutation } from "@/queries/rubric"

import type { RubricScoredRow } from "../types"
import { computeRubricScore, isSameRubricScore } from "../utils/rubricScore"

export function useRubricScoreWriting(
  examId: string,
  cropRegion: QuestionAnswerRegionRow
) {
  const queryClient = useQueryClient()
  /**
   * 計算に使う項目は、その時点のものを読む。「その他」や AI の案への答えで作った直後の
   * 項目は、画面が持っている一覧にまだ載っていない（作成で古くなった一覧は読み直される）
   */
  const readRubricItems = useCallback(
    () => queryClient.fetchQuery(rubricItemsQuery(examId, cropRegion.id)),
    [queryClient, examId, cropRegion.id]
  )
  const { mutateAsync: writeScores } = useMutation(
    writeRubricScoresMutation(examId)
  )

  /** 付け外ししたマスの点を計算し、保存されている点と違うものだけを書く */
  const writeComputedScores = useCallback(
    async (rows: readonly RubricScoredRow[]) => {
      const rubricItems = await readRubricItems()
      const outcomes = rows.map((row) => ({
        row,
        outcome: computeRubricScore(cropRegion, rubricItems, row),
      }))
      const writes = outcomes.flatMap(({ row, outcome }) =>
        outcome.kind === "computed" &&
        !isSameRubricScore(
          { status: row.status, partialScore: row.partialScore },
          outcome.result
        )
          ? [
              {
                questionScoreId: row.id,
                status: outcome.result.status,
                partialScore: outcome.result.partialScore,
                clearsOverride: false,
              },
            ]
          : []
      )
      const shadowedCount = outcomes.filter(
        ({ outcome }) =>
          outcome.kind === "computed" && outcome.shadowedSetItemIds.length > 0
      ).length
      if (shadowedCount > 0) {
        toast.info(
          `判定を決める項目が重なった答案が${shadowedCount}件あります。並びが先の項目を採りました`
        )
      }
      if (writes.length > 0) await writeScores(writes)
    },
    [cropRegion, readRubricItems, writeScores]
  )

  return { readRubricItems, writeScores, writeComputedScores }
}
