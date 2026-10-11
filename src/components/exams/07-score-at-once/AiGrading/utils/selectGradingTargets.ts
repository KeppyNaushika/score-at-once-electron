/**
 * 採点に送る答案（docs/vlm-grading-design.md §3-2）。
 *
 * 送る答案は実行ダイアログで4通りから選ぶ（既定は自分が未採点の答案）。
 * 白紙はアプリが判定しない。教員が白さ順の一覧で無答を付けた答案を白紙とみなす
 * （「無答以外の全ての答案」は、自分の採点が無答のものだけを外す）。
 * 問いかけで決まった答案は採点済みになるので、未採点を送れば次の往復では決まっていない答案だけが残る。
 */

import type { QuestionScoreRow } from "@/queries/scoring"
import { toScoringStatus } from "@/types/scoringStatus.types"

import type { AiGradingAnswer } from "../types"
import { findOwnQuestionScore, isScored } from "./scoreComparison"

/** AI 採点で送る答案の選び方（並び順＝画面の並び順） */
export const GRADING_TARGET_SCOPES = [
  "unscored",
  "non_blank",
  "all",
  "selected",
] as const
/**
 * AI 採点チェックで送る答案の選び方（docs/vlm-grading-design.md §3-10）。scored は採点済みの答案
 * （自分が無答を付けたものを除く。既定）、scored_all は採点済みの全て
 */
export const CHECK_TARGET_SCOPES = ["scored", "scored_all", "selected"] as const
const ALL_TARGET_SCOPES = [
  ...GRADING_TARGET_SCOPES,
  ...CHECK_TARGET_SCOPES,
] as const
export type GradingTargetScope = (typeof ALL_TARGET_SCOPES)[number]

export function isGradingTargetScope(
  candidate: string
): candidate is GradingTargetScope {
  return ALL_TARGET_SCOPES.some((scope) => scope === candidate)
}

/** 送る答案を選ぶのに要る答案の形（行のまま） */
export interface GradingTargetAnswer {
  studentAnswerImage: Pick<
    AiGradingAnswer["studentAnswerImage"],
    "examStudentId"
  >
}

export interface GradingTargetSelectionInput {
  /** 採点する設問。空なら投げる（全員が未採点に見える失敗を防ぐ） */
  cropRegionId: string
  currentUserId: string
  answers: readonly GradingTargetAnswer[]
  /** 設問の採点行（誰の採点も混ざっていてよい。自分の分だけを見る） */
  questionScores: readonly QuestionScoreRow[]
  /** 中央の一覧で選んでいる答案の examStudentId（「選択した答案」で使う） */
  selectedExamStudentIds: ReadonlySet<string>
}

/** 選び方に合う答案の examStudentId を、答案の並び順のまま返す */
export function selectGradingTargets(
  input: GradingTargetSelectionInput,
  scope: GradingTargetScope
): string[] {
  if (input.cropRegionId === "") {
    throw new Error("設問の id が空のまま採点の対象を選ぼうとしました")
  }
  const ownQuestionScoreOf = (examStudentId: string) =>
    findOwnQuestionScore(
      input.questionScores,
      input.cropRegionId,
      examStudentId,
      input.currentUserId
    )
  const isTarget = (examStudentId: string): boolean => {
    switch (scope) {
      case "unscored":
        return !isScored(ownQuestionScoreOf(examStudentId))
      case "non_blank": {
        const ownQuestionScore = ownQuestionScoreOf(examStudentId)
        return (
          ownQuestionScore === undefined ||
          toScoringStatus(ownQuestionScore.status) !== "no_answer"
        )
      }
      case "all":
        return true
      case "scored": {
        const ownQuestionScore = ownQuestionScoreOf(examStudentId)
        return (
          isScored(ownQuestionScore) &&
          toScoringStatus(ownQuestionScore?.status ?? "unscored") !==
            "no_answer"
        )
      }
      case "scored_all":
        return isScored(ownQuestionScoreOf(examStudentId))
      case "selected":
        return input.selectedExamStudentIds.has(examStudentId)
    }
  }
  return input.answers
    .map((answer) => answer.studentAnswerImage.examStudentId)
    .filter(isTarget)
}
