"use client"

import { PROPOSAL_FILL_LEGEND } from "@/components/exams/07-score-at-once/ScoringGrid/constants/proposalFill"
import { getDynamicScoreStatusConfig } from "@/components/exams/07-score-at-once/ScoringGrid/constants/scoreStatusConfig"
import { useScoringStatusColors } from "@/hooks/07-score-at-once/useScoringStatusColors"
import { SCORING_STATUS_LABELS } from "@/lib/scoringStatusColors"

import { confidenceLabel, describeJudgement } from "./utils/answerDisplay"
import type { ReviewedAiGradingAnswer } from "./utils/answerReview"
import {
  classifyProposalChip,
  hasJudgement,
  PROPOSAL_CHIP_LABELS,
  type ProposalChipKind,
} from "./utils/proposalChip"
import {
  REVIEW_REASON_LABELS,
  type ReviewReason,
  reviewReasonsFrom,
} from "./utils/reviewReasons"
import { scoreOfJudgement } from "./utils/scoreComparison"

interface AiProposalChipsProps {
  reviewedAnswer: ReviewedAiGradingAnswer
  points: number | null
}

/** 札そのものが示すので、印としては出さない理由 */
const REASONS_SHOWN_IN_CHIP: ReadonlySet<ReviewReason> = new Set([
  "awaitingResult",
  "errored",
  "refused",
  "lowConfidence",
  "mediumConfidence",
])

/**
 * 札の枠。採用前（未確定）は破線の枠だけで、未確定であることはマスの斜線で示す。
 * 採用後（確定）は状態の色で塗りつぶす（style で付ける）。
 * 判定の無い札は灰色の破線で、色を持たない
 */
const CHIP_FRAME_CLASS: Record<ProposalChipKind, string> = {
  none: "border-dashed border-gray-300 bg-transparent text-gray-400",
  awaiting: "border-dashed border-gray-300 bg-transparent text-gray-500",
  failed: "border-dashed border-gray-300 bg-transparent text-gray-500",
  refused: "border-dashed border-gray-300 bg-transparent text-gray-500",
  proposal: "border-dashed bg-white",
  adopted: "border-solid",
  changed: "border-solid",
}

/** 確信度が高くないときに添える1文字 */
const CONFIDENCE_MARK: Record<string, string> = { medium: "中", low: "低" }

/**
 * 一覧の答案の下に出す、AI の提案の札（簡素に1行）。
 *
 * - 判定があれば「AI＋状態のアイコン＋点」だけ。未確定か確定かはマスの斜線・塗りが示すので、
 *   札は枠の線（未確定は破線、確定は塗り）だけで区別し、文字では書かない
 * - 確信度が中・低なら「中」「低」を添える
 * - 要確認の理由（AI 由来）と、アプリが画像から測った印は、小さな「!」1つにまとめ、
 *   中身はツールチップで AI 由来と画像由来に分けて示す（同じ並びに混ぜない）
 */
export function AiProposalChips({
  reviewedAnswer,
  points,
}: AiProposalChipsProps) {
  const statusConfig = getDynamicScoreStatusConfig(useScoringStatusColors())
  const { review } = reviewedAnswer
  const kind = classifyProposalChip(reviewedAnswer)
  const attempt = review.displayedAttempt?.attempt ?? null
  const judgement =
    attempt && hasJudgement(kind)
      ? { status: attempt.status, partialScore: attempt.partialScore }
      : null
  const config = judgement ? statusConfig[judgement.status] : null
  const Icon = config?.icon
  const score = judgement ? scoreOfJudgement(judgement, points) : null
  const confidenceMark = judgement
    ? CONFIDENCE_MARK[attempt?.confidence ?? ""]
    : undefined

  const aiNotes = [
    ...reviewReasonsFrom(review.reviewReasons, "ai"),
    ...reviewReasonsFrom(review.reviewReasons, "comparison"),
  ]
    .filter((reviewReason) => !REASONS_SHOWN_IN_CHIP.has(reviewReason))
    .map((reviewReason) => REVIEW_REASON_LABELS[reviewReason])
    .concat(review.isFromOtherPrompt ? ["別のプロンプトの判定"] : [])
  const noteLines = [
    ...(aiNotes.length > 0 ? [`AI: ${aiNotes.join("・")}`] : []),
  ]

  const chipTitle = judgement
    ? `AI: ${describeJudgement(judgement.status, judgement.partialScore)}（確信度 ${confidenceLabel(attempt?.confidence ?? "")}）・${PROPOSAL_CHIP_LABELS[kind]}\n${PROPOSAL_FILL_LEGEND}`
    : PROPOSAL_CHIP_LABELS[kind]

  return (
    <div
      className="flex items-center gap-1 text-[10px] leading-4"
      data-testid="ai-proposal-chips"
    >
      <span
        data-testid="ai-proposal-chip"
        data-kind={kind}
        title={chipTitle}
        className={`inline-flex items-center gap-0.5 rounded border px-1 ${CHIP_FRAME_CLASS[kind]}`}
        style={
          config
            ? kind === "proposal"
              ? { borderColor: config.iconStyle.color }
              : {
                  borderColor: config.iconStyle.color,
                  backgroundColor: config.bgStyle.backgroundColor,
                }
            : undefined
        }
      >
        {Icon && config && judgement ? (
          <>
            <span className="text-gray-500">AI</span>
            <Icon className="h-3 w-3 shrink-0" style={config.iconStyle} />
            <span className="font-medium" style={config.textStyle}>
              {score === null
                ? SCORING_STATUS_LABELS[judgement.status]
                : `${score}点`}
            </span>
            {confidenceMark && (
              <span className="font-medium text-amber-700">
                {confidenceMark}
              </span>
            )}
          </>
        ) : (
          PROPOSAL_CHIP_LABELS[kind]
        )}
      </span>
      {noteLines.length > 0 && (
        <span
          data-testid="ai-proposal-notes"
          title={noteLines.join("\n")}
          aria-label={noteLines.join("。")}
          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-amber-400 font-bold text-amber-700"
        >
          !
        </span>
      )}
    </div>
  )
}
