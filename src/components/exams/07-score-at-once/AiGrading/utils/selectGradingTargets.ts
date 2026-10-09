/**
 * 採点に送る答案（docs/vlm-grading-design.md §3-2）。
 *
 * 送るのは**自分が未採点の答案だけ**で、選び方は持たない。白紙はアプリが判定せず、
 * 教員が白さ順の一覧で無答を付けて外す（無答を1件も付けていなければ、結果として全件が送られる）。
 * 問いかけで決まった答案は採点済みになるので、次の往復では決まっていない答案だけが残る。
 */

import type { QuestionScoreRow } from "@/queries/scoring"

import type { AiGradingAnswer } from "../types"
import { findOwnQuestionScore, isScored } from "./scoreComparison"

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
}

/** 送る答案（自分が未採点のもの）の examStudentId を、答案の並び順のまま返す */
export function selectGradingTargets(
  input: GradingTargetSelectionInput
): string[] {
  if (input.cropRegionId === "") {
    throw new Error("設問の id が空のまま採点の対象を選ぼうとしました")
  }
  return input.answers
    .filter(
      (answer) =>
        !isScored(
          findOwnQuestionScore(
            input.questionScores,
            input.cropRegionId,
            answer.studentAnswerImage.examStudentId,
            input.currentUserId
          )
        )
    )
    .map((answer) => answer.studentAnswerImage.examStudentId)
}
