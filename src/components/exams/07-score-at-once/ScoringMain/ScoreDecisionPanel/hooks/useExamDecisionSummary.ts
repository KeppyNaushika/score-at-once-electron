import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"

import { examDecisionSummaryQuery } from "@/queries/scoring"

/**
 * 試験の裁定サマリ（競合・確定後の新提案）を取得する。
 *
 * 競合は単独採点では構造的にゼロなので、`summary.graderCount <= 1` かつ
 * 対象0件のときは確定に関するUIを一切出さないための判断材料にも使う。
 */
export function useExamDecisionSummary(
  examId: string,
  userId: string | undefined,
  /**
   * 取得するか。試験全体の採点行を走査するので、単独利用（メンバー1人）では
   * 走らせない。競合はメンバーが1人なら構造的にゼロなので結果は常に空になる
   * ——共有DBがNAS上にあることを踏まえ、無駄なスキャンを画面入場ごとに払わない。
   */
  enabled: boolean
) {
  const queryClient = useQueryClient()
  const queryKey = useMemo(
    () => examDecisionSummaryQuery(examId, userId ?? "").queryKey,
    [examId, userId]
  )
  const {
    data: summary = null,
    isPending,
    error,
  } = useQuery({
    ...examDecisionSummaryQuery(examId, userId ?? ""),
    enabled: enabled && Boolean(examId) && Boolean(userId),
  })

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey }),
    [queryClient, queryKey]
  )

  return {
    summary,
    // 走らせない条件（単独利用）のときは待たせない
    loading: enabled && isPending,
    error: error ? (error.message ?? "裁定状況を取得できません") : null,
    refresh,
  }
}
