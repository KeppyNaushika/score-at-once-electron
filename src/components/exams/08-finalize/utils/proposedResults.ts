import type { ScoreProposal } from "@/types/scoreDecision.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

/**
 * 同じ結果を出した採点者を1つにまとめたもの。
 *
 * 確定は「結果を選ぶ」操作であって「人を選ぶ」操作ではない。2人が同じ「正答」を
 * 付けていたら、どちらを採用したのかは決められないし、決める意味も無い。
 * よって表示の単位は判定＋点で、その結果を出した人は横に並ぶだけにする。
 */
export interface ProposedResult {
  /** 判定＋点（行の同一性そのもの。React の key に使う） */
  key: string
  status: ScoringStatus
  partialScore: number | null
  /** status と partialScore から算出した実得点（束の中では全員同じ） */
  scoreValue: number | null
  /** この結果を出した採点者 */
  proposals: ScoreProposal[]
}

/** 判定と点が同じ提案は1つの結果として扱う（束ねるのは renderer 側の計算） */
export function groupProposalsByResult(
  proposals: readonly ScoreProposal[]
): ProposedResult[] {
  const resultByKey = new Map<string, ProposedResult>()
  for (const proposal of proposals) {
    const key = `${proposal.status}:${proposal.partialScore ?? ""}`
    const result = resultByKey.get(key)
    if (result) {
      result.proposals.push(proposal)
    } else {
      resultByKey.set(key, {
        key,
        status: proposal.status,
        partialScore: proposal.partialScore,
        scoreValue: proposal.scoreValue,
        proposals: [proposal],
      })
    }
  }
  return [...resultByKey.values()]
}
