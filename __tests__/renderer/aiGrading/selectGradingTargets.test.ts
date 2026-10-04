/**
 * 採点する答案の選び方（docs/vlm-grading-design.md §3-2）。選び方ごとに1本ずつ固定する。
 *
 * - 白紙は常に除外し、境界帯はチェックしたときだけ送る
 * - 測れなかった答案は白紙とみなさない
 * - 設問の id が空なら投げる（全員が未採点に見えた試行の失敗の再発防止）
 */

import { describe, expect, it } from "vitest"

import type { AttemptWithRun } from "@/components/exams/07-score-at-once/AiGrading/types"
import {
  type GradingTargetSelectionInput,
  selectGradingTargets,
  selectGradingTargetsByMode,
} from "@/components/exams/07-score-at-once/AiGrading/utils/selectGradingTargets"

import {
  CROP_REGION_ID,
  CURRENT_USER_ID,
  makeAnswer,
  makeAttemptWithRun,
  makeInk,
  makeQuestionScore,
} from "./helpers/aiGradingRowFixtures"

const succeededOnPrompt1 = makeAttemptWithRun(
  { examStudentId: "s-ai", status: "partial", partialScore: 2 },
  { promptId: "prompt-1" }
)
const succeededOnPrompt0 = makeAttemptWithRun(
  { examStudentId: "s-old", id: "attempt-old" },
  { id: "run-0", promptId: "prompt-0" }
)
const erroredOnPrompt1 = makeAttemptWithRun(
  { examStudentId: "s-err", state: "errored", id: "attempt-err" },
  { promptId: "prompt-1" }
)

function buildInput(
  overrides: Partial<GradingTargetSelectionInput> = {}
): GradingTargetSelectionInput {
  const answers = [
    makeAnswer("s-none"),
    makeAnswer("s-scored"),
    makeAnswer("s-ai", { attempts: [succeededOnPrompt1] }),
    makeAnswer("s-old", { attempts: [succeededOnPrompt0] }),
    makeAnswer("s-err", { attempts: [erroredOnPrompt1] }),
    makeAnswer("s-blank", { inkMeasurement: makeInk({ blankness: "blank" }) }),
    makeAnswer("s-border", {
      inkMeasurement: makeInk({ blankness: "borderline" }),
    }),
    makeAnswer("s-unmeasured", { inkMeasurement: null }),
  ]
  const displayedAttemptByExamStudentId = new Map<
    string,
    AttemptWithRun | null
  >(
    answers.map((answer) => [
      answer.studentAnswerImage.examStudentId,
      answer.attempts[0] ?? null,
    ])
  )
  return {
    cropRegionId: CROP_REGION_ID,
    currentUserId: CURRENT_USER_ID,
    selectedPromptId: "prompt-1",
    points: 4,
    answers,
    questionScores: [
      makeQuestionScore({ examStudentId: "s-scored" }),
      // AI は部分点2点、自分は正答 → 食い違い
      makeQuestionScore({ examStudentId: "s-ai", status: "correct" }),
      // 未採点の行は「採点していない」
      makeQuestionScore({ examStudentId: "s-old", status: "unscored" }),
      // 他の教員の採点は見ない
      makeQuestionScore({ examStudentId: "s-none", userId: "user-other" }),
      // 別の設問の採点も見ない
      makeQuestionScore({
        examStudentId: "s-err",
        cropRegionId: "crop-region-other",
      }),
    ],
    displayedAttemptByExamStudentId,
    selectedExamStudentIds: new Set(["s-err", "s-blank"]),
    includeBorderline: false,
    ...overrides,
  }
}

describe("selectGradingTargets", () => {
  it("未採点のみ: 自分の採点が無い・未採点の答案（他の教員・別の設問の採点は数えない）", () => {
    expect(
      selectGradingTargets("unscored", buildInput()).examStudentIds
    ).toEqual(["s-none", "s-old", "s-err", "s-unmeasured"])
  })

  it("AI未判定のみ: 選んだプロンプトで成功した試行が無い答案（失敗・別プロンプトは未判定）", () => {
    expect(
      selectGradingTargets("notJudged", buildInput()).examStudentIds
    ).toEqual(["s-none", "s-scored", "s-old", "s-err", "s-unmeasured"])
  })

  it("採点済みの照合: 自分が採点済みの答案", () => {
    expect(
      selectGradingTargets("scoredCheck", buildInput()).examStudentIds
    ).toEqual(["s-scored", "s-ai"])
  })

  it("AIと食い違う答案: 表示中の成功した試行と自分の採点が違う答案", () => {
    expect(
      selectGradingTargets("disagreeing", buildInput()).examStudentIds
    ).toEqual(["s-ai"])
  })

  it("選択中の答案: 選んだ答案のうち白紙でないもの", () => {
    const selection = selectGradingTargets("selected", buildInput())
    expect(selection.examStudentIds).toEqual(["s-err"])
    expect(selection.excludedBlankCount).toBe(1)
  })

  it("全員: 白紙と境界帯を除き、測れなかった答案は送る", () => {
    const selection = selectGradingTargets("all", buildInput())
    expect(selection.examStudentIds).toEqual([
      "s-none",
      "s-scored",
      "s-ai",
      "s-old",
      "s-err",
      "s-unmeasured",
    ])
    expect(selection.excludedBlankCount).toBe(1)
    expect(selection.excludedBorderlineCount).toBe(1)
  })

  it("境界帯はチェックしたときだけ送る。白紙はチェックしても送らない", () => {
    const selection = selectGradingTargets(
      "all",
      buildInput({ includeBorderline: true })
    )
    expect(selection.examStudentIds).toContain("s-border")
    expect(selection.examStudentIds).not.toContain("s-blank")
    expect(selection.excludedBorderlineCount).toBe(0)
  })

  it("設問の id が空なら投げる（全員が未採点に見える失敗を防ぐ）", () => {
    expect(() =>
      selectGradingTargets("unscored", buildInput({ cropRegionId: "" }))
    ).toThrow()
  })

  it("選び方ごとの件数をまとめて出せる", () => {
    const selectionByMode = selectGradingTargetsByMode(buildInput())
    expect(selectionByMode.unscored.examStudentIds).toHaveLength(4)
    expect(selectionByMode.scoredCheck.examStudentIds).toHaveLength(2)
    expect(selectionByMode.all.examStudentIds).toHaveLength(6)
  })
})
