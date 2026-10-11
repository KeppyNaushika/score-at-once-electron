/**
 * 2段目の項目の案と、問いかけへの答えの純粋な関数（docs/vlm-grading-design.md §3-4・§3-5・§5-4）。
 *
 * 案・選択肢・答案・答えは main から届いた行（include の木）のまま受け取り、状態（未回答か・
 * 案の並び・答える答案・答えると何が起こるか）はここで求める。列には持たない。
 */

import type { RubricItemEffect } from "@/lib/shared/rubric/rubricItemValidator"
import type { AiRubricProposalRunRow } from "@/queries/aiGrading"
import { toAiGradingConfidence } from "@/types/aiGrading.types"

import type { AiGradingAttemptRow } from "../types"

/** 項目の案1つ（選択肢・答案（試行付き）・答え付き） */
export type AiRubricProposalRow =
  AiRubricProposalRunRow["rubricProposals"][number]
/** 案の選択肢1つ */
type AiRubricProposalOptionRow = AiRubricProposalRow["options"][number]
/** 問いかけへの答え1つ */
export type AiRubricProposalResponseRow =
  AiRubricProposalRow["responses"][number]

/** 最新の答え（答え直しは新しい行で、最新が効く）。まだ答えていなければ null */
export function latestProposalResponse(
  proposal: Pick<AiRubricProposalRow, "responses">
): AiRubricProposalResponseRow | null {
  return proposal.responses.at(-1) ?? null
}

/**
 * 答えの種類。option は選択肢を選んだ、instruction は「その他」に再採点への指示を書いた、
 * manual は1件ずつ自分で採点した（答案ごとの点は答えの `scores`。前の版の「選ばずに進んだ」答えも、
 * 点の無い1件ずつ採点として読む）。答えの行に種類の列は持たず、選択肢と指示の有無から導く
 */
export type AiRubricProposalAnswerKind = "option" | "instruction" | "manual"

export function proposalAnswerKindOf(
  response: Pick<AiRubricProposalResponseRow, "optionId" | "freeText">
): AiRubricProposalAnswerKind {
  if (response.optionId !== null) return "option"
  return response.freeText.trim() === "" ? "manual" : "instruction"
}

/**
 * 案の種類。matched は既存の項目に当たる案（その項目を当てる案だけを示す）、
 * set は推奨の選択肢が判定を決める案、adjust は点を加減する案
 */
export type AiRubricProposalKind = "matched" | "set" | "adjust"

export function proposalKindOf(
  proposal: Pick<AiRubricProposalRow, "matchedRubricItemId" | "options">
): AiRubricProposalKind {
  if (proposal.matchedRubricItemId !== null) return "matched"
  const recommended = proposal.options.find((option) => option.recommended)
  return recommended?.effectKind === "set" ? "set" : "adjust"
}

const PROPOSAL_KIND_ORDER: Readonly<Record<AiRubricProposalKind, number>> = {
  matched: 0,
  set: 1,
  adjust: 2,
}

/**
 * 問いかける順に並べる（§3-5・§11）: 既存の項目に当たる案 → 判定を決める案 → 点を加減する案。
 * 同じ種類の中は、2段目が返した順
 */
export function orderProposalsForQuestioning<
  Proposal extends Pick<
    AiRubricProposalRow,
    "matchedRubricItemId" | "options" | "sortOrder"
  >,
>(proposals: readonly Proposal[]): Proposal[] {
  return [...proposals].sort(
    (left, right) =>
      PROPOSAL_KIND_ORDER[proposalKindOf(left)] -
        PROPOSAL_KIND_ORDER[proposalKindOf(right)] ||
      left.sortOrder - right.sortOrder
  )
}

const CONFIDENCE_ORDER = { low: 0, medium: 1, high: 2 } as const

/** 案の中の答案を、確信度の低い順に並べる（§3-5。同じ確信度の中は元の順） */
export function orderMembersByConfidence<
  Member extends { attempt: Pick<AiGradingAttemptRow, "confidence"> },
>(members: readonly Member[]): Member[] {
  return [...members].sort(
    (left, right) =>
      CONFIDENCE_ORDER[toAiGradingConfidence(left.attempt.confidence)] -
      CONFIDENCE_ORDER[toAiGradingConfidence(right.attempt.confidence)]
  )
}

/** 最後に終わった2段目の実行（問いかけに使う）。無ければ null */
export function latestEndedProposalRun<
  Run extends Pick<AiRubricProposalRunRow, "status">,
>(runs: readonly Run[]): Run | null {
  return runs.findLast((run) => run.status === "ended") ?? null
}

/**
 * 1段目の判定が出たのに、2段目のどの案にも入らず、既存の項目にも当たらなかった答案
 * （正答は除く）。「判断できない」として教員に残す（§6-2）
 */
export function attemptsOutsideProposals<
  Attempt extends Pick<AiGradingAttemptRow, "id" | "state" | "status"> & {
    rubricMatches: readonly unknown[]
  },
>(
  gradeAttempts: readonly Attempt[],
  proposals: readonly Pick<AiRubricProposalRow, "members">[]
): Attempt[] {
  const memberAttemptIds = new Set(
    proposals.flatMap((proposal) =>
      proposal.members.map((member) => member.attemptId)
    )
  )
  return gradeAttempts.filter(
    (attempt) =>
      attempt.state === "succeeded" &&
      attempt.status !== "correct" &&
      attempt.rubricMatches.length === 0 &&
      !memberAttemptIds.has(attempt.id)
  )
}

/** 選択肢の効き方（RubricItem と同じ形）。項目を作る・変えるときの値 */
export function optionEffectOf(
  option: Pick<
    AiRubricProposalOptionRow,
    "effectKind" | "pointDelta" | "setStatus" | "setScore"
  >
): RubricItemEffect {
  return {
    effectKind: option.effectKind,
    pointDelta: option.pointDelta,
    setStatus: option.setStatus,
    setScore: option.setScore,
  }
}

/**
 * 確定すると、ルーブリック項目に何が起こるか（main の `commitAiRubricProposalResponse` と同じ決め方）。
 *
 * - link: 既存の項目に当たる案。その項目を当てるだけで、値は変えない
 * - update: 前に確定した答えで作った項目がある。その項目の効き方を選んだ選択肢に変える（選び直し。
 *   他の採点者の点も変わるので、確認と計算し直しが要る）
 * - create: 新しい項目を作る
 * - unapply: 「その他」か1件ずつ採点。前に確定した答えで当てた項目があれば外す
 */
export type AiRubricProposalAnswerPlan =
  | { kind: "link" | "update"; rubricItemId: string }
  | { kind: "create" }
  | { kind: "unapply"; unappliedRubricItemId: string | null }

export function planProposalAnswer(
  proposal: Pick<AiRubricProposalRow, "matchedRubricItemId" | "responses">,
  choosesOption: boolean,
  livingRubricItemIds: ReadonlySet<string>
): AiRubricProposalAnswerPlan {
  const previousItemId = proposal.responses.findLast(
    (response) =>
      response.committedAt !== null && response.resultRubricItemId !== null
  )?.resultRubricItemId
  const livingPreviousItemId =
    previousItemId && livingRubricItemIds.has(previousItemId)
      ? previousItemId
      : null
  if (!choosesOption) {
    return { kind: "unapply", unappliedRubricItemId: livingPreviousItemId }
  }
  if (
    proposal.matchedRubricItemId !== null &&
    livingRubricItemIds.has(proposal.matchedRubricItemId)
  ) {
    return { kind: "link", rubricItemId: proposal.matchedRubricItemId }
  }
  if (livingPreviousItemId) {
    return { kind: "update", rubricItemId: livingPreviousItemId }
  }
  return { kind: "create" }
}
