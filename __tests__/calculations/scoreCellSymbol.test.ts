/**
 * 正誤一覧の設問セルの記号（getScoreCellSymbol）のテスト
 *
 * 類型評価で類型を付けた設問は、正誤の記号ではなく類型を見せ方（scaleValueDisplay）に従って出す
 * （docs/vlm-grading-design.md §4-8-8）。類型が無いときは正誤の記号に倒す。
 */
import { describe, expect, it } from "vitest"

import { getScoreCellSymbol } from "@/electron-src/lib/shared/utilities/excelUtilities"

const levelA = { id: "level-a", label: "A", score: 8 }

describe("getScoreCellSymbol", () => {
  it("類型を付けた設問は見せ方に従う（8 / A (8) / A）", () => {
    const score = {
      status: "evaluated" as const,
      score: 8,
      scoringMethod: "scale" as const,
      scaleLevel: levelA,
    }
    expect(getScoreCellSymbol(score, "points")).toBe("8")
    expect(getScoreCellSymbol(score, "label_points")).toBe("A (8)")
    expect(getScoreCellSymbol(score, "label")).toBe("A")
  })

  it("小数の点数もそのまま出す", () => {
    const score = {
      status: "evaluated" as const,
      score: 7.5,
      scoringMethod: "scale" as const,
      scaleLevel: { id: "level-b", label: "B", score: 7.5 },
    }
    expect(getScoreCellSymbol(score, "label_points")).toBe("B (7.5)")
  })

  it("類型評価の設問の保留・Wマークは正誤の記号", () => {
    expect(
      getScoreCellSymbol(
        {
          status: "pending",
          score: null,
          scoringMethod: "scale",
          scaleLevel: null,
        },
        "label_points"
      )
    ).toBe("△")
    expect(
      getScoreCellSymbol(
        {
          status: "double_mark",
          score: 0,
          scoringMethod: "scale",
          scaleLevel: null,
        },
        "label_points"
      )
    ).toBe("W")
  })

  it("点の設問は今まで通りの正誤の記号", () => {
    expect(
      getScoreCellSymbol(
        {
          status: "correct",
          score: 1,
          scoringMethod: "points",
          scaleLevel: null,
        },
        "label"
      )
    ).toBe("○")
    expect(
      getScoreCellSymbol(
        {
          status: "partial",
          score: 2,
          scoringMethod: "points",
          scaleLevel: null,
        },
        "label"
      )
    ).toBe("△2")
  })
})
