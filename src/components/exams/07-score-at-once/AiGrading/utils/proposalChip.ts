/**
 * 一覧の答案の下に出す「AI の提案」の札の状態（docs/vlm-grading-design.md §10）。
 *
 * 表示中の試行から1つに決める。札の見た目（破線・文言）はこの状態だけから決まる。
 * AI の判定は提案で、点は問いかけの確定で入る（判定をそのまま自分の採点にする「採用」は廃止した）。
 */

import type { ReviewedAiGradingAnswer } from "./answerReview"

/**
 * - none: 試行が無い（AI未判定）
 * - awaiting: 結果待ち
 * - failed: 失敗・期限切れ
 * - refused: AI が判定を拒んだ
 * - proposal: 判定がある
 */
export type ProposalChipKind =
  "none" | "awaiting" | "failed" | "refused" | "proposal"

export const PROPOSAL_CHIP_LABELS: Record<ProposalChipKind, string> = {
  none: "AI未判定",
  awaiting: "結果待ち",
  failed: "失敗",
  refused: "拒否",
  proposal: "AI提案",
}

/** 札の状態を決める */
export function classifyProposalChip({
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
      return "proposal"
  }
}

/** 判定（状態の色・点）を札に出すか。成功した試行のものだけ */
export function hasJudgement(kind: ProposalChipKind): boolean {
  return kind === "proposal"
}
