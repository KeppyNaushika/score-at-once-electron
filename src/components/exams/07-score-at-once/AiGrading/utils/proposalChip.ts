/**
 * 一覧の答案の下に出す「AI の提案」の札の状態（docs/vlm-grading-design.md §10）。
 *
 * 採用の前か後かを一目で分けるために、表示中の試行と自分の採点から1つに決める。
 * 札の見た目（破線・塗り・文言）はこの状態だけから決まる。
 */

import type { ReviewedAiGradingAnswer } from "./answerReview"
import { isScored } from "./scoreComparison"

/**
 * - none: 試行が無い（AI未判定）
 * - awaiting: 結果待ち
 * - failed: 失敗・期限切れ
 * - refused: AI が判定を拒んだ
 * - proposal: 判定があり、まだ採用していない
 * - adopted: 採用し、自分の採点が判定のまま
 * - changed: 採用したあとで自分の採点を変えた（未採点に戻したものも含む）
 */
export type ProposalChipKind =
  | "none"
  | "awaiting"
  | "failed"
  | "refused"
  | "proposal"
  | "adopted"
  | "changed"

export const PROPOSAL_CHIP_LABELS: Record<ProposalChipKind, string> = {
  none: "AI未判定",
  awaiting: "結果待ち",
  failed: "失敗",
  refused: "拒否",
  proposal: "AI提案",
  adopted: "採用済み",
  changed: "採用後に変更",
}

/** 札の状態を決める */
export function classifyProposalChip({
  answer,
  review,
}: ReviewedAiGradingAnswer): ProposalChipKind {
  const displayedAttempt = review.displayedAttempt
  if (!displayedAttempt) return "none"
  switch (displayedAttempt.attempt.state) {
    case "pending":
      return "awaiting"
    case "errored":
    case "expired":
      return "failed"
    case "refused":
      return "refused"
    case "succeeded":
      if (!review.isAdopted) return "proposal"
      return review.isChangedAfterAdoption || !isScored(answer.questionScore)
        ? "changed"
        : "adopted"
  }
}

/** 判定（状態の色・点）を札に出すか。成功した試行のものだけ */
export function hasJudgement(kind: ProposalChipKind): boolean {
  return kind === "proposal" || kind === "adopted" || kind === "changed"
}
