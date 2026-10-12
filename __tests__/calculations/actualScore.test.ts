/**
 * 得点化の単一実装 calculateActualScore（electron-src/lib/shared/calculations/actualScore.ts）。
 *
 * - 正答は配点、誤答・無答・Wマークは 0、未採点は欠測（null）
 * - 部分点・保留は部分点そのもの（無ければ欠測）
 * - 類型評価の評価済みは類型の点数そのもの。配点を超えてよく、類型が無ければ欠測
 *   （docs/vlm-grading-design.md §4-8-8）
 * - 設問の方式と合わない採点は得点にしない（欠測）。保留・無答・未採点はどの方式でも合う
 */

import { describe, expect, it } from "vitest"

import { calculateActualScore } from "@/electron-src/lib/shared/calculations/actualScore"
import type { ScoringStatus } from "@/types/scoringStatus.types"

const pointsRegion = { points: 10, scoringMethod: "points" }
const scaleRegion = { points: 10, scoringMethod: "scale" }

const verdict = (
  status: ScoringStatus,
  partialScore: number | null = null
) => ({
  status,
  partialScore,
  scaleLevel: null,
})

const evaluated = (scaleLevel: { score: number } | null) => ({
  status: "evaluated" as const,
  partialScore: null,
  scaleLevel,
})

describe("calculateActualScore", () => {
  it("正誤の判定を配点から得点にする", () => {
    expect(calculateActualScore(verdict("correct"), pointsRegion)).toBe(10)
    expect(calculateActualScore(verdict("incorrect"), pointsRegion)).toBe(0)
    expect(calculateActualScore(verdict("no_answer"), pointsRegion)).toBe(0)
    expect(calculateActualScore(verdict("double_mark"), pointsRegion)).toBe(0)
    expect(calculateActualScore(verdict("unscored"), pointsRegion)).toBeNull()
  })

  it("配点が無い設問の正答は 0", () => {
    expect(
      calculateActualScore(verdict("correct"), {
        points: null,
        scoringMethod: "points",
      })
    ).toBe(0)
  })

  it("部分点・保留は部分点そのもの、無ければ欠測", () => {
    expect(calculateActualScore(verdict("partial", 4), pointsRegion)).toBe(4)
    expect(calculateActualScore(verdict("pending"), pointsRegion)).toBeNull()
  })

  it("類型評価の評価済みは類型の点数で、配点を超えてよい", () => {
    expect(calculateActualScore(evaluated({ score: 6 }), scaleRegion)).toBe(6)
    expect(calculateActualScore(evaluated({ score: 12 }), scaleRegion)).toBe(12)
  })

  it("類型が無い（消えた）評価済みは欠測", () => {
    expect(calculateActualScore(evaluated(null), scaleRegion)).toBeNull()
  })

  it("類型評価の設問の正答・誤答・部分点は得点にしない", () => {
    expect(calculateActualScore(verdict("correct"), scaleRegion)).toBeNull()
    expect(calculateActualScore(verdict("incorrect"), scaleRegion)).toBeNull()
    expect(calculateActualScore(verdict("partial", 4), scaleRegion)).toBeNull()
  })

  it("点の採点の設問の評価済みは得点にしない（減点・加点方式でも）", () => {
    expect(
      calculateActualScore(evaluated({ score: 6 }), pointsRegion)
    ).toBeNull()
    expect(
      calculateActualScore(evaluated({ score: 6 }), {
        points: 10,
        scoringMethod: "deduction",
      })
    ).toBeNull()
  })

  it("保留・無答はどの方式でも合う", () => {
    expect(calculateActualScore(verdict("pending", 3), scaleRegion)).toBe(3)
    expect(calculateActualScore(verdict("no_answer"), scaleRegion)).toBe(0)
  })
})
