/**
 * 問いかけの確定（docs/vlm-grading-design.md §3-5）で、何をどの順に教員の層へ書くか。
 *
 * 下書きのある問いだけを書く（確定済みで変えていない問いは書かない）。
 * 1. 採点方式（直接採点の設問で、問いかけの前に決めたもの）
 * 2. 案への答え: 選択肢なら項目を作って案の答案すべてに当てる（AI 採点では採点済みの答案も
 *    置き換える）。「その他」・1件ずつ採点なら、前に当てた項目を外す
 * 3. 項目から点を計算して書く（renderer。ここでは決めない）
 * 4. 教員が直接決めた点（1件ずつ採点・チェックで直す点）を、採点キーと同じ書き方で書く
 * 5. 4 まで書き終えた答え（1件ずつ採点の案・案の外の問いかけ）を確定済みにする
 */

import {
  isQuestioningScoringMethod,
  type QuestioningScoringMethod,
  SCORING_METHOD_STEP_ID,
} from "./gradingQuestions"
import type { QuestioningMode } from "./questioningReview"
import { scoredExamStudentIdsOf } from "./questioningReview"
import {
  hasDraft,
  optionOfDecision,
  type QuestioningScore,
  type QuestioningStepState,
} from "./questioningSteps"

/** 教員が直接決めた点1マス */
export interface QuestioningDirectScore extends QuestioningScore {
  examStudentId: string
}

export interface QuestioningCommitPlan {
  /** 変える採点方式。変えなければ null */
  scoringMethod: QuestioningScoringMethod | null
  /** 案への答えの確定（並びの順） */
  proposalCommits: {
    proposalId: string
    responseId: string
    choosesOption: boolean
    examStudentIds: string[]
  }[]
  /** 教員が直接決めた点（同じ答案に2つあれば並びの後ろが勝つ） */
  directScores: QuestioningDirectScore[]
  /** 点を書き終えてから確定済みにする答え（1件ずつ採点した案の答え） */
  proposalResponseIdsToMark: string[]
  /** 点を書き終えてから確定済みにする答え（案の外の問いかけの答案ごとの行） */
  attemptResponseIdsToMark: string[]
}

/** 確定で書くことを、下書きから決める */
export function planQuestioningCommit(
  states: readonly QuestioningStepState[],
  mode: QuestioningMode,
  ownScoreOf: (examStudentId: string) => QuestioningScore | null
): QuestioningCommitPlan {
  const drafts = states.filter(hasDraft)
  const methodDecision = drafts.find(
    (state) => state.step.id === SCORING_METHOD_STEP_ID
  )?.decision
  const scoringMethod =
    methodDecision?.kind === "option" &&
    isQuestioningScoringMethod(methodDecision.optionKey)
      ? methodDecision.optionKey
      : null

  const directScoreByExamStudentId = new Map<string, QuestioningDirectScore>()
  const plan: QuestioningCommitPlan = {
    scoringMethod,
    proposalCommits: [],
    directScores: [],
    proposalResponseIdsToMark: [],
    attemptResponseIdsToMark: [],
  }
  drafts.forEach((state) => {
    const { step, decision } = state
    if (!decision || step.kind === "scoringMethod") return
    if (step.kind === "proposal") {
      if (state.draftProposalResponseId === null) return
      plan.proposalCommits.push({
        proposalId: step.id,
        responseId: state.draftProposalResponseId,
        choosesOption: decision.kind === "option",
        examStudentIds: step.members.map((member) => member.examStudentId),
      })
      if (decision.kind === "manual") {
        plan.proposalResponseIdsToMark.push(state.draftProposalResponseId)
      }
    } else {
      plan.attemptResponseIdsToMark.push(...state.draftAttemptResponseIds)
    }
    // 教員が直接決めた点（案の選択肢の点は項目から計算するので入れない）
    const scoredIds = new Set(scoredExamStudentIdsOf(state, mode, ownScoreOf))
    const directScoreOf = (examStudentId: string): QuestioningScore | null => {
      if (decision.kind === "manual") {
        return decision.scores.get(examStudentId) ?? null
      }
      if (decision.kind === "option" && step.kind !== "proposal") {
        return optionOfDecision(step, decision)?.score ?? null
      }
      return null
    }
    step.members.forEach(({ examStudentId }) => {
      const score = directScoreOf(examStudentId)
      if (score && scoredIds.has(examStudentId)) {
        directScoreByExamStudentId.delete(examStudentId)
        directScoreByExamStudentId.set(examStudentId, {
          examStudentId,
          ...score,
        })
      }
    })
  })
  plan.directScores = [...directScoreByExamStudentId.values()]
  return plan
}
