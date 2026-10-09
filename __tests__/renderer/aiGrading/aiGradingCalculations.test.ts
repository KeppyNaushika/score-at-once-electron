/**
 * AI採点モードの計算（実行の履歴と一致率・注釈の用紙の向き）。
 * 費用の概算は `costEstimate.test.ts`。
 */

import { describe, expect, it } from "vitest"

import {
  inferPaperDimensionsFromInkGrid,
  placeAdoptionAnnotation,
} from "@/components/exams/07-score-at-once/AiGrading/utils/adoptionAnnotation"
import { resolveDisplayedAttempt } from "@/components/exams/07-score-at-once/AiGrading/utils/attemptSelection"
import {
  resolveChosenRunId,
  summarizeRunHistory,
} from "@/components/exams/07-score-at-once/AiGrading/utils/runHistory"

import {
  CROP_REGION_ID,
  CURRENT_USER_ID,
  makeAttempt,
  makeInk,
  makeQuestionScore,
  makeRun,
} from "./helpers/aiGradingRowFixtures"

describe("実行の履歴", () => {
  it("自分の採点の実行を新しい順に並べ、実行ごとに判定の数と一致を数える（採用した試行は数えない）", () => {
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
        makeAttempt({ examStudentId: "s3", adoptedAt: new Date() }),
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
      cropRegionId: CROP_REGION_ID,
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
      comparedCount: 2,
      exactMatchCount: 1,
      withinOnePointCount: 2,
    })
  })

  it("選んだ実行が無くなった・自分の採点の実行でないときは最新（null）として扱う", () => {
    const run = makeRun({ id: "run-1" })
    const reviseRun = makeRun({ id: "run-revise", purpose: "revise" })
    expect(resolveChosenRunId("run-1", [run], CURRENT_USER_ID)).toBe("run-1")
    expect(resolveChosenRunId("run-gone", [run], CURRENT_USER_ID)).toBeNull()
    expect(
      resolveChosenRunId("run-revise", [run, reviseRun], CURRENT_USER_ID)
    ).toBeNull()
    expect(resolveChosenRunId(null, [run], CURRENT_USER_ID)).toBeNull()
  })

  it("表示する試行: `<` `>` の選択 → 選んだ実行の試行 → 最新の成功", () => {
    const newerAttempt = makeAttempt({
      examStudentId: "s1",
      id: "attempt-newer",
      createdAt: new Date("2026-10-02T00:00:00.000Z"),
    })
    const olderAttempt = makeAttempt({
      examStudentId: "s1",
      id: "attempt-older",
      state: "errored",
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
    })
    const attempts = [
      { attempt: newerAttempt, run: makeRun({ id: "run-newer" }) },
      { attempt: olderAttempt, run: makeRun({ id: "run-older" }) },
    ]
    // 選んだ実行の試行は、失敗でもそれを出す
    expect(
      resolveDisplayedAttempt(attempts, undefined, "run-older")?.attempt.id
    ).toBe("attempt-older")
    // 答案ごとの選択が優先する
    expect(
      resolveDisplayedAttempt(attempts, "attempt-newer", "run-older")?.attempt
        .id
    ).toBe("attempt-newer")
    // 選んだ実行にこの答案の試行が無ければ最新の成功
    expect(
      resolveDisplayedAttempt(attempts, undefined, "run-elsewhere")?.attempt.id
    ).toBe("attempt-newer")
  })
})

describe("注釈の用紙の向き", () => {
  it("占有グリッドの列数・行数から、縦か横かを決める", () => {
    const portraitGrid = makeInk().inkGrid
    expect(inferPaperDimensionsFromInkGrid("A4", portraitGrid)).toEqual({
      width: 210,
      height: 297,
    })
    const landscapeGrid = {
      ...portraitGrid,
      cellWidth: 1 / 297,
      cellHeight: 1 / 210,
    }
    expect(inferPaperDimensionsFromInkGrid("A4", landscapeGrid)).toEqual({
      width: 297,
      height: 210,
    })
  })

  it("測れなかった答案でも、枠の中に置ける。注釈文が空なら置かない", () => {
    const region = { x: 0.1, y: 0.1, width: 0.5, height: 0.2 }
    const placement = placeAdoptionAnnotation({
      annotationText: "符号の誤り",
      inkGrid: null,
      region,
      pageSize: "A4",
      fontSizeMm: 5,
    })
    expect(placement).not.toBeNull()
    expect(placement?.x).toBeGreaterThanOrEqual(region.x)
    expect(placement?.y).toBeGreaterThanOrEqual(region.y)
    expect(
      placeAdoptionAnnotation({
        annotationText: "  ",
        inkGrid: null,
        region,
        pageSize: "A4",
        fontSizeMm: 5,
      })
    ).toBeNull()
  })
})
