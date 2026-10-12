/**
 * 得点化の単一実装 calculateActualScore（electron-src/lib/shared/calculations/actualScore.ts）。
 *
 * - 正答は配点、誤答・無答・Wマークは 0、未採点は欠測（null）
 * - 部分点・保留は部分点そのもの（無ければ欠測）
 * - 類型評価の評価済みは類型の点数そのもの。配点を超えてよく、類型が無ければ欠測
 *   （docs/vlm-grading-design.md §4-8-8）
 */

import { describe, expect, it } from "vitest"

import { calculateActualScore } from "@/electron-src/lib/shared/calculations/actualScore"

describe("calculateActualScore", () => {
  it("正誤の判定を配点から得点にする", () => {
    expect(calculateActualScore({ status: "correct" }, 10)).toBe(10)
    expect(calculateActualScore({ status: "incorrect" }, 10)).toBe(0)
    expect(calculateActualScore({ status: "no_answer" }, 10)).toBe(0)
    expect(calculateActualScore({ status: "double_mark" }, 10)).toBe(0)
    expect(calculateActualScore({ status: "unscored" }, 10)).toBeNull()
  })

  it("部分点・保留は部分点そのもの、無ければ欠測", () => {
    expect(
      calculateActualScore({ status: "partial", partialScore: 4 }, 10)
    ).toBe(4)
    expect(
      calculateActualScore({ status: "pending", partialScore: null }, 10)
    ).toBeNull()
  })

  it("類型評価の評価済みは類型の点数で、配点を超えてよい", () => {
    expect(
      calculateActualScore({ status: "evaluated", scaleLevelScore: 6 }, 10)
    ).toBe(6)
    expect(
      calculateActualScore({ status: "evaluated", scaleLevelScore: 12 }, 10)
    ).toBe(12)
  })

  it("類型が無い（消えた・渡していない）評価済みは欠測", () => {
    expect(
      calculateActualScore({ status: "evaluated", scaleLevelScore: null }, 10)
    ).toBeNull()
    expect(calculateActualScore({ status: "evaluated" }, 10)).toBeNull()
  })
})
