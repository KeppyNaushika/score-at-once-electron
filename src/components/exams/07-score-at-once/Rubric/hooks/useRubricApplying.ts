/**
 * 選んだ答案に項目を当てる・外す、手での上書きを解除する（docs/vlm-grading-design.md §4-3〜§4-5）。
 *
 * 当てる・外すと main が付け外ししたマスの採点行（適用付き）を返すので、renderer で点を
 * 計算して書く（計算は renderer、main は書くだけ）。付け外ししたマスは上書きの印が外れる。
 *
 * 上書きの解除は、上書きしている自分の採点行を項目から計算した点で書き直す。
 *
 * 当てる・外したマスは、項目の助言から作る朱書きも合わせる（§4-7。`useRubricAdviceSync`）。
 */

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"
import { toast } from "sonner"

import { useGradeLock } from "@/components/common/grade-lock/GradeLockProvider"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import {
  rubricItemsQuery,
  setRubricApplicationsMutation,
  writeRubricScoresMutation,
} from "@/queries/rubric"

import type { RubricScoredRow } from "../types"
import {
  type OwnRubricCell,
  shouldApplyToSelection,
  toRubricScoredRow,
} from "../utils/rubricApplicationState"
import { computeRubricScore, isSameRubricScore } from "../utils/rubricScore"
import type { useRubricAdviceSync } from "./useRubricAdviceSync"

/** 選んだ答案1つ（受験者と、自分の採点行と当たっている項目） */
export interface SelectedRubricCell extends OwnRubricCell {
  examStudentId: string
}

interface UseRubricApplyingOptions {
  examId: string
  cropRegion: QuestionAnswerRegionRow
  selectedCells: readonly SelectedRubricCell[]
  /** 点を書いた答案を「いま採点した」にする（絞り込みから急に消えないように） */
  onScored?: (examStudentIds: string[]) => void
  /** 当てる・外したマスの助言の朱書きを合わせる */
  syncAdviceRows: ReturnType<typeof useRubricAdviceSync>["syncRows"]
}

export function useRubricApplying({
  examId,
  cropRegion,
  selectedCells,
  onScored,
  syncAdviceRows,
}: UseRubricApplyingOptions) {
  const queryClient = useQueryClient()
  /**
   * 計算に使う項目は、その時点のものを読む。「その他」で作った直後の項目は、
   * 画面が持っている一覧にまだ載っていない（作成で古くなった一覧は読み直される）
   */
  const readRubricItems = useCallback(
    () => queryClient.fetchQuery(rubricItemsQuery(examId, cropRegion.id)),
    [queryClient, examId, cropRegion.id]
  )
  // 採点の口と同じく、成績算出のロック中は当てない（main も書き込みを止める）
  const { guard } = useGradeLock()
  const { mutateAsync: setApplications } = useMutation(
    setRubricApplicationsMutation(examId, cropRegion.id)
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

  const toggleItem = useCallback(
    async (rubricItemId: string) => {
      if (selectedCells.length === 0) {
        toast.info("項目を当てる答案を選んでください")
        return
      }
      const examStudentIds = selectedCells.map((cell) => cell.examStudentId)
      try {
        const touchedRows = await setApplications({
          cropRegionId: cropRegion.id,
          rubricItemId,
          examStudentIds,
          applied: shouldApplyToSelection(rubricItemId, selectedCells),
        })
        onScored?.(examStudentIds)
        await writeComputedScores(touchedRows)
        await syncAdviceRows(touchedRows.map((row) => row.id))
      } catch {
        // 失敗の通知と取り直しは MutationCache の後始末が担う
      }
    },
    [
      selectedCells,
      setApplications,
      cropRegion.id,
      onScored,
      writeComputedScores,
      syncAdviceRows,
    ]
  )

  /** 選んだ答案のうち上書きしているマスを、項目から計算した点へ戻す */
  const clearOverrides = useCallback(async () => {
    const rubricItems = await readRubricItems()
    const writes = selectedCells.flatMap((cell) => {
      if (!cell.questionScore || !cell.overridesRubric) return []
      const outcome = computeRubricScore(cropRegion, rubricItems, {
        ...toRubricScoredRow(cell.questionScore, cell.appliedItemIds),
        overridesRubric: false,
      })
      if (outcome.kind !== "computed") return []
      return [
        {
          questionScoreId: cell.questionScore.id,
          status: outcome.result.status,
          partialScore: outcome.result.partialScore,
          clearsOverride: true,
        },
      ]
    })
    if (writes.length === 0) return
    try {
      await writeScores(writes)
      onScored?.(selectedCells.map((cell) => cell.examStudentId))
    } catch {
      // 同上
    }
  }, [selectedCells, cropRegion, readRubricItems, writeScores, onScored])

  return useMemo(
    () => ({
      toggleItem: guard(
        (rubricItemId: string) => void toggleItem(rubricItemId)
      ),
      clearOverrides: guard(() => void clearOverrides()),
    }),
    [guard, toggleItem, clearOverrides]
  )
}
