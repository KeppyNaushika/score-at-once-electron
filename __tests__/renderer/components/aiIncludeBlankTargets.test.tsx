// @vitest-environment jsdom
/**
 * AI 採点の実行で「白紙と判定した答案も送る」（docs/vlm-grading-design.md §3-2）。
 *
 * ここで固定すること:
 * - 既定（オフ）では白紙と判定した答案を送らず、外した件数を数える
 * - オンなら白紙の答案も送る（判定が外れて書いてある答案を拾うため）。外した件数は 0 になる
 * - どちらでも、選び方に当てはまった白紙の件数（blankCount）は変わらない
 * - 境界帯の扱いは白紙の選択とは別（境界帯のチェックだけが決める）
 * - 画面: カードの内訳と、選んだ選び方での「白紙として外した N件」の案内が、選択に追従する
 *
 * 行は合成したもので、実データに触れない。
 */

import "../setup"

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"

import { AiGradingTargetSelector } from "@/components/exams/07-score-at-once/AiGrading/AiGradingTargetSelector"
import {
  type GradingTargetMode,
  type GradingTargetSelectionInput,
  selectGradingTargets,
  selectGradingTargetsByMode,
} from "@/components/exams/07-score-at-once/AiGrading/utils/selectGradingTargets"

import {
  CROP_REGION_ID,
  CURRENT_USER_ID,
  makeAnswer,
  makeInk,
} from "../aiGrading/helpers/aiGradingRowFixtures"

function buildInput(
  overrides: Partial<GradingTargetSelectionInput> = {}
): GradingTargetSelectionInput {
  return {
    cropRegionId: CROP_REGION_ID,
    currentUserId: CURRENT_USER_ID,
    selectedPromptId: "prompt-1",
    points: 4,
    answers: [
      makeAnswer("s-written", {
        inkMeasurement: makeInk({ blankness: "written" }),
      }),
      makeAnswer("s-blank-1", {
        inkMeasurement: makeInk({ blankness: "blank" }),
      }),
      makeAnswer("s-blank-2", {
        inkMeasurement: makeInk({ blankness: "blank" }),
      }),
      makeAnswer("s-border", {
        inkMeasurement: makeInk({ blankness: "borderline" }),
      }),
      makeAnswer("s-unmeasured", { inkMeasurement: null }),
    ],
    questionScores: [],
    displayedAttemptByExamStudentId: new Map(),
    selectedExamStudentIds: new Set(["s-blank-1"]),
    includeBorderline: false,
    includeBlank: false,
    ...overrides,
  }
}

describe("白紙と判定した答案も送るか（selectGradingTargets）", () => {
  it("オフなら白紙を外し、外した件数を数える", () => {
    const selection = selectGradingTargets("all", buildInput())
    expect(selection.examStudentIds).toEqual(["s-written", "s-unmeasured"])
    expect(selection.blankCount).toBe(2)
    expect(selection.excludedBlankCount).toBe(2)
    expect(selection.excludedBorderlineCount).toBe(1)
  })

  it("オンなら白紙も答案の並び順のまま送り、外した件数は 0 になる", () => {
    const selection = selectGradingTargets(
      "all",
      buildInput({ includeBlank: true })
    )
    expect(selection.examStudentIds).toEqual([
      "s-written",
      "s-blank-1",
      "s-blank-2",
      "s-unmeasured",
    ])
    expect(selection.blankCount).toBe(2)
    expect(selection.excludedBlankCount).toBe(0)
  })

  it("白紙の選択は境界帯に効かない（境界帯はそのチェックだけが決める）", () => {
    const blankOnly = selectGradingTargets(
      "all",
      buildInput({ includeBlank: true })
    )
    expect(blankOnly.examStudentIds).not.toContain("s-border")
    expect(blankOnly.excludedBorderlineCount).toBe(1)

    const both = selectGradingTargets(
      "all",
      buildInput({ includeBlank: true, includeBorderline: true })
    )
    expect(both.examStudentIds).toHaveLength(5)
    expect(both.excludedBorderlineCount).toBe(0)
  })

  it("白紙だけを選んでいる選び方は、オフでは0件・オンでは送れる", () => {
    expect(
      selectGradingTargets("selected", buildInput()).examStudentIds
    ).toEqual([])
    expect(
      selectGradingTargets("selected", buildInput({ includeBlank: true }))
        .examStudentIds
    ).toEqual(["s-blank-1"])
  })
})

/** ダイアログと同じく、選び方と2つの選択を手元に持って選択器を描く */
function SelectorHarness() {
  const [targetMode, setTargetMode] = useState<GradingTargetMode | null>(null)
  const [includeBorderline, setIncludeBorderline] = useState(false)
  const [includeBlank, setIncludeBlank] = useState(false)
  return (
    <AiGradingTargetSelector
      targetMode={targetMode}
      onTargetModeChange={setTargetMode}
      selectionByMode={selectGradingTargetsByMode(
        buildInput({ includeBorderline, includeBlank })
      )}
      includeBorderline={includeBorderline}
      onIncludeBorderlineChange={setIncludeBorderline}
      includeBlank={includeBlank}
      onIncludeBlankChange={setIncludeBlank}
    />
  )
}

describe("白紙と判定した答案も送る（AiGradingTargetSelector）", () => {
  it("既定はオフで、内訳に外した白紙の件数を出し、オンにすると件数と内訳が追従する", async () => {
    const user = userEvent.setup()
    render(<SelectorHarness />)

    const blankCheckbox = screen.getByRole("checkbox", {
      name: "白紙と判定した答案も送る",
    })
    expect(blankCheckbox).not.toBeChecked()
    expect(screen.getByTestId("ai-grading-target-count-all")).toHaveTextContent(
      "2"
    )
    expect(
      screen.getByTestId("ai-grading-target-excluded-all")
    ).toHaveTextContent("白紙 2件・境界帯 1件を除く")
    // 白紙だけを選んでいる選び方は、オフでは選べない
    expect(screen.getByRole("radio", { name: /選択中の答案/ })).toBeDisabled()

    await user.click(screen.getByRole("radio", { name: /全員/ }))
    expect(
      screen.getByTestId("ai-grading-target-blank-summary")
    ).toHaveTextContent("白紙として外した 2件")

    await user.click(blankCheckbox)
    expect(blankCheckbox).toBeChecked()
    expect(screen.getByTestId("ai-grading-target-count-all")).toHaveTextContent(
      "4"
    )
    expect(
      screen.getByTestId("ai-grading-target-excluded-all")
    ).toHaveTextContent("白紙 2件を含む・境界帯 1件を除く")
    expect(
      screen.getByTestId("ai-grading-target-blank-summary")
    ).toHaveTextContent("白紙と判定した 2件も送ります")
    expect(
      screen.getByRole("radio", { name: /選択中の答案/ })
    ).not.toBeDisabled()
  })
})
