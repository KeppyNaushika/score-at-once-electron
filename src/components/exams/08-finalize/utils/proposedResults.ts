import { SCORING_STATUS_LABELS } from "@/lib/shared/scoringStatusLabels"
import type { ScoreProposal } from "@/types/scoreDecision.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

/**
 * 同じ結果を出した採点者を1つにまとめたもの。
 *
 * 確定は「結果を選ぶ」操作であって「人を選ぶ」操作ではない。2人が同じ「正答」を
 * 付けていたら、どちらを採用したのかは決められないし、決める意味も無い。
 * よって表示の単位は判定＋点（類型評価なら類型）で、その結果を出した人は横に並ぶだけにする。
 */
interface ProposedResult {
  /** 判定＋点＋類型（行の同一性そのもの。React の key に使う） */
  key: string
  status: ScoringStatus
  partialScore: number | null
  /** 類型評価で付けた類型（評価済みのときだけ） */
  scaleLevelId: string | null
  scaleLevel: ScoreProposal["scaleLevel"]
  /** status と partialScore（類型評価なら類型の点数）から算出した実得点（束の中では全員同じ） */
  scoreValue: number | null
  /** この結果を出した採点者 */
  proposals: ScoreProposal[]
}

/**
 * 判定・点・類型が同じ提案は1つの結果として扱う（束ねるのは renderer 側の計算）。
 * 類型が違えば点数が同じでも別の結果（§4-8-5「類型が違えば食い違い」）
 */
export function groupProposalsByResult(
  proposals: readonly ScoreProposal[]
): ProposedResult[] {
  const resultByKey = new Map<string, ProposedResult>()
  for (const proposal of proposals) {
    const key = `${proposal.status}:${proposal.partialScore ?? ""}:${proposal.scaleLevelId ?? ""}`
    const result = resultByKey.get(key)
    if (result) {
      result.proposals.push(proposal)
    } else {
      resultByKey.set(key, {
        key,
        status: proposal.status,
        partialScore: proposal.partialScore,
        scaleLevelId: proposal.scaleLevelId,
        scaleLevel: proposal.scaleLevel,
        scoreValue: proposal.scoreValue,
        proposals: [proposal],
      })
    }
  }
  return [...resultByKey.values()]
}

/** 結果の呼び名。類型を付けた評価済みは「類型 A」、ほかは採点状態の名前 */
export function verdictLabelOf(
  status: ScoringStatus,
  scaleLevel: ScoreProposal["scaleLevel"]
): string {
  if (status === "evaluated" && scaleLevel) return `類型 ${scaleLevel.label}`
  return SCORING_STATUS_LABELS[status]
}
