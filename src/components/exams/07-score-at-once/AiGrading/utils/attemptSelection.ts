/**
 * 表示する試行・既定のプロンプト・消してよい古い試行の決め方（docs/vlm-grading-design.md §4-3・§4-4）。
 */

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
    if (run.purpose !== "grade") continue
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
 * 表示する試行。教員が `<` `>` で選んだものがあればそれ、無ければ実行の履歴で選んだ
 * 実行の試行（失敗も「失敗した」と見せる）、それも無ければ最新の成功したもの、
 * それも無ければ最新のもの（失敗も「失敗した」と見せる）
 *
 * @param attempts 新しい順
 * @param chosenRunId 実行の履歴で選んだ実行（null は最新）
 */
export function resolveDisplayedAttempt(
  attempts: readonly AttemptWithRun[],
  chosenAttemptId: string | undefined,
  chosenRunId: string | null = null
): AttemptWithRun | null {
  const chosenAttempt = attempts.find(
    (attemptWithRun) => attemptWithRun.attempt.id === chosenAttemptId
  )
  if (chosenAttempt) return chosenAttempt
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
 * 既定で選ぶプロンプト。自分が最後に採点に使ったもの、無ければいちばん新しいもの
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
    .filter((run) => run.purpose === "grade" && run.userId === currentUserId)
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

/**
 * 消してよい古い試行（設計 §4-4）。答案ごとの最新・採用した試行・結果待ちは残す。
 * 他の教員の試行は main が残す（ここへは自分の試行だけが来る）
 *
 * @param attemptsPerAnswer 答案ごとの試行（新しい順）
 */
export function selectDeletableOldAttemptIds(
  attemptsPerAnswer: readonly (readonly AttemptWithRun[])[]
): string[] {
  return attemptsPerAnswer.flatMap((attempts) =>
    attempts
      .slice(1)
      .filter(
        (attemptWithRun) =>
          !isAdoptedAttempt(attemptWithRun) &&
          attemptWithRun.attempt.state !== "pending"
      )
      .map((attemptWithRun) => attemptWithRun.attempt.id)
  )
}

/**
 * `<` `>` で隣の試行へ移るときの試行 id。端なら null。
 *
 * @param attempts 新しい順（`<` は古い方＝添字が増える、`>` は新しい方）
 */
export function neighborAttemptId(
  attempts: readonly AttemptWithRun[],
  displayedAttemptId: string | null,
  direction: "older" | "newer"
): string | null {
  const displayedIndex = attempts.findIndex(
    (attemptWithRun) => attemptWithRun.attempt.id === displayedAttemptId
  )
  if (displayedIndex === -1) return null
  const neighbor =
    attempts[direction === "older" ? displayedIndex + 1 : displayedIndex - 1]
  return neighbor?.attempt.id ?? null
}
