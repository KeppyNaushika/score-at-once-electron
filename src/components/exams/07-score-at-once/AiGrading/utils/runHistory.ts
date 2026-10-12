/**
 * 設問の実行の履歴（docs/vlm-grading-design.md §3-3・§10）。
 *
 * 自分の採点の実行を新しい順に並べ、実行ごとに判定の数と自分の採点との一致率を数える。
 * 一覧に出す実行を選ぶのにも使う（選んだ実行の試行を、各答案の表示に使う）。
 */

import type { CropRegion } from "@prisma/client"

import type { QuestionScoreRow } from "@/queries/scoring"
import {
  type AiGradingStage1Purpose,
  isStage1RunPurpose,
} from "@/types/aiGrading.types"

import type { AiGradingRunRow } from "../types"
import {
  findOwnQuestionScore,
  isSameJudgement,
  isScored,
  isWithinOnePoint,
  judgementOfQuestionScore,
} from "./scoreComparison"

/** 実行1件の集計（行は持ったまま、数だけを足す） */
interface RunHistoryEntry {
  run: AiGradingRunRow
  attemptCount: number
  /** 判定が出た試行の数 */
  succeededCount: number
  /** 自分の採点と比べられた試行の数（自分が採点済みのもの） */
  comparedCount: number
  /** 判定と点がどちらも同じだった数 */
  exactMatchCount: number
  /** 点の差が1点以内だった数 */
  withinOnePointCount: number
}

interface RunHistoryInput {
  runs: readonly AiGradingRunRow[]
  questionScores: readonly QuestionScoreRow[]
  /** 設問（方式と合わない自分の採点は未採点として読み、比べない。§4-8-8） */
  cropRegion: Pick<CropRegion, "id" | "scoringMethod">
  currentUserId: string
  points: number | null
}

/** 自分の採点の実行（改訂は除く）を新しい順に（作成日時 → id の降順） */
function gradeRunsNewestFirst(
  runs: readonly AiGradingRunRow[],
  currentUserId: string
): AiGradingRunRow[] {
  return runs
    .filter(
      (run) => isStage1RunPurpose(run.purpose) && run.userId === currentUserId
    )
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
  cropRegion,
  currentUserId,
  points,
}: RunHistoryInput): RunHistoryEntry[] {
  return gradeRunsNewestFirst(runs, currentUserId).map((run) => {
    const succeededAttempts = run.attempts.filter(
      (attempt) => attempt.state === "succeeded"
    )
    const comparisons = succeededAttempts.flatMap((attempt) => {
      const questionScore = findOwnQuestionScore(
        questionScores,
        cropRegion,
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
 * 一覧に出す実行として効いているもの。履歴は AI 採点・AI チェックのタブに目的ごとに分けて出すので、
 * いまのタブの目的（採点指示のタブなら null）の実行でなければ null（＝最新）。選んだ実行が消えた・
 * 自分の採点の実行でないときも null。選択を書き戻さず、毎回ここで導く
 * （タブを移ると最新に見え、戻れば選んだ実行に戻る）
 */
export function resolveChosenRunId(
  chosenRunId: string | null,
  runs: readonly AiGradingRunRow[],
  currentUserId: string,
  purpose: AiGradingStage1Purpose | null
): string | null {
  return gradeRunsNewestFirst(runs, currentUserId).some(
    (run) => run.id === chosenRunId && run.purpose === purpose
  )
    ? chosenRunId
    : null
}

/** 履歴の行の呼び名（「採点 3」「チェック 1」） */
export const RUN_PURPOSE_LABELS: Record<AiGradingStage1Purpose, string> = {
  grade: "採点",
  check: "チェック",
}

/**
 * 実行の番号（目的ごとに古い順に 1 から。表示のためだけのもの）
 *
 * @param entries 新しい順
 */
export function numberRunsByPurpose(
  entries: readonly RunHistoryEntry[]
): Map<string, number> {
  const countByPurpose = new Map<string, number>()
  return new Map(
    entries.toReversed().map((entry) => {
      const runNumber = (countByPurpose.get(entry.run.purpose) ?? 0) + 1
      countByPurpose.set(entry.run.purpose, runNumber)
      return [entry.run.id, runNumber]
    })
  )
}
