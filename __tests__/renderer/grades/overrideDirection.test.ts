/**
 * 成績ラベル上書きの方向判定テスト
 *
 * テスト対象:
 * - resolveOverrideDirection: 上方/下方/固定/任意入力 の判定
 *
 * ここで守りたいのは「判定が boundaries の並び順に依存しないこと」。
 * 以前は配列の添字比較だったため、算出側のソートが変わると型もテストも通ったまま
 * 矢印だけが逆を向く状態だった。
 */
import { describe, expect, it } from "vitest"

import { resolveOverrideDirection } from "@/components/grades/06-results/EditableGradeLabel"

/** minPercentage 降順（従来 calculateGrades が返してきた並び）。order は小さいほど上位 */
const DESCENDING_BOUNDARIES = [
  { label: "A", minPercentage: 80, order: 0 },
  { label: "B", minPercentage: 60, order: 1 },
  { label: "C", minPercentage: 40, order: 2 },
]

describe("resolveOverrideDirection", () => {
  it("要求得点率が高いラベルへの上書きは上方修正", () => {
    expect(resolveOverrideDirection("B", "A", DESCENDING_BOUNDARIES)).toBe("up")
  })

  it("要求得点率が低いラベルへの上書きは下方修正", () => {
    expect(resolveOverrideDirection("B", "C", DESCENDING_BOUNDARIES)).toBe(
      "down"
    )
  })

  it("同じラベルへの上書き（固定用途）は fixed", () => {
    expect(resolveOverrideDirection("B", "B", DESCENDING_BOUNDARIES)).toBe(
      "fixed"
    )
  })

  it("境界に無いラベルは custom（教員の任意入力）", () => {
    expect(resolveOverrideDirection("B", "秀", DESCENDING_BOUNDARIES)).toBe(
      "custom"
    )
    expect(resolveOverrideDirection("不明", "A", DESCENDING_BOUNDARIES)).toBe(
      "custom"
    )
  })

  it("boundaries の並び順が変わっても判定は変わらない", () => {
    const shuffled = [
      { label: "C", minPercentage: 40, order: 2 },
      { label: "A", minPercentage: 80, order: 0 },
      { label: "B", minPercentage: 60, order: 1 },
    ]

    expect(resolveOverrideDirection("B", "A", shuffled)).toBe("up")
    expect(resolveOverrideDirection("B", "C", shuffled)).toBe("down")
  })

  it("昇順に並んでいても上方修正は上方修正のまま", () => {
    const ascending = [...DESCENDING_BOUNDARIES].reverse()

    expect(resolveOverrideDirection("C", "A", ascending)).toBe("up")
    expect(resolveOverrideDirection("A", "C", ascending)).toBe("down")
  })

  it("境界が空なら custom", () => {
    expect(resolveOverrideDirection("A", "B", [])).toBe("custom")
  })
})

describe("resolveOverrideDirection - 要求得点率が同じ段階", () => {
  /** 同じ 80% に 2 段階。order が小さい A+ のほうが上位 */
  const SAME_THRESHOLD = [
    { label: "A+", minPercentage: 80, order: 0 },
    { label: "A", minPercentage: 80, order: 1 },
    { label: "B", minPercentage: 60, order: 2 },
  ]

  it("order が小さい段階への上書きは上方修正", () => {
    expect(resolveOverrideDirection("A", "A+", SAME_THRESHOLD)).toBe("up")
  })

  it("order が大きい段階への上書きは下方修正", () => {
    expect(resolveOverrideDirection("A+", "A", SAME_THRESHOLD)).toBe("down")
  })

  it("order で比べるのは要求得点率が同じときだけ", () => {
    // B(order 2) → A+(order 0) は要求得点率が上がっているので up
    expect(resolveOverrideDirection("B", "A+", SAME_THRESHOLD)).toBe("up")
    // A+(order 0) → B(order 2) は要求得点率が下がっているので down
    expect(resolveOverrideDirection("A+", "B", SAME_THRESHOLD)).toBe("down")
  })

  it("配列の並び順を変えても order の比較結果は変わらない", () => {
    const shuffled = [...SAME_THRESHOLD].reverse()

    expect(resolveOverrideDirection("A", "A+", shuffled)).toBe("up")
    expect(resolveOverrideDirection("A+", "A", shuffled)).toBe("down")
  })
})
