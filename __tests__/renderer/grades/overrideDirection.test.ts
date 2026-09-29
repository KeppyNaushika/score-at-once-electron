/**
 * 成績ラベル上書きの方向判定テスト
 *
 * テスト対象:
 * - resolveGradeLabelDirection: 上方/下方/同じ/境界に無い の判定（上書きの向きと比較の記号が共用）
 *
 * ここで守りたいのは「判定が boundaries の並び順に依存しないこと」。
 * 以前は配列の添字比較だったため、算出側のソートが変わると型もテストも通ったまま
 * 矢印だけが逆を向く状態だった。
 */
import { describe, expect, it } from "vitest"

import { resolveGradeLabelDirection } from "@/components/grades/gradeLabelValues"

/** minPercentage 降順（従来 calculateGrades が返してきた並び）。order は小さいほど上位 */
const DESCENDING_BOUNDARIES = [
  { label: "A", minPercentage: 80, order: 0 },
  { label: "B", minPercentage: 60, order: 1 },
  { label: "C", minPercentage: 40, order: 2 },
]

describe("resolveGradeLabelDirection", () => {
  it("要求得点率が高いラベルへの上書きは上方修正", () => {
    expect(resolveGradeLabelDirection("B", "A", DESCENDING_BOUNDARIES)).toBe(
      "up"
    )
  })

  it("要求得点率が低いラベルへの上書きは下方修正", () => {
    expect(resolveGradeLabelDirection("B", "C", DESCENDING_BOUNDARIES)).toBe(
      "down"
    )
  })

  it("同じラベルへの上書き（固定用途）は same", () => {
    expect(resolveGradeLabelDirection("B", "B", DESCENDING_BOUNDARIES)).toBe(
      "same"
    )
  })

  it("境界に無いラベルは unknown（教員の任意入力）", () => {
    expect(resolveGradeLabelDirection("B", "秀", DESCENDING_BOUNDARIES)).toBe(
      "unknown"
    )
    expect(resolveGradeLabelDirection("不明", "A", DESCENDING_BOUNDARIES)).toBe(
      "unknown"
    )
  })

  it("boundaries の並び順が変わっても判定は変わらない", () => {
    const shuffled = [
      { label: "C", minPercentage: 40, order: 2 },
      { label: "A", minPercentage: 80, order: 0 },
      { label: "B", minPercentage: 60, order: 1 },
    ]

    expect(resolveGradeLabelDirection("B", "A", shuffled)).toBe("up")
    expect(resolveGradeLabelDirection("B", "C", shuffled)).toBe("down")
  })

  it("昇順に並んでいても上方修正は上方修正のまま", () => {
    const ascending = [...DESCENDING_BOUNDARIES].reverse()

    expect(resolveGradeLabelDirection("C", "A", ascending)).toBe("up")
    expect(resolveGradeLabelDirection("A", "C", ascending)).toBe("down")
  })

  it("境界が空なら unknown", () => {
    expect(resolveGradeLabelDirection("A", "B", [])).toBe("unknown")
  })
})

describe("resolveGradeLabelDirection - 要求得点率が同じ段階", () => {
  /** 同じ 80% に 2 段階。order が小さい A+ のほうが上位 */
  const SAME_THRESHOLD = [
    { label: "A+", minPercentage: 80, order: 0 },
    { label: "A", minPercentage: 80, order: 1 },
    { label: "B", minPercentage: 60, order: 2 },
  ]

  it("order が小さい段階への上書きは上方修正", () => {
    expect(resolveGradeLabelDirection("A", "A+", SAME_THRESHOLD)).toBe("up")
  })

  it("order が大きい段階への上書きは下方修正", () => {
    expect(resolveGradeLabelDirection("A+", "A", SAME_THRESHOLD)).toBe("down")
  })

  it("order で比べるのは要求得点率が同じときだけ", () => {
    // B(order 2) → A+(order 0) は要求得点率が上がっているので up
    expect(resolveGradeLabelDirection("B", "A+", SAME_THRESHOLD)).toBe("up")
    // A+(order 0) → B(order 2) は要求得点率が下がっているので down
    expect(resolveGradeLabelDirection("A+", "B", SAME_THRESHOLD)).toBe("down")
  })

  it("配列の並び順を変えても order の比較結果は変わらない", () => {
    const shuffled = [...SAME_THRESHOLD].reverse()

    expect(resolveGradeLabelDirection("A", "A+", shuffled)).toBe("up")
    expect(resolveGradeLabelDirection("A+", "A", shuffled)).toBe("down")
  })
})
