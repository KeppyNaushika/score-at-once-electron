/**
 * 案の外の問いかけ（採点チェックの問い・どの案にも入らない答案）の答えと、答案ごとの答えの行
 * （`AiAttemptResponse`）の行き来（docs/vlm-grading-design.md §3-5・§3-10）。
 *
 * 1つの問いの答えは、その問いの答案すべてに同じ種類の行を書く。読むときは、答案ごとの最新の行が
 * そろっていれば（同じ種類で、直す点も同じ）その答えとし、そろっていなければ（問いの顔ぶれが
 * 変わった・まだ答えていない答案がある）答えていないものとして扱う。
 */

import { toAiAttemptResponseChoice } from "@/types/aiGrading.types"
import { toScoringStatus } from "@/types/scoringStatus.types"

import type { AiGradingAttemptRow } from "../types"
import {
  isSameQuestioningScore,
  type QuestioningDecision,
  type QuestioningScore,
  type QuestioningStep,
} from "./questioningSteps"

/** 「このままにする」の選択肢の値 */
export const KEEP_OPTION_KEY = "keep"

/** 試行に同梱した答えの行1つ */
type AttemptResponseRow = AiGradingAttemptRow["responses"][number]

/** 答案（試行）ごとの最新の答え。まだ答えていなければ undefined */
export const latestAttemptResponse = (
  attempt: Pick<AiGradingAttemptRow, "responses">
): AttemptResponseRow | undefined => attempt.responses.at(-1)

/** 答えの行の点（判定の無い行は null） */
function scoreOfRow(row: AttemptResponseRow): QuestioningScore | null {
  return row.status === null
    ? null
    : { status: toScoringStatus(row.status), partialScore: row.partialScore }
}

/** 答案ごとの答えの行から読んだ、問いの答え */
export interface AttemptResponseDecision {
  decision: QuestioningDecision | null
  isCommitted: boolean
  draftAttemptResponseIds: string[]
}

const UNDECIDED: AttemptResponseDecision = {
  decision: null,
  isCommitted: false,
  draftAttemptResponseIds: [],
}

/** 問いの答案の最新の答えの行から、問いの答えを読む */
export function decisionFromAttemptResponses(
  step: Pick<QuestioningStep, "members" | "options">,
  latestResponseOf: (attemptId: string) => AttemptResponseRow | undefined
): AttemptResponseDecision {
  if (step.members.length === 0) return UNDECIDED
  const rows = step.members.map((member) => ({
    member,
    row: latestResponseOf(member.attemptId),
  }))
  const answeredRows = rows.flatMap(({ member, row }) =>
    row ? [{ member, row }] : []
  )
  if (answeredRows.length !== rows.length) return UNDECIDED
  const choices = new Set(
    answeredRows.map(({ row }) => toAiAttemptResponseChoice(row.choice))
  )
  if (choices.size !== 1) return UNDECIDED
  const [choice] = choices
  const decision = ((): QuestioningDecision | null => {
    switch (choice) {
      case "keep":
        return step.options.some((option) => option.key === KEEP_OPTION_KEY)
          ? { kind: "option", optionKey: KEEP_OPTION_KEY }
          : null
      case "rescore": {
        const [firstScore, ...restScores] = answeredRows.map(({ row }) =>
          scoreOfRow(row)
        )
        if (!firstScore) return null
        const isUniform = restScores.every(
          (score) => score !== null && isSameQuestioningScore(score, firstScore)
        )
        const option = step.options.find(
          (candidate) =>
            candidate.score !== null &&
            isSameQuestioningScore(candidate.score, firstScore)
        )
        return isUniform && option
          ? { kind: "option", optionKey: option.key }
          : null
      }
      case "manual":
        return {
          kind: "manual",
          scores: new Map(
            answeredRows.flatMap(({ member, row }) => {
              const score = scoreOfRow(row)
              return score ? [[member.examStudentId, score] as const] : []
            })
          ),
        }
      default:
        return null
    }
  })()
  if (!decision) return UNDECIDED
  return {
    decision,
    isCommitted: answeredRows.every(({ row }) => row.committedAt !== null),
    draftAttemptResponseIds: answeredRows.flatMap(({ row }) =>
      row.committedAt === null ? [row.id] : []
    ),
  }
}

/** 問いの答えを、答案ごとの答えの行（書く引数）にする */
export function attemptResponsesForDecision(
  step: Pick<QuestioningStep, "members" | "options">,
  decision: QuestioningDecision
): {
  attemptId: string
  choice: "rescore" | "keep" | "manual"
  status: QuestioningScore["status"] | null
  partialScore: number | null
}[] {
  switch (decision.kind) {
    case "option": {
      const option = step.options.find(
        (candidate) => candidate.key === decision.optionKey
      )
      const score = option?.score ?? null
      return step.members.map((member) => ({
        attemptId: member.attemptId,
        choice: score ? "rescore" : "keep",
        status: score?.status ?? null,
        partialScore: score?.partialScore ?? null,
      }))
    }
    case "manual":
      return step.members.map((member) => {
        const score = decision.scores.get(member.examStudentId)
        return {
          attemptId: member.attemptId,
          choice: "manual",
          status: score?.status ?? null,
          partialScore: score?.partialScore ?? null,
        }
      })
    case "instruction":
      // 案の外の問いかけには「その他」が無い
      return []
  }
}
