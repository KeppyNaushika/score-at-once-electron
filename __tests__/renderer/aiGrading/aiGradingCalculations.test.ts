/**
 * AI採点モードの計算（実行の履歴と一致率）。
 * 費用の概算は `costEstimate.test.ts`。
 */

import { describe, expect, it } from "vitest"

import { resolveDisplayedAttempt } from "@/components/exams/07-score-at-once/AiGrading/utils/attemptSelection"
import {
  resolveChosenRunId,
  summarizeRunHistory,
} from "@/components/exams/07-score-at-once/AiGrading/utils/runHistory"

import {
  CROP_REGION_ID,
  CURRENT_USER_ID,
  makeAttempt,
  makeQuestionScore,
  makeRun,
} from "./helpers/aiGradingRowFixtures"

describe("実行の履歴", () => {
  it("自分の採点の実行を新しい順に並べ、実行ごとに判定の数と一致を数える", () => {
    const olderRun = makeRun({
      id: "run-older",
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
      attempts: [
        makeAttempt({ examStudentId: "s1" }),
        makeAttempt({
          examStudentId: "s2",
          status: "partial",
          partialScore: 3,
        }),
        makeAttempt({ examStudentId: "s3" }),
        makeAttempt({ examStudentId: "s4", state: "errored" }),
      ],
    })
    const newerRun = makeRun({
      id: "run-newer",
      model: "claude-haiku-4-5",
      createdAt: new Date("2026-10-02T00:00:00.000Z"),
      attempts: [makeAttempt({ examStudentId: "s1", status: "incorrect" })],
    })
    const reviseRun = makeRun({ id: "run-revise", purpose: "revise" })
    const otherUsersRun = makeRun({ id: "run-other", userId: "user-2" })

    const runHistory = summarizeRunHistory({
      runs: [olderRun, newerRun, reviseRun, otherUsersRun],
      questionScores: [
        makeQuestionScore({ examStudentId: "s1" }),
        makeQuestionScore({ examStudentId: "s2" }),
        makeQuestionScore({ examStudentId: "s3" }),
      ],
      cropRegion: { id: CROP_REGION_ID, scoringMethod: "points" },
      currentUserId: CURRENT_USER_ID,
      points: 4,
    })

    expect(runHistory.map((entry) => entry.run.id)).toEqual([
      "run-newer",
      "run-older",
    ])
    expect(runHistory[0]).toMatchObject({
      attemptCount: 1,
      succeededCount: 1,
      comparedCount: 1,
      exactMatchCount: 0,
      withinOnePointCount: 0,
    })
    expect(runHistory[1]).toMatchObject({
      attemptCount: 4,
      succeededCount: 3,
      comparedCount: 3,
      exactMatchCount: 2,
      withinOnePointCount: 3,
    })
  })

  it("選んだ実行が無くなった・自分の採点の実行でない・いまのタブの目的でないときは最新（null）として扱う", () => {
    const run = makeRun({ id: "run-1" })
    const checkRun = makeRun({ id: "run-check", purpose: "check" })
    const reviseRun = makeRun({ id: "run-revise", purpose: "revise" })
    expect(resolveChosenRunId("run-1", [run], CURRENT_USER_ID, "grade")).toBe(
      "run-1"
    )
    expect(
      resolveChosenRunId("run-gone", [run], CURRENT_USER_ID, "grade")
    ).toBeNull()
    expect(
      resolveChosenRunId(
        "run-revise",
        [run, reviseRun],
        CURRENT_USER_ID,
        "grade"
      )
    ).toBeNull()
    expect(resolveChosenRunId(null, [run], CURRENT_USER_ID, "grade")).toBeNull()
    // 履歴は目的ごとのタブに出すので、ほかの目的のタブ・採点指示のタブでは最新に見える
    expect(
      resolveChosenRunId("run-check", [run, checkRun], CURRENT_USER_ID, "check")
    ).toBe("run-check")
    expect(
      resolveChosenRunId("run-check", [run, checkRun], CURRENT_USER_ID, "grade")
    ).toBeNull()
    expect(
      resolveChosenRunId("run-1", [run, checkRun], CURRENT_USER_ID, null)
    ).toBeNull()
  })

  it("表示する試行: `<` `>` で選んだ実行の試行 → 最新の成功 → 最新", () => {
    // 最新の試行は失敗、成功はその1つ前（「最新」と「最新の成功」を区別するため）
    const newestErroredAttempt = makeAttempt({
      examStudentId: "s1",
      id: "attempt-newest",
      state: "errored",
      createdAt: new Date("2026-10-03T00:00:00.000Z"),
    })
    const succeededAttempt = makeAttempt({
      examStudentId: "s1",
      id: "attempt-succeeded",
      createdAt: new Date("2026-10-02T00:00:00.000Z"),
    })
    const oldestErroredAttempt = makeAttempt({
      examStudentId: "s1",
      id: "attempt-oldest",
      state: "errored",
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
    })
    const attempts = [
      { attempt: newestErroredAttempt, run: makeRun({ id: "run-newest" }) },
      { attempt: succeededAttempt, run: makeRun({ id: "run-succeeded" }) },
      { attempt: oldestErroredAttempt, run: makeRun({ id: "run-oldest" }) },
    ]
    // 選んだ実行の試行は、失敗でもそれを出す
    expect(resolveDisplayedAttempt(attempts, "run-oldest")?.attempt.id).toBe(
      "attempt-oldest"
    )
    // 選んだ実行にこの答案の試行が無ければ、最新の失敗ではなく最新の成功
    expect(resolveDisplayedAttempt(attempts, "run-elsewhere")?.attempt.id).toBe(
      "attempt-succeeded"
    )
    expect(resolveDisplayedAttempt(attempts, null)?.attempt.id).toBe(
      "attempt-succeeded"
    )
    // 成功が1つも無ければ最新（失敗も「失敗した」と見せる）
    expect(
      resolveDisplayedAttempt(
        attempts.filter(
          (attemptWithRun) => attemptWithRun.attempt.state === "errored"
        ),
        "run-elsewhere"
      )?.attempt.id
    ).toBe("attempt-newest")
  })
})
