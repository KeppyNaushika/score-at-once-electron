/**
 * 類型評価（類型の組）の使われ方と編集の欄の読み取り（docs/vlm-grading-design.md §4-8-3・§4-8-3a）、
 * 類型評価をまたぐ方式の切り替えで方式と合わなくなる採点の数え方（§4-8-8）。
 *
 * ここで固定すること:
 * - 点数は 0 以上の有限の数だけを書く。空欄・`-`・負の数は書かない（配点を超えてよい）
 * - 新しい組の類型は、配点が分かれば配点から、無ければ 10点を満点として決める
 * - 類型の並べ替えは全類型を 0 から振り直す
 * - 共通の組を試験に戻す先: 03 からはその試験（ほかの試験が使っていれば戻せない）、
 *   管理の画面からは使っている試験がちょうど1つのときだけ
 * - 共通の組で使っている設問があるときだけ、点数・類型を直す前に確かめる
 * - 方式と合わない採点: 類型評価へは正答・誤答・部分点、点の採点へは評価済み
 */

import { describe, expect, it } from "vitest"

import {
  countIncompatibleScores,
  crossesScaleBoundary,
} from "@/components/exams/03-region-info/utils/scoringMethodSwitch"
import {
  defaultScaleLevels,
  examReturnTargetOf,
  moveScaleLevel,
  needsGlobalEditConfirmation,
  readScoreInput,
  scaleLevelUsageCount,
  scoreScaleUsageSummary,
} from "@/components/score-scales/utils/scoreScaleUsage"

const usingCropRegion = (cropRegionId: string, examId: string) => ({
  id: cropRegionId,
  examPage: { examId },
})

describe("readScoreInput", () => {
  it.each([
    ["10", 10],
    ["6", 6],
    ["0", 0],
    ["12.5", 12.5],
    [" 3 ", 3],
  ])("%s は点数 %s として書く", (text, score) => {
    expect(readScoreInput(text)).toEqual({ kind: "score", score })
  })

  it.each(["", " ", "-", ".", "-0.5", "abc", "Infinity"])(
    "%j は書かない",
    (text) => {
      expect(readScoreInput(text)).toEqual({ kind: "incomplete" })
    }
  )
})

describe("defaultScaleLevels", () => {
  it("配点が分かれば A=配点・B=6割・C=3割を 0.5 刻みで", () => {
    expect(defaultScaleLevels(7)).toEqual([
      { label: "A", score: 7 },
      { label: "B", score: 4 },
      { label: "C", score: 2 },
    ])
    expect(defaultScaleLevels(5)).toEqual([
      { label: "A", score: 5 },
      { label: "B", score: 3 },
      { label: "C", score: 1.5 },
    ])
  })

  it("配点が無い・0 なら 10点を満点として決める", () => {
    const tenPointLevels = [
      { label: "A", score: 10 },
      { label: "B", score: 6 },
      { label: "C", score: 3 },
    ]
    expect(defaultScaleLevels(null)).toEqual(tenPointLevels)
    expect(defaultScaleLevels(0)).toEqual(tenPointLevels)
  })
})

describe("moveScaleLevel", () => {
  it("1つ上へ動かすと、全類型を 0 から振り直す", () => {
    expect(moveScaleLevel(["a", "b", "c"], 2, 1)).toEqual([
      { id: "a", sortOrder: 0 },
      { id: "c", sortOrder: 1 },
      { id: "b", sortOrder: 2 },
    ])
  })

  it("1つ下へ動かす", () => {
    expect(moveScaleLevel(["a", "b", "c"], 0, 1)).toEqual([
      { id: "b", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
      { id: "c", sortOrder: 2 },
    ])
  })

  it("範囲外の位置からは動かさず、並びのまま振り直す", () => {
    expect(moveScaleLevel(["a", "b"], 5, 0)).toEqual([
      { id: "a", sortOrder: 0 },
      { id: "b", sortOrder: 1 },
    ])
  })
})

describe("scaleLevelUsageCount", () => {
  it("付けた採点・確定・項目の行を足す", () => {
    expect(
      scaleLevelUsageCount({
        questionScores: ["qs-1", "qs-2"],
        scoreDecisions: ["decision-1"],
        settingRubricItems: ["item-1"],
      })
    ).toBe(4)
  })
})

describe("examReturnTargetOf", () => {
  it("03 から: この試験の設問だけが使っていれば、この試験へ戻せる", () => {
    expect(
      examReturnTargetOf(
        { cropRegions: [usingCropRegion("q1", "exam-1")] },
        "exam-1"
      )
    ).toEqual({ kind: "available", examId: "exam-1" })
  })

  it("03 から: どこも使っていなければ、この試験へ戻せる", () => {
    expect(examReturnTargetOf({ cropRegions: [] }, "exam-1")).toEqual(
      { kind: "available", examId: "exam-1" }
    )
  })

  it("03 から: ほかの試験の設問も使っていれば戻せない", () => {
    expect(
      examReturnTargetOf(
        {
          cropRegions: [
            usingCropRegion("q1", "exam-1"),
            usingCropRegion("q2", "exam-2"),
          ],
        },
        "exam-1"
      )
    ).toEqual({ kind: "blocked", reason: "ほかの試験の設問も使っています" })
  })

  it("管理の画面から: 使っている試験がちょうど1つなら、その試験へ戻せる", () => {
    expect(
      examReturnTargetOf(
        {
          cropRegions: [
            usingCropRegion("q1", "exam-2"),
            usingCropRegion("q2", "exam-2"),
          ],
        },
        null
      )
    ).toEqual({ kind: "available", examId: "exam-2" })
  })

  it("管理の画面から: いくつもの試験が使っていれば戻せない", () => {
    expect(
      examReturnTargetOf(
        {
          cropRegions: [
            usingCropRegion("q1", "exam-1"),
            usingCropRegion("q2", "exam-2"),
          ],
        },
        null
      ).kind
    ).toBe("blocked")
  })

  it("管理の画面から: どこも使っていなければ戻す試験が無い", () => {
    expect(examReturnTargetOf({ cropRegions: [] }, null)).toEqual({
      kind: "blocked",
      reason: "使っている設問が無いので、戻す試験がありません",
    })
  })
})

describe("needsGlobalEditConfirmation / scoreScaleUsageSummary", () => {
  const usedTwice = {
    cropRegions: [
      usingCropRegion("q1", "exam-1"),
      usingCropRegion("q2", "exam-1"),
      usingCropRegion("q3", "exam-2"),
    ],
  }

  it("共通で使っている設問があるときだけ確かめる", () => {
    expect(
      needsGlobalEditConfirmation({ examId: null, ...usedTwice })
    ).toBe(true)
    expect(
      needsGlobalEditConfirmation({ examId: null, cropRegions: [] })
    ).toBe(false)
    expect(
      needsGlobalEditConfirmation({ examId: "exam-1", ...usedTwice })
    ).toBe(false)
  })

  it("試験の数は重ねずに数える", () => {
    expect(scoreScaleUsageSummary(usedTwice)).toEqual({
      examCount: 2,
      cropRegionCount: 3,
    })
  })
})

describe("類型評価をまたぐ方式の切り替え", () => {
  const questionScores = [
    { status: "correct" },
    { status: "incorrect" },
    { status: "partial" },
    { status: "pending" },
    { status: "no_answer" },
    { status: "unscored" },
    { status: "evaluated" },
  ]

  it("類型評価へ: 正答・誤答・部分点が方式と合わなくなる（保留・無答・未採点は数えない）", () => {
    expect(countIncompatibleScores(questionScores, "scale")).toBe(3)
  })

  it("点の採点へ: 評価済みが方式と合わなくなる", () => {
    expect(countIncompatibleScores(questionScores, "points")).toBe(1)
    expect(countIncompatibleScores(questionScores, "deduction")).toBe(1)
  })

  it("類型評価をまたぐかどうか", () => {
    expect(crossesScaleBoundary("points", "scale")).toBe(true)
    expect(crossesScaleBoundary("scale", "addition")).toBe(true)
    expect(crossesScaleBoundary("points", "deduction")).toBe(false)
    expect(crossesScaleBoundary("scale", "scale")).toBe(false)
  })
})
