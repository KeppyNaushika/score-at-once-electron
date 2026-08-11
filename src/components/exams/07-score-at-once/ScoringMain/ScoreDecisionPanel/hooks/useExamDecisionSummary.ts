import { useCallback, useEffect, useState } from "react"

import type { ExamDecisionSummary } from "@/types/scoreDecision.types"

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
  const [summary, setSummary] = useState<ExamDecisionSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!examId || !userId || !enabled) {
      setLoading(false)
      return
    }
    try {
      setError(null)
      setSummary(
        await window.electronAPI.getExamDecisionSummary(examId, userId)
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "裁定状況を取得できません")
    } finally {
      setLoading(false)
    }
  }, [examId, userId, enabled])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { summary, loading, error, refresh }
}
