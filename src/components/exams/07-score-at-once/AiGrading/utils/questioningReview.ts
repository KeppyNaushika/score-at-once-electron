/**
 * 問いかけの見直しと移り（docs/vlm-grading-design.md §3-5）の純粋な関数。
 *
 * 見直しの画面に出す件数（確定で点が付く答案・採点済みの答案の置き換え・再採点を指示した問い）と、
 * 答えたあとにどの問いへ移るかを求める。
 */

import {
  hasDraft,
  isSameQuestioningScore,
  optionOfDecision,
  type QuestioningScore,
  type QuestioningStepState,
} from "./questioningSteps"

/** AI 採点か、AI 採点チェックか */
export type QuestioningMode = "grade" | "check"

export interface QuestioningReviewSummary {
  /** 確定で点が付く答案（受験者。重なりは1件） */
  scoredExamStudentIds: string[]
  /** そのうち、いま自分の採点がある答案（AI 採点で置き換わるもの） */
  overwrittenExamStudentIds: string[]
  /** 下書きで「その他：再採点を指示」と答えた問いの数 */
  instructionCount: number
  /** 答えていない問いの数 */
  unansweredCount: number
  /** 下書きのある問いの数（0 なら確定するものが無い） */
  draftCount: number
}

/**
 * 問いの下書きで、確定で点が付く答案（受験者）。
 * チェックでは、いまの自分の採点と同じ点になる答案は数えない（変わらないので）
 */
export function scoredExamStudentIdsOf(
  state: QuestioningStepState,
  mode: QuestioningMode,
  ownScoreOf: (examStudentId: string) => QuestioningScore | null
): string[] {
  if (!hasDraft(state) || !state.decision) return []
  const changes = (examStudentId: string, score: QuestioningScore | null) => {
    if (mode !== "check" || score === null) return true
    const ownScore = ownScoreOf(examStudentId)
    return ownScore === null || !isSameQuestioningScore(ownScore, score)
  }
  const { decision, step } = state
  switch (decision.kind) {
    case "option": {
      const option = optionOfDecision(step, decision)
      if (!option?.writesScore) return []
      return step.members
        .map((member) => member.examStudentId)
        .filter((examStudentId) => changes(examStudentId, option.score))
    }
    case "manual":
      return [...decision.scores]
        .filter(([examStudentId, score]) => changes(examStudentId, score))
        .map(([examStudentId]) => examStudentId)
    case "instruction":
      return []
  }
}

/** 見直しの画面の件数 */
export function summarizeQuestioningReview(
  states: readonly QuestioningStepState[],
  mode: QuestioningMode,
  ownScoreOf: (examStudentId: string) => QuestioningScore | null
): QuestioningReviewSummary {
  const scoredExamStudentIds = [
    ...new Set(
      states.flatMap((state) => scoredExamStudentIdsOf(state, mode, ownScoreOf))
    ),
  ]
  return {
    scoredExamStudentIds,
    overwrittenExamStudentIds:
      mode === "grade"
        ? scoredExamStudentIds.filter(
            (examStudentId) => ownScoreOf(examStudentId) !== null
          )
        : [],
    instructionCount: states.filter(
      (state) => hasDraft(state) && state.decision?.kind === "instruction"
    ).length,
    unansweredCount: states.filter((state) => state.decision === null).length,
    draftCount: states.filter(hasDraft).length,
  }
}

/**
 * いま開く問い。開いた問いがあればそれ、無ければ答えていない最初の問い。
 * どれも答えてあれば null（下書きがあれば見直し、無ければ確定済み）
 */
export function resolveOpenedStepId(
  states: readonly QuestioningStepState[],
  openedStepId: string | null
): string | null {
  if (
    openedStepId !== null &&
    states.some((state) => state.step.id === openedStepId)
  ) {
    return openedStepId
  }
  return states.find((state) => state.decision === null)?.step.id ?? null
}

/**
 * 答えたあとに開く問い。並びの中で答えた問いより後ろの、答えていない問い。無ければ先頭からの
 * 答えていない問い（答えた問いは除く）。全部答えていれば null（見直しへ）
 */
export function nextUndecidedStepId(
  states: readonly QuestioningStepState[],
  decidedStepId: string
): string | null {
  const decidedIndex = states.findIndex(
    (state) => state.step.id === decidedStepId
  )
  const rotated = [
    ...states.slice(decidedIndex + 1),
    ...states.slice(0, Math.max(decidedIndex, 0)),
  ]
  return (
    rotated.find(
      (state) => state.step.id !== decidedStepId && state.decision === null
    )?.step.id ?? null
  )
}

/**
 * 前の問い（Ctrl/⌘+Shift+Enter）。並びの中の1つ前。見直し（問いを開いていない）からは最後の問い。
 * 先頭なら null（動かない）
 */
export function previousStepId(
  states: readonly QuestioningStepState[],
  currentStepId: string | null
): string | null {
  if (currentStepId === null) return states.at(-1)?.step.id ?? null
  const currentIndex = states.findIndex(
    (state) => state.step.id === currentStepId
  )
  return currentIndex > 0 ? states[currentIndex - 1].step.id : null
}
