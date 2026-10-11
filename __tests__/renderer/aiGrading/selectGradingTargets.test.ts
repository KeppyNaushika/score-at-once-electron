/**
 * 採点に送る答案（docs/vlm-grading-design.md §3-2）。
 *
 * - 選び方は4通り。どれも答案の並び順のまま返す
 *   - 未採点: 自分が未採点の答案（無答を付けた白紙も採点済みなので送らない）
 *   - 無答以外: 自分が無答を付けた答案だけを外す（採点済みでも送る。白紙は自動で判定しない）
 *   - 全て: 全ての答案
 *   - 選択: 一覧で選んでいる答案
 * - 他の教員の採点・別の設問の採点は数えない
 * - 設問の id が空なら投げる（全員が未採点に見えた試行の失敗の再発防止）
 */

import { describe, expect, it } from "vitest"

import {
  type GradingTargetSelectionInput,
  selectGradingTargets,
} from "@/components/exams/07-score-at-once/AiGrading/utils/selectGradingTargets"

import {
  CROP_REGION_ID,
  CURRENT_USER_ID,
  makeAnswer,
  makeQuestionScore,
} from "./helpers/aiGradingRowFixtures"

function buildInput(
  overrides: Partial<GradingTargetSelectionInput> = {}
): GradingTargetSelectionInput {
  return {
    cropRegionId: CROP_REGION_ID,
    currentUserId: CURRENT_USER_ID,
    answers: [
      makeAnswer("s-none"),
      makeAnswer("s-scored"),
      makeAnswer("s-no-answer"),
      makeAnswer("s-unscored-row"),
      makeAnswer("s-other-teacher"),
      makeAnswer("s-other-region"),
    ],
    questionScores: [
      makeQuestionScore({ examStudentId: "s-scored" }),
      // 白紙に付けた無答も採点済み
      makeQuestionScore({ examStudentId: "s-no-answer", status: "no_answer" }),
      // 未採点の行は「採点していない」
      makeQuestionScore({
        examStudentId: "s-unscored-row",
        status: "unscored",
      }),
      // 他の教員の採点は見ない
      makeQuestionScore({
        examStudentId: "s-other-teacher",
        userId: "user-other",
      }),
      // 別の設問の採点も見ない
      makeQuestionScore({
        examStudentId: "s-other-region",
        cropRegionId: "region-other",
      }),
    ],
    selectedExamStudentIds: new Set(["s-scored", "s-none"]),
    ...overrides,
  }
}

describe("selectGradingTargets", () => {
  it("未採点: 自分が未採点の答案だけを、答案の並び順のまま返す（無答を付けた答案は送らない）", () => {
    expect(selectGradingTargets(buildInput(), "unscored")).toEqual([
      "s-none",
      "s-unscored-row",
      "s-other-teacher",
      "s-other-region",
    ])
  })

  it("無答以外: 自分が無答を付けた答案だけを外し、採点済みの答案も送る", () => {
    expect(selectGradingTargets(buildInput(), "non_blank")).toEqual([
      "s-none",
      "s-scored",
      "s-unscored-row",
      "s-other-teacher",
      "s-other-region",
    ])
  })

  it("無答以外: 他の教員が付けた無答では外さない", () => {
    expect(
      selectGradingTargets(
        buildInput({
          questionScores: [
            makeQuestionScore({
              examStudentId: "s-no-answer",
              status: "no_answer",
              userId: "user-other",
            }),
          ],
        }),
        "non_blank"
      )
    ).toContain("s-no-answer")
  })

  it("全て: 採点済み・無答も含めて全ての答案を返す", () => {
    expect(selectGradingTargets(buildInput(), "all")).toEqual([
      "s-none",
      "s-scored",
      "s-no-answer",
      "s-unscored-row",
      "s-other-teacher",
      "s-other-region",
    ])
  })

  it("選択: 選んでいる答案だけを、選んだ順でなく答案の並び順で返す", () => {
    expect(selectGradingTargets(buildInput(), "selected")).toEqual([
      "s-none",
      "s-scored",
    ])
    expect(
      selectGradingTargets(
        buildInput({ selectedExamStudentIds: new Set() }),
        "selected"
      )
    ).toEqual([])
  })

  it("未採点: 何も採点していなければ全件を送る", () => {
    expect(
      selectGradingTargets(buildInput({ questionScores: [] }), "unscored")
    ).toEqual([
      "s-none",
      "s-scored",
      "s-no-answer",
      "s-unscored-row",
      "s-other-teacher",
      "s-other-region",
    ])
  })

  it("設問の id が空なら投げる（全員が未採点に見える失敗を防ぐ）", () => {
    expect(() =>
      selectGradingTargets(buildInput({ cropRegionId: "" }), "all")
    ).toThrow()
  })
})
