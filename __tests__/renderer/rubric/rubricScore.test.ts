/**
 * ルーブリック項目の適用からの点の計算（docs/vlm-grading-design.md §4-4・§4-8-6）。
 * 方式・set の優先・範囲への収め・上書きの飛ばしを表で確かめる。
 * 類型方式の設問では、類型にする項目が類型を決め、加減・正答などの項目は効かない。
 */

import { describe, expect, it } from "vitest"

import type { RubricScoringItem } from "@/components/exams/07-score-at-once/Rubric/types"
import {
  computeRubricScore,
  isSameRubricScore,
} from "@/components/exams/07-score-at-once/Rubric/utils/rubricScore"

const CREATED_AT = new Date("2026-10-01T00:00:00.000Z")

const adjust = (id: string, pointDelta: number): RubricScoringItem => ({
  id,
  effectKind: "adjust",
  pointDelta,
  setStatus: null,
  setScore: null,
  setScaleLevelId: null,
  sortOrder: 0,
  createdAt: CREATED_AT,
})

const setItem = (
  id: string,
  setStatus: string,
  setScore: number | null,
  sortOrder: number,
  setScaleLevelId: string | null = null
): RubricScoringItem => ({
  id,
  effectKind: "set",
  pointDelta: null,
  setStatus,
  setScore,
  setScaleLevelId,
  sortOrder,
  createdAt: CREATED_AT,
})

const ITEMS: RubricScoringItem[] = [
  adjust("unit-missing", -2),
  adjust("process-missing", -3),
  adjust("alternative", 4),
  setItem("model-answer", "correct", null, 0),
  setItem("answer-only", "partial", 2, 1),
  setItem("unreadable", "pending", null, 2),
]

const applied = (...rubricItemIds: string[]) => ({
  overridesRubric: false,
  rubricApplications: rubricItemIds.map((rubricItemId) => ({ rubricItemId })),
})

const deduction = { scoringMethod: "deduction", points: 10, scaleLevelIds: [] }
const addition = { scoringMethod: "addition", points: 10, scaleLevelIds: [] }
const scale = {
  scoringMethod: "scale",
  points: 10,
  scaleLevelIds: ["level-a", "level-b"],
}

describe("computeRubricScore", () => {
  it.each([
    ["減点1つ", deduction, ["unit-missing"], "partial", 8],
    ["減点2つ", deduction, ["unit-missing", "process-missing"], "partial", 5],
    ["加点", addition, ["alternative"], "partial", 4],
  ] as const)("%s", (_name, region, rubricItemIds, status, partialScore) => {
    const outcome = computeRubricScore(region, ITEMS, applied(...rubricItemIds))
    expect(outcome).toMatchObject({
      kind: "computed",
      result: { status, partialScore },
    })
  })

  it("0〜配点に収める（減点が配点を超えたら誤答、加点が配点を超えたら正答）", () => {
    const heavy = [
      adjust("minus-7", -7),
      adjust("minus-6", -6),
      adjust("plus-7", 7),
      adjust("plus-6", 6),
    ]
    expect(
      computeRubricScore(deduction, heavy, applied("minus-7", "minus-6"))
    ).toMatchObject({ result: { status: "incorrect", partialScore: null } })
    expect(
      computeRubricScore(addition, heavy, applied("plus-7", "plus-6"))
    ).toMatchObject({ result: { status: "correct", partialScore: null } })
  })

  it("小数の加減は 0.01 単位に丸める", () => {
    const fractional = [adjust("a", -0.1), adjust("b", -0.2)]
    expect(
      computeRubricScore(deduction, fractional, applied("a", "b"))
    ).toMatchObject({ result: { status: "partial", partialScore: 9.7 } })
  })

  it("適用が1つも無い答案は、減点方式でも満点にせず unscored", () => {
    expect(computeRubricScore(deduction, ITEMS, applied())).toMatchObject({
      kind: "computed",
      result: { status: "unscored", partialScore: null },
    })
  })

  it("set は加減より優先し、複数なら sortOrder が先のものを採って残りを返す", () => {
    const outcome = computeRubricScore(
      deduction,
      ITEMS,
      applied("unit-missing", "unreadable", "answer-only")
    )
    expect(outcome).toEqual({
      kind: "computed",
      result: { status: "partial", partialScore: 2, scaleLevelId: null },
      decidingSetItemId: "answer-only",
      shadowedSetItemIds: ["unreadable"],
    })
  })

  it("sortOrder が同じ set は作成日時、それも同じなら id の順で採る（入力の並びに依らない）", () => {
    const tied = [
      setItem("b-item", "incorrect", null, 0),
      setItem("a-item", "correct", null, 0),
    ]
    expect(
      computeRubricScore(deduction, tied, applied("b-item", "a-item"))
    ).toMatchObject({ decidingSetItemId: "a-item" })
    expect(
      computeRubricScore(
        deduction,
        [...tied].reverse(),
        applied("b-item", "a-item")
      )
    ).toMatchObject({ decidingSetItemId: "a-item" })
  })

  it("set の正答・保留は判定どおりで、点を持たない", () => {
    expect(
      computeRubricScore(deduction, ITEMS, applied("model-answer"))
    ).toMatchObject({ result: { status: "correct", partialScore: null } })
    expect(
      computeRubricScore(deduction, ITEMS, applied("unreadable"))
    ).toMatchObject({ result: { status: "pending", partialScore: null } })
  })

  it("手での上書きの行は計算しない", () => {
    expect(
      computeRubricScore(deduction, ITEMS, {
        ...applied("unit-missing"),
        overridesRubric: true,
      })
    ).toEqual({ kind: "overridden" })
  })

  it("points 方式（と外れ値）は計算しない", () => {
    expect(
      computeRubricScore(
        { scoringMethod: "points", points: 10, scaleLevelIds: [] },
        ITEMS,
        applied("unit-missing")
      )
    ).toEqual({ kind: "directScoring" })
    expect(
      computeRubricScore(
        { scoringMethod: "unknown", points: 10, scaleLevelIds: [] },
        ITEMS,
        applied("unit-missing")
      )
    ).toEqual({ kind: "directScoring" })
  })

  it("配点の無い設問では加減の点を付けず、set の判定だけを採る", () => {
    const noPoints = {
      scoringMethod: "deduction",
      points: null,
      scaleLevelIds: [],
    }
    expect(
      computeRubricScore(noPoints, ITEMS, applied("unit-missing"))
    ).toMatchObject({ result: { status: "unscored", partialScore: null } })
    expect(
      computeRubricScore(noPoints, ITEMS, applied("model-answer"))
    ).toMatchObject({ result: { status: "correct", partialScore: null } })
  })

  it("同じ項目の重なった適用は1つとして数え、設問に無い項目の適用は数えない", () => {
    expect(
      computeRubricScore(
        deduction,
        ITEMS,
        applied("unit-missing", "unit-missing", "deleted-item")
      )
    ).toMatchObject({ result: { status: "partial", partialScore: 8 } })
  })
})

describe("computeRubricScore（類型方式の設問）", () => {
  const SCALE_ITEMS: RubricScoringItem[] = [
    setItem("to-a", "evaluated", null, 0, "level-a"),
    setItem("to-b", "evaluated", null, 1, "level-b"),
    setItem("blank", "no_answer", null, 2),
    setItem("stale-level", "evaluated", null, 3, "level-of-other-table"),
    setItem("deleted-level", "evaluated", null, 4),
    adjust("old-deduction", -2),
    setItem("old-correct", "correct", null, -1),
  ]

  it("類型にする項目にチェックを入れるとその類型になり、点は書かない", () => {
    expect(computeRubricScore(scale, SCALE_ITEMS, applied("to-b"))).toEqual({
      kind: "computed",
      result: { status: "evaluated", partialScore: null, scaleLevelId: "level-b" },
      decidingSetItemId: "to-b",
      shadowedSetItemIds: [],
    })
  })

  it("複数該当すれば並び順が先の項目を採り、残りを返す", () => {
    expect(
      computeRubricScore(scale, SCALE_ITEMS, applied("to-b", "to-a"))
    ).toMatchObject({
      result: { status: "evaluated", scaleLevelId: "level-a" },
      shadowedSetItemIds: ["to-b"],
    })
  })

  it("無答の項目は無答にする", () => {
    expect(
      computeRubricScore(scale, SCALE_ITEMS, applied("blank"))
    ).toMatchObject({
      result: { status: "no_answer", partialScore: null, scaleLevelId: null },
    })
  })

  it("ほかの類型表の類型・消えた類型を指す項目は、類型を決められないので保留", () => {
    expect(
      computeRubricScore(scale, SCALE_ITEMS, applied("stale-level"))
    ).toMatchObject({ result: { status: "pending", scaleLevelId: null } })
    expect(
      computeRubricScore(scale, SCALE_ITEMS, applied("deleted-level"))
    ).toMatchObject({ result: { status: "pending", scaleLevelId: null } })
  })

  it("方式を変える前の加減・正答の項目は効かない（該当していても未採点）", () => {
    expect(
      computeRubricScore(
        scale,
        SCALE_ITEMS,
        applied("old-deduction", "old-correct")
      )
    ).toMatchObject({
      kind: "computed",
      result: { status: "unscored", scaleLevelId: null },
      decidingSetItemId: null,
    })
    // 効かない正答の項目は、効く類型の項目より並びが先でも採らない
    expect(
      computeRubricScore(scale, SCALE_ITEMS, applied("old-correct", "to-a"))
    ).toMatchObject({
      result: { status: "evaluated", scaleLevelId: "level-a" },
      shadowedSetItemIds: [],
    })
  })

  it("減点方式の設問では類型にする項目は効かない", () => {
    expect(
      computeRubricScore(
        deduction,
        SCALE_ITEMS,
        applied("to-a", "old-deduction")
      )
    ).toMatchObject({
      result: { status: "partial", partialScore: 8, scaleLevelId: null },
      decidingSetItemId: null,
    })
  })

  it("手での上書きの行は計算しない", () => {
    expect(
      computeRubricScore(scale, SCALE_ITEMS, {
        ...applied("to-a"),
        overridesRubric: true,
      })
    ).toEqual({ kind: "overridden" })
  })
})

describe("isSameRubricScore", () => {
  const result = (
    status: "partial" | "pending" | "evaluated",
    partialScore: number | null,
    scaleLevelId: string | null = null
  ) => ({ status, partialScore, scaleLevelId })

  it("判定と、0.01 単位に丸めた点で比べる", () => {
    expect(
      isSameRubricScore(
        result("partial", 0.1 + 0.2),
        result("partial", 0.3)
      )
    ).toBe(true)
    expect(
      isSameRubricScore(result("partial", 3), result("pending", 3))
    ).toBe(false)
    expect(
      isSameRubricScore(result("pending", null), result("pending", 2))
    ).toBe(false)
  })

  it("類型は id で比べる", () => {
    expect(
      isSameRubricScore(
        result("evaluated", null, "level-a"),
        result("evaluated", null, "level-a")
      )
    ).toBe(true)
    expect(
      isSameRubricScore(
        result("evaluated", null, "level-a"),
        result("evaluated", null, "level-b")
      )
    ).toBe(false)
  })
})
