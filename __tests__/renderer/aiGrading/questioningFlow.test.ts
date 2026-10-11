/**
 * 問いかけの画面の流れの純粋な関数（docs/vlm-grading-design.md §3-5・§3-6）。行はすべて作り物。
 */

import { describe, expect, it } from "vitest"

import {
  recommendedScoringMethodOf,
  resolveQuestioningStatus,
} from "@/components/exams/07-score-at-once/AiGrading/utils/questioningFlow"

import { makeAttempt, makeRun } from "./helpers/aiGradingRowFixtures"

const EARLY = new Date("2026-10-01T00:00:00.000Z")
const LATE = new Date("2026-10-01T01:00:00.000Z")

const endedGradeRun = makeRun({
  id: "grade-run-1",
  status: "ended",
  createdAt: EARLY,
  attempts: [makeAttempt({ examStudentId: "s1" })],
})

describe("問いかけの前提の状態", () => {
  it("1段目・2段目が走っていればそれを示す", () => {
    expect(
      resolveQuestioningStatus(
        [{ ...endedGradeRun, status: "in_progress" }],
        []
      )
    ).toEqual({ kind: "grading" })
    expect(
      resolveQuestioningStatus(
        [endedGradeRun],
        [{ status: "in_progress", createdAt: LATE }]
      )
    ).toEqual({ kind: "grouping" })
  })

  it("最後の2段目が失敗していれば、元の1段目から送り直す", () => {
    expect(
      resolveQuestioningStatus(
        [endedGradeRun],
        [
          { status: "ended", createdAt: EARLY },
          { status: "failed", createdAt: LATE },
        ]
      )
    ).toEqual({ kind: "failed", gradeRunId: "grade-run-1" })
  })

  it("最後の1段目のあとに2段目が無ければ作れる。判定が1つも無ければ作れない", () => {
    expect(resolveQuestioningStatus([endedGradeRun], [])).toEqual({
      kind: "notGrouped",
      gradeRunId: "grade-run-1",
    })
    const noJudgement = {
      ...endedGradeRun,
      attempts: [makeAttempt({ examStudentId: "s1", state: "errored" })],
    }
    expect(resolveQuestioningStatus([noJudgement], [])).toEqual({
      kind: "idle",
    })
  })

  it("最後の2段目が終わっていれば問いかけられる", () => {
    expect(
      resolveQuestioningStatus(
        [endedGradeRun],
        [{ status: "ended", createdAt: LATE }]
      )
    ).toEqual({ kind: "ready" })
  })
})

describe("採点方式の推奨", () => {
  it("推奨の選択肢が加点のほうが多ければ加点方式、それ以外は減点方式", () => {
    const withDelta = (pointDelta: number) => ({
      options: [
        {
          id: `option-${pointDelta}`,
          proposalId: "proposal",
          effectKind: "adjust",
          pointDelta,
          setStatus: null,
          setScore: null,
          rationale: "",
          recommended: true,
          sortOrder: 0,
          createdAt: LATE,
          updatedAt: LATE,
        },
      ],
    })
    expect(recommendedScoringMethodOf([withDelta(1), withDelta(2)])).toBe(
      "addition"
    )
    expect(recommendedScoringMethodOf([withDelta(1), withDelta(-1)])).toBe(
      "deduction"
    )
  })
})
