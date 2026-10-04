/**
 * AI の判定と自分の採点（QuestionScore）の突き合わせ（docs/vlm-grading-design.md §4-3）。
 *
 * 「AI と食い違う」「採用後に直した」「一致率」は、どれもここの比べ方1つから導く。
 * 比べ方が画面ごとに割れると、一覧では一致・表では不一致、が起きる。
 */

import { findQuestionScore } from "@/components/exams/07-score-at-once/types"
import type { QuestionScoreRow } from "@/queries/scoring"
import {
  type ScoringStatus,
  toScoringStatus,
} from "@/types/scoringStatus.types"

/** 比べるのに要る判定の形（試行と採点行の共通部分） */
interface Judgement {
  status: ScoringStatus
  partialScore: number | null
}

/**
 * 自分の採点を1件取る。
 *
 * **設問の id が空なら投げる。** 空のまま照合すると、どの採点行にも当たらず
 * 「全員が未採点」に見える（手作業の試行で実際に踏んだ失敗。設計 §10）。
 */
export function findOwnQuestionScore(
  questionScores: readonly QuestionScoreRow[],
  cropRegionId: string,
  examStudentId: string,
  currentUserId: string
): QuestionScoreRow | undefined {
  if (cropRegionId === "") {
    throw new Error("設問の id が空のまま採点を照合しようとしました")
  }
  return findQuestionScore(
    questionScores.filter(
      (questionScore) => questionScore.cropRegionId === cropRegionId
    ),
    examStudentId,
    currentUserId
  )
}

/** 自分が採点済みか（行が無い・未採点は採点していない） */
export function isScored(questionScore: QuestionScoreRow | undefined): boolean {
  return (
    questionScore !== undefined &&
    toScoringStatus(questionScore.status) !== "unscored"
  )
}

/**
 * 判定の点。配点が無い設問では正答の点を決められないので null。
 * 未採点・Wマークは点を持たないものとして 0 にする
 */
export function scoreOfJudgement(
  judgement: Judgement,
  points: number | null
): number | null {
  switch (judgement.status) {
    case "correct":
      return points
    case "partial":
    case "pending":
      return judgement.partialScore ?? 0
    case "incorrect":
    case "no_answer":
    case "double_mark":
    case "unscored":
      return 0
  }
}

/** 採点行を比べられる形にする */
export function judgementOfQuestionScore(
  questionScore: QuestionScoreRow
): Judgement {
  return {
    status: toScoringStatus(questionScore.status),
    partialScore: questionScore.partialScore,
  }
}

/** 判定と点がどちらも同じか（一致率の「完全一致」） */
export function isSameJudgement(
  judgementA: Judgement,
  judgementB: Judgement,
  points: number | null
): boolean {
  return (
    judgementA.status === judgementB.status &&
    scoreOfJudgement(judgementA, points) ===
      scoreOfJudgement(judgementB, points)
  )
}

/** 点の差が1点以内か。配点が無く点を決められないときは判定が同じかで代える */
export function isWithinOnePoint(
  judgementA: Judgement,
  judgementB: Judgement,
  points: number | null
): boolean {
  const scoreA = scoreOfJudgement(judgementA, points)
  const scoreB = scoreOfJudgement(judgementB, points)
  if (scoreA === null || scoreB === null) {
    return judgementA.status === judgementB.status
  }
  return Math.abs(scoreA - scoreB) <= 1
}

/**
 * AI の判定と自分の採点が食い違うか。自分が採点していなければ食い違いではない
 * （比べる相手が無い）
 */
export function isDisagreeing(
  aiJudgement: Judgement,
  questionScore: QuestionScoreRow | undefined,
  points: number | null
): boolean {
  if (!questionScore || !isScored(questionScore)) return false
  return !isSameJudgement(
    aiJudgement,
    judgementOfQuestionScore(questionScore),
    points
  )
}
