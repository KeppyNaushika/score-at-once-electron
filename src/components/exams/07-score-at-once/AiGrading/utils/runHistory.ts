/**
 * 設問の実行の履歴（docs/vlm-grading-design.md §3-3・§10）。
 *
 * 自分の採点の実行を新しい順に並べ、実行ごとに判定の数と自分の採点との一致率を数える。
 * 一覧に出す実行を選ぶのにも使う（選んだ実行の試行を、各答案の表示に使う）。
 *
 * **採用した試行は一致率に数えない。** 採用すると自分の採点がその試行の写しになり、
 * 一致して当然のものが一致率を押し上げる。
 */

import type { QuestionScoreRow } from "@/queries/scoring"

import type { AiGradingRunRow } from "../types"
import { isAdoptedAttempt } from "./attemptSelection"
import {
  findOwnQuestionScore,
  isSameJudgement,
  isScored,
  isWithinOnePoint,
  judgementOfQuestionScore,
} from "./scoreComparison"

/** 実行1件の集計（行は持ったまま、数だけを足す） */
export interface RunHistoryEntry {
  run: AiGradingRunRow
  attemptCount: number
  /** 判定が出た試行の数 */
  succeededCount: number
  /** 自分の採点と比べられた試行の数（自分が採点済み・採用していない） */
  comparedCount: number
  /** 判定と点がどちらも同じだった数 */
  exactMatchCount: number
  /** 点の差が1点以内だった数 */
  withinOnePointCount: number
}

export interface RunHistoryInput {
  runs: readonly AiGradingRunRow[]
  questionScores: readonly QuestionScoreRow[]
  cropRegionId: string
  currentUserId: string
  points: number | null
}

/** 自分の採点の実行（改訂は除く）を新しい順に（作成日時 → id の降順） */
function gradeRunsNewestFirst(
  runs: readonly AiGradingRunRow[],
  currentUserId: string
): AiGradingRunRow[] {
  return runs
    .filter((run) => run.purpose === "grade" && run.userId === currentUserId)
    .toSorted((runA, runB) => {
      const timeDifference =
        new Date(runB.createdAt).getTime() - new Date(runA.createdAt).getTime()
      return timeDifference !== 0
        ? timeDifference
        : runB.id.localeCompare(runA.id)
    })
}

/** 実行ごとの判定の数と、自分の採点との一致（新しい順） */
export function summarizeRunHistory({
  runs,
  questionScores,
  cropRegionId,
  currentUserId,
  points,
}: RunHistoryInput): RunHistoryEntry[] {
  return gradeRunsNewestFirst(runs, currentUserId).map((run) => {
    const succeededAttempts = run.attempts.filter(
      (attempt) => attempt.state === "succeeded"
    )
    const comparisons = succeededAttempts.flatMap((attempt) => {
      if (isAdoptedAttempt({ attempt, run })) return []
      const questionScore = findOwnQuestionScore(
        questionScores,
        cropRegionId,
        attempt.examStudentId,
        currentUserId
      )
      if (!questionScore || !isScored(questionScore)) return []
      const teacherJudgement = judgementOfQuestionScore(questionScore)
      return [
        {
          isExactMatch: isSameJudgement(attempt, teacherJudgement, points),
          isWithinOnePoint: isWithinOnePoint(attempt, teacherJudgement, points),
        },
      ]
    })
    return {
      run,
      attemptCount: run.attempts.length,
      succeededCount: succeededAttempts.length,
      comparedCount: comparisons.length,
      exactMatchCount: comparisons.filter(
        (comparison) => comparison.isExactMatch
      ).length,
      withinOnePointCount: comparisons.filter(
        (comparison) => comparison.isWithinOnePoint
      ).length,
    }
  })
}

/**
 * 一覧に出す実行として効いているもの。選んだ実行が消えた（古い判定を消した等）・
 * 自分の採点の実行でなければ null（＝最新）。選択を書き戻さず、毎回ここで導く
 */
export function resolveChosenRunId(
  chosenRunId: string | null,
  runs: readonly AiGradingRunRow[],
  currentUserId: string
): string | null {
  return gradeRunsNewestFirst(runs, currentUserId).some(
    (run) => run.id === chosenRunId
  )
    ? chosenRunId
    : null
}
