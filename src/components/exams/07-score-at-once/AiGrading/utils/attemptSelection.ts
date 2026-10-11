/**
 * 表示する試行・既定の採点指示の決め方（docs/vlm-grading-design.md §4-3）。
 */

import { isStage1RunPurpose } from "@/types/aiGrading.types"

import type { AiGradingRunRow, AiPromptRow, AttemptWithRun } from "../types"

/** 試行に採用の記録があるか */
export function isAdoptedAttempt(attemptWithRun: AttemptWithRun): boolean {
  const { attempt } = attemptWithRun
  return (
    attempt.adoptedAt !== null ||
    attempt.adoptedQuestionScoreId !== null ||
    attempt.adoptedDrawingAnnotationId !== null
  )
}

/** 新しい順（作成日時 → id の降順。同時刻でも順が決まる） */
function compareNewestFirst(
  attemptA: AttemptWithRun,
  attemptB: AttemptWithRun
): number {
  const timeDifference =
    new Date(attemptB.attempt.createdAt).getTime() -
    new Date(attemptA.attempt.createdAt).getTime()
  if (timeDifference !== 0) return timeDifference
  return attemptB.attempt.id.localeCompare(attemptA.attempt.id)
}

/**
 * 実行の一覧を、答案ごとの試行（新しい順）に束ねる。
 * 改訂の実行は試行を持たないので、採点の実行だけが現れる
 */
export function groupAttemptsByExamStudent(
  runs: readonly AiGradingRunRow[]
): Map<string, AttemptWithRun[]> {
  const attemptsByExamStudentId = new Map<string, AttemptWithRun[]>()
  for (const run of runs) {
    if (!isStage1RunPurpose(run.purpose)) continue
    for (const attempt of run.attempts) {
      const attempts = attemptsByExamStudentId.get(attempt.examStudentId)
      if (attempts) {
        attempts.push({ attempt, run })
      } else {
        attemptsByExamStudentId.set(attempt.examStudentId, [{ attempt, run }])
      }
    }
  }
  for (const attempts of attemptsByExamStudentId.values()) {
    attempts.sort(compareNewestFirst)
  }
  return attemptsByExamStudentId
}

/**
 * 表示する試行。実行の履歴で選んだ実行の試行（失敗も「失敗した」と見せる）、
 * 無ければ最新の成功したもの、それも無ければ最新のもの（失敗も「失敗した」と見せる）
 *
 * @param attempts 新しい順
 * @param chosenRunId 実行の履歴で選んだ実行（null は最新）
 */
export function resolveDisplayedAttempt(
  attempts: readonly AttemptWithRun[],
  chosenRunId: string | null = null
): AttemptWithRun | null {
  const attemptOfChosenRun = attempts.find(
    (attemptWithRun) => attemptWithRun.run.id === chosenRunId
  )
  if (attemptOfChosenRun) return attemptOfChosenRun
  return (
    attempts.find(
      (attemptWithRun) => attemptWithRun.attempt.state === "succeeded"
    ) ??
    attempts[0] ??
    null
  )
}

/**
 * 既定で選ぶ採点指示。自分が最後に採点に使ったもの、無ければいちばん新しいもの
 *
 * @param prompts 古い順
 * @param runs 自分の実行
 */
export function resolveDefaultPromptId(
  prompts: readonly AiPromptRow[],
  runs: readonly AiGradingRunRow[],
  currentUserId: string
): string | null {
  const lastUsedPromptId = runs
    .filter(
      (run) => isStage1RunPurpose(run.purpose) && run.userId === currentUserId
    )
    .filter((run) => prompts.some((prompt) => prompt.id === run.promptId))
    .reduce<AiGradingRunRow | null>((latest, run) => {
      if (!latest) return run
      return new Date(run.createdAt).getTime() >=
        new Date(latest.createdAt).getTime()
        ? run
        : latest
    }, null)?.promptId
  return lastUsedPromptId ?? prompts.at(-1)?.id ?? null
}
