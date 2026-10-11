/**
 * 問いかけの画面の流れ（docs/vlm-grading-design.md §3-5・§3-6・§11）の純粋な関数。
 *
 * 実行の行（1段目・2段目）は main から届いたまま受け取り、いま画面に何を出すか
 * （走っている・失敗した・まだ案が無い・問いかけられる）を求める。問いの移り方は `questioningReview.ts`。
 */

import type { AiRubricProposalRunRow } from "@/queries/aiGrading"
import type { ScoringMethod } from "@/types/rubric.types"

import type { AiGradingRunRow } from "../types"
import type { AiRubricProposalRow } from "./rubricProposals"

/** まだ終わっていない実行の状態 */
const ACTIVE_RUN_STATUSES: ReadonlySet<string> = new Set([
  "queued",
  "submitting",
  "in_progress",
])

const timeOf = (dateTime: Date | string) => new Date(dateTime).getTime()

/**
 * 問いかけの前提の状態。
 *
 * - grading: 1段目（答案ごとの判定）が走っている。終われば2段目が自動で続く
 * - grouping: 2段目（項目の案）が走っている
 * - failed: 最後の2段目が失敗した（中止・期限切れも）。1段目から送り直せる
 * - notGrouped: 最後の1段目のあとに2段目が無い（自動で始まらなかった）。1段目から作れる
 * - idle: 2段目が無く、作れる1段目も無い
 * - ready: 問いかけに使う2段目がある（最後の2段目が終わっている）
 */
export type QuestioningStatus =
  | { kind: "grading" }
  | { kind: "grouping" }
  | { kind: "failed"; gradeRunId: string }
  | { kind: "notGrouped"; gradeRunId: string }
  | { kind: "idle" }
  | { kind: "ready" }

export function resolveQuestioningStatus(
  runs: readonly Pick<
    AiGradingRunRow,
    "id" | "purpose" | "status" | "createdAt" | "attempts"
  >[],
  proposalRuns: readonly Pick<AiRubricProposalRunRow, "status" | "createdAt">[]
): QuestioningStatus {
  const gradeRuns = runs.filter((run) => run.purpose === "grade")
  const latestGradeRun = gradeRuns.at(-1)
  const latestGroupRun = proposalRuns.at(-1)
  if (latestGradeRun && ACTIVE_RUN_STATUSES.has(latestGradeRun.status)) {
    return { kind: "grading" }
  }
  if (latestGroupRun && ACTIVE_RUN_STATUSES.has(latestGroupRun.status)) {
    return { kind: "grouping" }
  }
  const groupableGradeRun =
    latestGradeRun?.status === "ended" &&
    latestGradeRun.attempts.some((attempt) => attempt.state === "succeeded")
      ? latestGradeRun
      : null
  if (groupableGradeRun) {
    if (
      !latestGroupRun ||
      timeOf(latestGroupRun.createdAt) < timeOf(groupableGradeRun.createdAt)
    ) {
      return { kind: "notGrouped", gradeRunId: groupableGradeRun.id }
    }
    if (latestGroupRun.status !== "ended") {
      return { kind: "failed", gradeRunId: groupableGradeRun.id }
    }
  }
  return proposalRuns.some((run) => run.status === "ended")
    ? { kind: "ready" }
    : { kind: "idle" }
}

/**
 * 2段目の元になった1段目の実行（2段目より前に作られた、最後の1段目）。
 * 「どの案にも入らない答案」を、その1段目の試行から求める
 */
export function sourceGradeRunOf<
  Run extends Pick<AiGradingRunRow, "purpose" | "createdAt">,
>(
  groupRun: Pick<AiRubricProposalRunRow, "createdAt">,
  runs: readonly Run[]
): Run | null {
  return (
    runs.findLast(
      (run) =>
        run.purpose === "grade" &&
        timeOf(run.createdAt) <= timeOf(groupRun.createdAt)
    ) ?? null
  )
}

/**
 * 直接採点の設問で最初に問いかける採点方式の推奨。点を加減する案の推奨の選択肢が
 * 減点のほうが多ければ減点方式、加点のほうが多ければ加点方式（同数なら減点方式）
 */
export function recommendedScoringMethodOf(
  proposals: readonly Pick<AiRubricProposalRow, "options">[]
): Exclude<ScoringMethod, "points"> {
  const deltas = proposals.flatMap((proposal) => {
    const recommended = proposal.options.find((option) => option.recommended)
    return recommended?.effectKind === "adjust" &&
      recommended.pointDelta !== null
      ? [recommended.pointDelta]
      : []
  })
  const addCount = deltas.filter((pointDelta) => pointDelta > 0).length
  const deductCount = deltas.filter((pointDelta) => pointDelta < 0).length
  return addCount > deductCount ? "addition" : "deduction"
}
