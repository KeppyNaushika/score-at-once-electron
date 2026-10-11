/**
 * 問いかけ（docs/vlm-grading-design.md §3-5）で、確定すると答案に付く予定の点。
 * 中央の一覧のマスに**未確定の見た目（斜線）**で出す（確定すれば自分の採点の塗りになる）。
 *
 * - 下書きのある問いは、決めたことで付く点
 * - いま開いている問いは、焦点のある選択肢（↑↓ で移す）で付く点。「1件ずつ自分で採点する」なら
 *   付けた途中の点。確定済みの答えと同じ選択肢なら出さない（もう入っている）
 * - 同じ答案に2つあれば、問いの並びの後ろが勝つ（確定の書き方と同じ）
 *
 * 点を加減する案の選択肢は、その項目1つだけが当たったとして計算する（ほかの項目との
 * 足し合わせは確定のときに項目から計算し直す）。直接採点のままなら点を出さない。
 */

import type { ScoringMethod } from "@/types/rubric.types"

import { computeRubricScore } from "../../Rubric/utils/rubricScore"
import {
  isQuestioningScoringMethod,
  SCORING_METHOD_STEP_ID,
} from "./gradingQuestions"
import {
  type QuestioningMode,
  scoredExamStudentIdsOf,
} from "./questioningReview"
import {
  isSameDecision,
  optionOfDecision,
  type QuestioningDecision,
  type QuestioningScore,
  type QuestioningStepState,
} from "./questioningSteps"

/** 点を加減する案の選択肢を計算するための、仮の項目の id（DB には書かない） */
const PREVIEW_ITEM_ID = "questioning-preview"

interface DraftScoresInput {
  states: readonly QuestioningStepState[]
  mode: QuestioningMode
  ownScoreOf: (examStudentId: string) => QuestioningScore | null
  /** いま開いている問いと、焦点のある選択肢で決めたとしたときの答え（無ければ null） */
  preview: { stepId: string; decision: QuestioningDecision | null } | null
  /** 選択肢の key → 点を加減する案の加減（加減する選択肢だけ） */
  pointDeltaOf: (optionKey: string) => number | null
  /** 設問のいまの採点方式 */
  scoringMethod: ScoringMethod
  points: number | null
}

/** 点を加減する選択肢を、その項目1つだけが当たったとして計算した点 */
function adjustedScoreOf(
  pointDelta: number,
  scoringMethod: ScoringMethod,
  points: number | null
): QuestioningScore | null {
  const outcome = computeRubricScore(
    { scoringMethod, points },
    [
      {
        id: PREVIEW_ITEM_ID,
        effectKind: "adjust",
        pointDelta,
        setStatus: null,
        setScore: null,
        sortOrder: 0,
        createdAt: new Date(0),
      },
    ],
    {
      overridesRubric: false,
      rubricApplications: [{ rubricItemId: PREVIEW_ITEM_ID }],
    }
  )
  return outcome.kind === "computed" && outcome.result.status !== "unscored"
    ? outcome.result
    : null
}

/** 受験者 → 確定すると付く予定の点 */
export function draftScoresOf({
  states,
  mode,
  ownScoreOf,
  preview,
  pointDeltaOf,
  scoringMethod,
  points,
}: DraftScoresInput): ReadonlyMap<string, QuestioningScore> {
  // 採点方式の問いの答え（下書きか、いま焦点のある選択肢）が、点を加減する案の計算に効く
  const methodDecision =
    preview?.stepId === SCORING_METHOD_STEP_ID
      ? preview.decision
      : states.find((state) => state.step.id === SCORING_METHOD_STEP_ID)
          ?.decision
  const effectiveMethod: ScoringMethod =
    methodDecision?.kind === "option" &&
    isQuestioningScoringMethod(methodDecision.optionKey)
      ? methodDecision.optionKey
      : scoringMethod

  const scores = new Map<string, QuestioningScore>()
  states.forEach((state) => {
    const isPreviewed = preview?.stepId === state.step.id
    const decision = isPreviewed ? preview.decision : state.decision
    if (decision === null || state.step.kind === "scoringMethod") return
    if (state.isCommitted && isSameDecision(state.decision, decision)) return
    const draftState = { ...state, decision, isCommitted: false }
    const scoredIds = scoredExamStudentIdsOf(draftState, mode, ownScoreOf)
    const scoreOf = (examStudentId: string): QuestioningScore | null => {
      if (decision.kind === "manual") {
        return decision.scores.get(examStudentId) ?? null
      }
      if (decision.kind !== "option") return null
      const option = optionOfDecision(state.step, decision)
      if (!option) return null
      if (option.score) return option.score
      const pointDelta = pointDeltaOf(option.key)
      return pointDelta === null
        ? null
        : adjustedScoreOf(pointDelta, effectiveMethod, points)
    }
    scoredIds.forEach((examStudentId) => {
      const score = scoreOf(examStudentId)
      if (!score) return
      scores.delete(examStudentId)
      scores.set(examStudentId, score)
    })
  })
  return scores
}
