import { useExamDecisionSummary } from "@/hooks/useExamDecisionSummary"

/** 採点確定の段への導線（単独利用では出さない）と、裁定待ちの件数 */
export function useDecisionEntry(
  examId: string,
  currentUserId: string,
  memberCount: number
) {
  /**
   * 裁定状況。ここで要るのは**件数バッジだけ**で、裁定そのものは
   * 「8. 採点確定」の段が持つ。件数を出すのは、確定が要る状態に気づく場所が
   * 採点の最中だからで、段のタブを見に行かせないため。
   */
  const { summary: decisionSummary } = useExamDecisionSummary(
    examId,
    currentUserId,
    // 単独利用（メンバー1人）では裁定サマリを引かない。全採点行の走査を
    // 画面入場ごとに払わないため（競合は構造的にゼロで結果は常に空）。
    memberCount > 1
  )

  const pendingDecisionCount =
    (decisionSummary?.conflictCount ?? 0) + (decisionSummary?.staleCount ?? 0)

  /**
   * 単独利用では確定への導線を出さない。
   * メンバーが1人なら分担する相手がおらず、提案も常に1件なので
   * 競合は構造的にゼロになる（＝確定の段に用が無い）。
   * 裁定サマリを引くかの条件と同じものを使い、両者がずれないようにする。
   */
  const showDecisionEntry = memberCount > 1

  return { showDecisionEntry, pendingDecisionCount }
}
