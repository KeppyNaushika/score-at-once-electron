/**
 * ルーブリック項目の適用からの点の計算（docs/vlm-grading-design.md §4-4）。
 * 方式・set の優先・範囲への収め・上書きの飛ばしを表で確かめる。
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
  sortOrder: 0,
  createdAt: CREATED_AT,
})

const setItem = (
  id: string,
  setStatus: string,
  setScore: number | null,
  sortOrder: number
): RubricScoringItem => ({
  id,
  effectKind: "set",
  pointDelta: null,
  setStatus,
  setScore,
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

const deduction = { scoringMethod: "deduction", points: 10 }
const addition = { scoringMethod: "addition", points: 10 }

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
      result: { status: "partial", partialScore: 2 },
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
        { scoringMethod: "points", points: 10 },
        ITEMS,
        applied("unit-missing")
      )
    ).toEqual({ kind: "directScoring" })
    expect(
      computeRubricScore(
        { scoringMethod: "scale", points: 10 },
        ITEMS,
        applied("unit-missing")
      )
    ).toEqual({ kind: "directScoring" })
  })

  it("配点の無い設問では加減の点を付けず、set の判定だけを採る", () => {
    const noPoints = { scoringMethod: "deduction", points: null }
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

describe("isSameRubricScore", () => {
  it("判定と、0.01 単位に丸めた点で比べる", () => {
    expect(
      isSameRubricScore(
        { status: "partial", partialScore: 0.1 + 0.2 },
        { status: "partial", partialScore: 0.3 }
      )
    ).toBe(true)
    expect(
      isSameRubricScore(
        { status: "partial", partialScore: 3 },
        { status: "pending", partialScore: 3 }
      )
    ).toBe(false)
    expect(
      isSameRubricScore(
        { status: "pending", partialScore: null },
        { status: "pending", partialScore: 2 }
      )
    ).toBe(false)
  })
})
