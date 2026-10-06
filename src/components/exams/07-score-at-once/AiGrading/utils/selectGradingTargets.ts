/**
 * 採点する答案の選び方（docs/vlm-grading-design.md §3-2）。
 *
 * どの選び方も「選んだ答案の examStudentId を並べる」だけで、仕組みは同じ。
 * 白紙（インク率で判定）と境界帯は既定では送らず、それぞれ送るかどうかを選べる
 * （白紙の判定が外れて書いてある答案が落ちることがあるため、白紙も送れるようにしている）。
 * **測れなかった答案は白紙とみなさない**（白紙として落とすと、採点されないまま黙って残る）。
 *
 * 「採点結果が正しいかの判定」は新しい仕組みにしない。採点済みの答案を普通に採点し、
 * その結果を画面で突き合わせる（既存の点はモデルに見せない。アンカリングを避ける）。
 */

import type { QuestionScoreRow } from "@/queries/scoring"

import type { AiGradingAnswer, AttemptWithRun } from "../types"
import {
  findOwnQuestionScore,
  isDisagreeing,
  isScored,
} from "./scoreComparison"

/** 選び方（並び＝画面の並び） */
export const GRADING_TARGET_MODES = [
  "unscored",
  "notJudged",
  "scoredCheck",
  "disagreeing",
  "selected",
  "all",
] as const
export type GradingTargetMode = (typeof GRADING_TARGET_MODES)[number]

export const GRADING_TARGET_MODE_LABELS: Record<GradingTargetMode, string> = {
  unscored: "未採点のみ",
  notJudged: "AI未判定のみ",
  scoredCheck: "採点済みの照合",
  disagreeing: "AIと食い違う答案",
  selected: "選択中の答案",
  all: "全員",
}

export const GRADING_TARGET_MODE_DESCRIPTIONS: Record<
  GradingTargetMode,
  string
> = {
  unscored: "自分がまだ採点していない答案",
  notJudged: "選んだプロンプトでの成功した判定が無い答案",
  scoredCheck: "自分が採点済みの答案（採点結果が正しいかの確認）",
  disagreeing: "表示中の AI の判定と自分の採点が違う答案",
  selected: "一覧で選んでいる答案",
  all: "すべての答案",
}

/** 選び方に要る答案の形（行のまま） */
export type GradingTargetAnswer = Pick<
  AiGradingAnswer,
  "attempts" | "inkMeasurement"
> & {
  studentAnswerImage: Pick<
    AiGradingAnswer["studentAnswerImage"],
    "examStudentId"
  >
}

export interface GradingTargetSelectionInput {
  /** 採点する設問。空なら投げる（全員が未採点に見える失敗を防ぐ） */
  cropRegionId: string
  currentUserId: string
  /** 採点に使うプロンプト（AI未判定のみ の判断に使う） */
  selectedPromptId: string | null
  /** 設問の配点（食い違いの判断に使う） */
  points: number | null
  answers: readonly GradingTargetAnswer[]
  /** 設問の採点行（誰の採点も混ざっていてよい。自分の分だけを見る） */
  questionScores: readonly QuestionScoreRow[]
  /** 答案ごとに表示している試行（AIと食い違う答案 の判断に使う） */
  displayedAttemptByExamStudentId: ReadonlyMap<string, AttemptWithRun | null>
  /** 一覧で選んでいる答案 */
  selectedExamStudentIds: ReadonlySet<string>
  /** 境界帯（白紙かどうか際どい答案）も送るか */
  includeBorderline: boolean
  /** 白紙と判定した答案も送るか（判定が外れて書いてある答案を拾うため） */
  includeBlank: boolean
}

export interface GradingTargetSelection {
  /** 送る答案（答案の並び順のまま） */
  examStudentIds: string[]
  /** 選び方に当てはまった答案のうち、白紙と判定した答案の数（送るかどうかによらない） */
  blankCount: number
  /** 選び方に当てはまったが、白紙なので送らない答案の数（白紙も送るなら 0） */
  excludedBlankCount: number
  /** 選び方に当てはまったが、境界帯なので送らない答案の数 */
  excludedBorderlineCount: number
}

/** 選び方に当てはまるか（白紙の除外の前） */
function matchesMode(
  mode: GradingTargetMode,
  answer: GradingTargetAnswer,
  input: GradingTargetSelectionInput
): boolean {
  const { examStudentId } = answer.studentAnswerImage
  const questionScore = findOwnQuestionScore(
    input.questionScores,
    input.cropRegionId,
    examStudentId,
    input.currentUserId
  )
  switch (mode) {
    case "unscored":
      return !isScored(questionScore)
    case "notJudged":
      return !answer.attempts.some(
        (attemptWithRun) =>
          attemptWithRun.run.promptId === input.selectedPromptId &&
          attemptWithRun.attempt.state === "succeeded"
      )
    case "scoredCheck":
      return isScored(questionScore)
    case "disagreeing": {
      const displayedAttempt =
        input.displayedAttemptByExamStudentId.get(examStudentId) ?? null
      return (
        displayedAttempt !== null &&
        displayedAttempt.attempt.state === "succeeded" &&
        isDisagreeing(displayedAttempt.attempt, questionScore, input.points)
      )
    }
    case "selected":
      return input.selectedExamStudentIds.has(examStudentId)
    case "all":
      return true
  }
}

/** 選び方に従って、送る答案を選ぶ */
export function selectGradingTargets(
  mode: GradingTargetMode,
  input: GradingTargetSelectionInput
): GradingTargetSelection {
  if (input.cropRegionId === "") {
    throw new Error("設問の id が空のまま採点の対象を選ぼうとしました")
  }
  const matchedAnswers = input.answers.filter((answer) =>
    matchesMode(mode, answer, input)
  )
  const blankness = (answer: GradingTargetAnswer) =>
    answer.inkMeasurement?.blankness ?? null
  const blankCount = matchedAnswers.filter(
    (answer) => blankness(answer) === "blank"
  ).length

  return {
    examStudentIds: matchedAnswers
      .filter((answer) => input.includeBlank || blankness(answer) !== "blank")
      .filter(
        (answer) =>
          input.includeBorderline || blankness(answer) !== "borderline"
      )
      .map((answer) => answer.studentAnswerImage.examStudentId),
    blankCount,
    excludedBlankCount: input.includeBlank ? 0 : blankCount,
    excludedBorderlineCount: input.includeBorderline
      ? 0
      : matchedAnswers.filter((answer) => blankness(answer) === "borderline")
          .length,
  }
}

/** 選び方ごとの選択結果（ダイアログに件数を並べる） */
export function selectGradingTargetsByMode(
  input: GradingTargetSelectionInput
): Record<GradingTargetMode, GradingTargetSelection> {
  return {
    unscored: selectGradingTargets("unscored", input),
    notJudged: selectGradingTargets("notJudged", input),
    scoredCheck: selectGradingTargets("scoredCheck", input),
    disagreeing: selectGradingTargets("disagreeing", input),
    selected: selectGradingTargets("selected", input),
    all: selectGradingTargets("all", input),
  }
}
