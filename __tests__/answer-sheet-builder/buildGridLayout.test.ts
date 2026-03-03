import { describe, expect, it } from "vitest"

import {
  buildGridLayout,
  gridTotalHeight,
  isGridHorizontal,
  parseFraction,
} from "@/components/answer-sheet-builder/hooks/useAnswerSheetLayout"

// ─── テスト用ヘルパー ───

interface TestItem {
  layoutWidth?: string
  nextPlacement?: "inline" | "break"
  goUp?: number
  heightMultiplier: number
}

/** テスト項目のファクトリ。heightMultiplier のデフォルトは 1 */
function item(opts: Partial<TestItem> = {}): TestItem {
  return { heightMultiplier: 1, ...opts }
}

/** セル座標を簡略化して比較しやすくする (浮動小数点を丸める) */
function simplify(
  cells: ReturnType<typeof buildGridLayout<TestItem>>
): { x: number; y: number; w: number; h: number }[] {
  return cells.map((c) => ({
    x: round(c.x),
    y: round(c.y),
    w: round(c.width),
    h: round(c.height),
  }))
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000
}

// ─── parseFraction テスト ───

describe("parseFraction", () => {
  it("1/2 → 0.5", () => {
    expect(parseFraction("1/2")).toBe(0.5)
  })

  it("1/3 → 0.3333...", () => {
    expect(parseFraction("1/3")).toBeCloseTo(1 / 3)
  })

  it("1/4 → 0.25", () => {
    expect(parseFraction("1/4")).toBe(0.25)
  })

  it("2/3 → 0.6666...", () => {
    expect(parseFraction("2/3")).toBeCloseTo(2 / 3)
  })

  it("3/4 → 0.75", () => {
    expect(parseFraction("3/4")).toBe(0.75)
  })

  it("1/1 → 1", () => {
    expect(parseFraction("1/1")).toBe(1)
  })

  it("小数文字列 '0.5' → 0.5", () => {
    expect(parseFraction("0.5")).toBe(0.5)
  })

  it("整数文字列 '1' → 1", () => {
    expect(parseFraction("1")).toBe(1)
  })

  it("不正な文字列 → 1 (デフォルト)", () => {
    expect(parseFraction("abc")).toBe(1)
  })
})

// ─── isGridHorizontal テスト ───

describe("isGridHorizontal", () => {
  it("layoutWidth が1つでもあれば true", () => {
    expect(isGridHorizontal([item(), item({ layoutWidth: "1/2" })])).toBe(true)
  })

  it("全て layoutWidth なしなら false", () => {
    expect(isGridHorizontal([item(), item()])).toBe(false)
  })

  it("空配列 → false", () => {
    expect(isGridHorizontal([])).toBe(false)
  })
})

// ─── buildGridLayout: 基本 ───

describe("buildGridLayout: 基本", () => {
  it("空配列 → 空結果", () => {
    expect(buildGridLayout([])).toEqual([])
  })

  it("layoutWidth なし1件 → 全幅縦配置", () => {
    const cells = buildGridLayout([item()])
    expect(simplify(cells)).toEqual([{ x: 0, y: 0, w: 1, h: 1 }])
  })

  it("layoutWidth なし3件 → 縦に積み重ね", () => {
    const cells = buildGridLayout([
      item(),
      item(),
      item({ heightMultiplier: 2 }),
    ])
    expect(simplify(cells)).toEqual([
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 0, y: 1, w: 1, h: 1 },
      { x: 0, y: 2, w: 1, h: 2 },
    ])
  })

  it("layoutWidth なし → 高さは heightMultiplier の合計", () => {
    const cells = buildGridLayout([
      item({ heightMultiplier: 2 }),
      item({ heightMultiplier: 3 }),
    ])
    expect(gridTotalHeight(cells)).toBe(5)
  })
})

// ─── buildGridLayout: 均等幅 ───

describe("buildGridLayout: 均等幅", () => {
  it("2等分: 1/2 + 1/2 → 1行", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2" }),
    ])
    expect(simplify(cells)).toEqual([
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ])
  })

  it("3等分: 1/3 × 3 → 1行", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/3" }),
      item({ layoutWidth: "1/3" }),
      item({ layoutWidth: "1/3" }),
    ])
    const s = simplify(cells)
    expect(s[0]).toEqual({ x: 0, y: 0, w: round(1 / 3), h: 1 })
    expect(s[1]).toEqual({ x: round(1 / 3), y: 0, w: round(1 / 3), h: 1 })
    expect(s[2]).toEqual({ x: round(2 / 3), y: 0, w: round(1 / 3), h: 1 })
  })

  it("4等分: 1/4 × 4 → 1行", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/4" }),
      item({ layoutWidth: "1/4" }),
      item({ layoutWidth: "1/4" }),
      item({ layoutWidth: "1/4" }),
    ])
    const s = simplify(cells)
    expect(s.every((c) => c.y === 0)).toBe(true)
    expect(s.map((c) => c.x)).toEqual([0, 0.25, 0.5, 0.75])
    expect(s.every((c) => c.w === 0.25)).toBe(true)
  })
})

// ─── buildGridLayout: 不均等幅 ───

describe("buildGridLayout: 不均等幅", () => {
  it("1/4 + 3/4 → 1行", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/4" }),
      item({ layoutWidth: "3/4" }),
    ])
    expect(simplify(cells)).toEqual([
      { x: 0, y: 0, w: 0.25, h: 1 },
      { x: 0.25, y: 0, w: 0.75, h: 1 },
    ])
  })

  it("1/3 + 2/3 → 1行", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/3" }),
      item({ layoutWidth: "2/3" }),
    ])
    const s = simplify(cells)
    expect(s[0].x).toBe(0)
    expect(s[1].x).toBeCloseTo(1 / 3, 4)
    expect(s[0].w + s[1].w).toBeCloseTo(1, 4)
  })

  it("1/4 + 1/4 + 1/2 → 1行", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/4" }),
      item({ layoutWidth: "1/4" }),
      item({ layoutWidth: "1/2" }),
    ])
    const s = simplify(cells)
    expect(s.every((c) => c.y === 0)).toBe(true)
    expect(s[0].x).toBe(0)
    expect(s[1].x).toBe(0.25)
    expect(s[2].x).toBe(0.5)
  })
})

// ─── buildGridLayout: 自動改行 ───

describe("buildGridLayout: 自動改行", () => {
  it("1/2 × 3 → 2行 (2+1)", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2" }),
    ])
    const s = simplify(cells)
    expect(s[0]).toEqual({ x: 0, y: 0, w: 0.5, h: 1 })
    expect(s[1]).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 })
    // 3つ目: 1/2 + 1/2 = 1 で自動改行後、次の行に
    expect(s[2]).toEqual({ x: 0, y: 1, w: 0.5, h: 1 })
  })

  it("1/2 × 4 → 2行 (2+2)", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2" }),
    ])
    const s = simplify(cells)
    expect(s[0].y).toBe(0)
    expect(s[1].y).toBe(0)
    expect(s[2].y).toBe(1)
    expect(s[3].y).toBe(1)
  })

  it("1/3 × 5 → 2行 (3+2)", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/3" }),
      item({ layoutWidth: "1/3" }),
      item({ layoutWidth: "1/3" }),
      item({ layoutWidth: "1/3" }),
      item({ layoutWidth: "1/3" }),
    ])
    const s = simplify(cells)
    expect(s.filter((c) => c.y === 0)).toHaveLength(3)
    expect(s.filter((c) => c.y === 1)).toHaveLength(2)
  })

  it("1/3 × 9 → 3行 (3+3+3)", () => {
    const items = Array.from({ length: 9 }, () => item({ layoutWidth: "1/3" }))
    const cells = buildGridLayout(items)
    const s = simplify(cells)
    expect(s.filter((c) => c.y === 0)).toHaveLength(3)
    expect(s.filter((c) => c.y === 1)).toHaveLength(3)
    expect(s.filter((c) => c.y === 2)).toHaveLength(3)
  })

  it("幅超過で改行: 1/2 + 1/2 + 1/3 + 2/3", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/3" }),
      item({ layoutWidth: "2/3" }),
    ])
    const s = simplify(cells)
    // 行0: 1/2 + 1/2 = 1 → 自動改行
    expect(s[0].y).toBe(0)
    expect(s[1].y).toBe(0)
    // 行1: 1/3 + 2/3 = 1
    expect(s[2].y).toBe(1)
    expect(s[3].y).toBe(1)
  })

  it("1を超えるアイテムは改行してから配置", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "3/4" }), // 1/2 + 3/4 > 1 → この項目の前で改行
    ])
    const s = simplify(cells)
    expect(s[0]).toEqual({ x: 0, y: 0, w: 0.5, h: 1 })
    expect(s[1]).toEqual({ x: 0, y: 1, w: 0.75, h: 1 })
  })
})

// ─── buildGridLayout: 明示的 break ───

describe("buildGridLayout: 明示的 break (↵)", () => {
  it("1/4 ↵ + 1/4 → 2行", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/4", nextPlacement: "break" }),
      item({ layoutWidth: "1/4" }),
    ])
    const s = simplify(cells)
    expect(s[0]).toEqual({ x: 0, y: 0, w: 0.25, h: 1 })
    expect(s[1]).toEqual({ x: 0, y: 1, w: 0.25, h: 1 })
  })

  it("L字型: 1/2 + 1/2 ↵ + 1/1", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2", nextPlacement: "break" }),
      item({ layoutWidth: "1/1" }),
    ])
    const s = simplify(cells)
    expect(s[0]).toEqual({ x: 0, y: 0, w: 0.5, h: 1 })
    expect(s[1]).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 })
    expect(s[2]).toEqual({ x: 0, y: 1, w: 1, h: 1 })
  })

  it("逆L字型: 1/1 ↵ + 1/2 + 1/2", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/1", nextPlacement: "break" }),
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2" }),
    ])
    const s = simplify(cells)
    expect(s[0]).toEqual({ x: 0, y: 0, w: 1, h: 1 })
    expect(s[1]).toEqual({ x: 0, y: 1, w: 0.5, h: 1 })
    expect(s[2]).toEqual({ x: 0.5, y: 1, w: 0.5, h: 1 })
  })

  it("T字型: 1/3 + 1/3 + 1/3 ↵ + 1/1", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/3" }),
      item({ layoutWidth: "1/3" }),
      item({ layoutWidth: "1/3", nextPlacement: "break" }),
      item({ layoutWidth: "1/1" }),
    ])
    const s = simplify(cells)
    expect(s[0].y).toBe(0)
    expect(s[1].y).toBe(0)
    expect(s[2].y).toBe(0)
    expect(s[3]).toEqual({ x: 0, y: 1, w: 1, h: 1 })
  })

  it("逆T字型: 1/1 ↵ + 1/3 + 1/3 + 1/3", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/1", nextPlacement: "break" }),
      item({ layoutWidth: "1/3" }),
      item({ layoutWidth: "1/3" }),
      item({ layoutWidth: "1/3" }),
    ])
    const s = simplify(cells)
    expect(s[0]).toEqual({ x: 0, y: 0, w: 1, h: 1 })
    expect(s[1].y).toBe(1)
    expect(s[2].y).toBe(1)
    expect(s[3].y).toBe(1)
  })

  it("連続 break: 1/4 ↵ + 1/4 ↵ + 1/4", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/4", nextPlacement: "break" }),
      item({ layoutWidth: "1/4", nextPlacement: "break" }),
      item({ layoutWidth: "1/4" }),
    ])
    const s = simplify(cells)
    expect(s[0].y).toBe(0)
    expect(s[1].y).toBe(1)
    expect(s[2].y).toBe(2)
    expect(s.every((c) => c.x === 0)).toBe(true)
  })
})

// ─── buildGridLayout: goUp (↑) ───

describe("buildGridLayout: goUp (↑)", () => {
  it("1/2 ↵ + 1/2 ↑1 → 横並び", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2", nextPlacement: "break" }),
      item({ layoutWidth: "1/2", goUp: 1 }),
    ])
    const s = simplify(cells)
    expect(s[0]).toEqual({ x: 0, y: 0, w: 0.5, h: 1 })
    expect(s[1]).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 })
  })

  it("左2段 + 右1枠: 1/4 ↵ + 1/4 + 1/2 ↑1", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/4", nextPlacement: "break" }),
      item({ layoutWidth: "1/4" }),
      item({ layoutWidth: "1/2", goUp: 1, heightMultiplier: 2 }),
    ])
    const s = simplify(cells)
    expect(s[0]).toEqual({ x: 0, y: 0, w: 0.25, h: 1 })
    expect(s[1]).toEqual({ x: 0, y: 1, w: 0.25, h: 1 })
    // ↑1 → row0に戻る、x = max(rightX of rows 0..1) = 1/4
    expect(s[2]).toEqual({ x: 0.25, y: 0, w: 0.5, h: 2 })
  })

  it("左3段 + 右大枠: 1/4 ↵ × 2 + 1/4 + 3/4 ↑2", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/4", nextPlacement: "break" }),
      item({ layoutWidth: "1/4", nextPlacement: "break" }),
      item({ layoutWidth: "1/4" }),
      item({ layoutWidth: "3/4", goUp: 2, heightMultiplier: 3 }),
    ])
    const s = simplify(cells)
    expect(s[0]).toEqual({ x: 0, y: 0, w: 0.25, h: 1 })
    expect(s[1]).toEqual({ x: 0, y: 1, w: 0.25, h: 1 })
    expect(s[2]).toEqual({ x: 0, y: 2, w: 0.25, h: 1 })
    expect(s[3]).toEqual({ x: 0.25, y: 0, w: 0.75, h: 3 })
  })

  it("goUp=0 は効果なし", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2", nextPlacement: "break" }),
      item({ layoutWidth: "1/2", goUp: 0 }),
    ])
    const s = simplify(cells)
    // goUp=0 → 移動しない → 2行目に配置
    expect(s[1]).toEqual({ x: 0, y: 1, w: 0.5, h: 1 })
  })

  it("goUp が行数を超える場合は row 0 にクランプ", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2", nextPlacement: "break" }),
      item({ layoutWidth: "1/2", goUp: 99 }),
    ])
    const s = simplify(cells)
    // goUp=99 → row 0 にクランプ
    expect(s[1]).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 })
  })
})

// ─── buildGridLayout: goUp + 後続の配置 ───

describe("buildGridLayout: goUp 後の後続配置", () => {
  it("左3段 + 右大枠 + 下に全幅", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/4", nextPlacement: "break" }),
      item({ layoutWidth: "1/4", nextPlacement: "break" }),
      item({ layoutWidth: "1/4" }),
      item({ layoutWidth: "3/4", goUp: 2, heightMultiplier: 3 }),
      item({ layoutWidth: "1/1" }),
    ])
    const s = simplify(cells)
    // ①②③ は左カラム
    expect(s[0]).toEqual({ x: 0, y: 0, w: 0.25, h: 1 })
    expect(s[1]).toEqual({ x: 0, y: 1, w: 0.25, h: 1 })
    expect(s[2]).toEqual({ x: 0, y: 2, w: 0.25, h: 1 })
    // ④ は右の大枠 (h=3)
    expect(s[3]).toEqual({ x: 0.25, y: 0, w: 0.75, h: 3 })
    // ⑤ はブロック全体の下 (y=3)、x=0 に戻る
    expect(s[4]).toEqual({ x: 0, y: 3, w: 1, h: 1 })
  })

  it("左3段 + 右大枠 + 下に2分割", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/4", nextPlacement: "break" }),
      item({ layoutWidth: "1/4", nextPlacement: "break" }),
      item({ layoutWidth: "1/4" }),
      item({ layoutWidth: "3/4", goUp: 2, heightMultiplier: 3 }),
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2" }),
    ])
    const s = simplify(cells)
    // ⑤⑥ は y=3 の行に横並び
    expect(s[4]).toEqual({ x: 0, y: 3, w: 0.5, h: 1 })
    expect(s[5]).toEqual({ x: 0.5, y: 3, w: 0.5, h: 1 })
  })

  it("左2段 + 右大枠 + 下段 + さらに下段", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2", nextPlacement: "break" }),
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2", goUp: 1, heightMultiplier: 2 }),
      item({ layoutWidth: "1/3" }),
      item({ layoutWidth: "1/3" }),
      item({ layoutWidth: "1/3" }),
    ])
    const s = simplify(cells)
    // ①② 左列
    expect(s[0]).toEqual({ x: 0, y: 0, w: 0.5, h: 1 })
    expect(s[1]).toEqual({ x: 0, y: 1, w: 0.5, h: 1 })
    // ③ 右大枠
    expect(s[2]).toEqual({ x: 0.5, y: 0, w: 0.5, h: 2 })
    // ④⑤⑥ 下に3等分 (y=2)
    expect(s[3].y).toBe(2)
    expect(s[4].y).toBe(2)
    expect(s[5].y).toBe(2)
  })
})

// ─── buildGridLayout: 高さバリエーション ───

describe("buildGridLayout: 高さ", () => {
  it("異なる高さの横並び", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2", heightMultiplier: 1 }),
      item({ layoutWidth: "1/2", heightMultiplier: 3 }),
    ])
    const s = simplify(cells)
    expect(s[0]).toEqual({ x: 0, y: 0, w: 0.5, h: 1 })
    expect(s[1]).toEqual({ x: 0.5, y: 0, w: 0.5, h: 3 })
    expect(gridTotalHeight(cells)).toBe(3)
  })

  it("高さが異なる行の自動改行後の Y 位置", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2", heightMultiplier: 2 }),
      item({ layoutWidth: "1/2", heightMultiplier: 1 }),
      item({ layoutWidth: "1/2" }),
    ])
    const s = simplify(cells)
    // 行0の maxH = 2 → 次の行は y=2
    expect(s[2]).toEqual({ x: 0, y: 2, w: 0.5, h: 1 })
  })

  it("break 後の Y 位置は行の最大高さ基準", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2", heightMultiplier: 1 }),
      item({ layoutWidth: "1/2", heightMultiplier: 3, nextPlacement: "break" }),
      item({ layoutWidth: "1/1" }),
    ])
    const s = simplify(cells)
    // 行0の maxH = 3 → 次の行は y=3
    expect(s[2]).toEqual({ x: 0, y: 3, w: 1, h: 1 })
  })

  it("goUp + 高さ混在: 全高さは最大の下端", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/4", heightMultiplier: 1, nextPlacement: "break" }),
      item({ layoutWidth: "1/4", heightMultiplier: 1 }),
      item({ layoutWidth: "3/4", goUp: 1, heightMultiplier: 2 }),
    ])
    // 全高さ: max(0+1, 1+1, 0+2) = 2
    expect(gridTotalHeight(cells)).toBe(2)
  })
})

// ─── buildGridLayout: 2×2 / グリッドパターン ───

describe("buildGridLayout: グリッドパターン", () => {
  it("2×2 グリッド (自動改行)", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2" }),
    ])
    const s = simplify(cells)
    expect(s).toEqual([
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
      { x: 0, y: 1, w: 0.5, h: 1 },
      { x: 0.5, y: 1, w: 0.5, h: 1 },
    ])
  })

  it("3×2 グリッド", () => {
    const items = Array.from({ length: 6 }, () => item({ layoutWidth: "1/3" }))
    const cells = buildGridLayout(items)
    const s = simplify(cells)
    // 行0: 3つ、行1: 3つ
    expect(s.filter((c) => c.y === 0)).toHaveLength(3)
    expect(s.filter((c) => c.y === 1)).toHaveLength(3)
  })

  it("2×2 + 全幅下段", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/1" }),
    ])
    const s = simplify(cells)
    expect(s[4]).toEqual({ x: 0, y: 2, w: 1, h: 1 })
  })

  it("全幅上段 + 2×2 + 全幅下段 (サンドイッチ)", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/1", nextPlacement: "break" }),
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/1" }),
    ])
    const s = simplify(cells)
    expect(s[0]).toEqual({ x: 0, y: 0, w: 1, h: 1 })
    expect(s[1].y).toBe(1)
    expect(s[2].y).toBe(1)
    expect(s[3].y).toBe(2)
    expect(s[4].y).toBe(2)
    expect(s[5]).toEqual({ x: 0, y: 3, w: 1, h: 1 })
  })
})

// ─── buildGridLayout: 複雑な組み合わせ ───

describe("buildGridLayout: 複雑な組み合わせ", () => {
  it("上2列 + 中央大枠 + 下3列", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/1" }),
      item({ layoutWidth: "1/3" }),
      item({ layoutWidth: "1/3" }),
      item({ layoutWidth: "1/3" }),
    ])
    const s = simplify(cells)
    // 行0: 1/2 + 1/2 (自動改行)
    expect(s[0].y).toBe(0)
    expect(s[1].y).toBe(0)
    // 行1: 1/1 (自動改行)
    expect(s[2]).toEqual({ x: 0, y: 1, w: 1, h: 1 })
    // 行2: 1/3 × 3
    expect(s[3].y).toBe(2)
    expect(s[4].y).toBe(2)
    expect(s[5].y).toBe(2)
  })

  it("凸型: 中央が広い", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/4" }),
      item({ layoutWidth: "1/4", nextPlacement: "break" }),
      item({ layoutWidth: "1/1", nextPlacement: "break" }),
      item({ layoutWidth: "1/4" }),
      item({ layoutWidth: "1/4" }),
    ])
    const s = simplify(cells)
    // 行0: 2つ (中央寄り短い)
    expect(s[0].y).toBe(0)
    expect(s[1].y).toBe(0)
    // 行1: 全幅
    expect(s[2]).toEqual({ x: 0, y: 1, w: 1, h: 1 })
    // 行2: 2つ
    expect(s[3].y).toBe(2)
    expect(s[4].y).toBe(2)
  })

  it("階段型: 段々幅が広がる", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/4", nextPlacement: "break" }),
      item({ layoutWidth: "1/2", nextPlacement: "break" }),
      item({ layoutWidth: "3/4", nextPlacement: "break" }),
      item({ layoutWidth: "1/1" }),
    ])
    const s = simplify(cells)
    expect(s[0]).toEqual({ x: 0, y: 0, w: 0.25, h: 1 })
    expect(s[1]).toEqual({ x: 0, y: 1, w: 0.5, h: 1 })
    expect(s[2]).toEqual({ x: 0, y: 2, w: 0.75, h: 1 })
    expect(s[3]).toEqual({ x: 0, y: 3, w: 1, h: 1 })
  })

  it("goUp 2回使用: 3カラム", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/3", nextPlacement: "break" }),
      item({ layoutWidth: "1/3", nextPlacement: "break" }),
      item({ layoutWidth: "1/3", nextPlacement: "break" }),
      item({ layoutWidth: "1/3", goUp: 3, heightMultiplier: 3 }),
      item({ layoutWidth: "1/3", goUp: 3, heightMultiplier: 3 }),
    ])
    const s = simplify(cells)
    // 左列
    expect(s[0]).toEqual({ x: 0, y: 0, w: round(1 / 3), h: 1 })
    expect(s[1]).toEqual({ x: 0, y: 1, w: round(1 / 3), h: 1 })
    expect(s[2]).toEqual({ x: 0, y: 2, w: round(1 / 3), h: 1 })
    // 中央列 (goUp 3 → row 0, x = 1/3)
    expect(s[3].x).toBeCloseTo(1 / 3, 4)
    expect(s[3].y).toBe(0)
    expect(s[3].h).toBe(3)
    // 右列 (goUp 3 → row 0, x = 2/3)
    expect(s[4].x).toBeCloseTo(2 / 3, 4)
    expect(s[4].y).toBe(0)
    expect(s[4].h).toBe(3)
  })

  it("goUp + break + 全幅 の繰り返し", () => {
    const cells = buildGridLayout([
      // ブロック1: 左右分割
      item({ layoutWidth: "1/2", nextPlacement: "break" }),
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2", goUp: 1, heightMultiplier: 2 }),
      // ブロック2: 全幅
      item({ layoutWidth: "1/1", nextPlacement: "break" }),
      // ブロック3: 3分割
      item({ layoutWidth: "1/3" }),
      item({ layoutWidth: "1/3" }),
      item({ layoutWidth: "1/3" }),
    ])
    const s = simplify(cells)
    // ブロック1
    expect(s[0]).toEqual({ x: 0, y: 0, w: 0.5, h: 1 })
    expect(s[1]).toEqual({ x: 0, y: 1, w: 0.5, h: 1 })
    expect(s[2]).toEqual({ x: 0.5, y: 0, w: 0.5, h: 2 })
    // ブロック2: y=2
    expect(s[3]).toEqual({ x: 0, y: 2, w: 1, h: 1 })
    // ブロック3: y=3
    expect(s[4].y).toBe(3)
    expect(s[5].y).toBe(3)
    expect(s[6].y).toBe(3)
  })
})

// ─── buildGridLayout: エッジケース ───

describe("buildGridLayout: エッジケース", () => {
  it("layoutWidth あり1件のみ → 横配置モード、1セル", () => {
    const cells = buildGridLayout([item({ layoutWidth: "1/2" })])
    const s = simplify(cells)
    expect(s).toEqual([{ x: 0, y: 0, w: 0.5, h: 1 }])
  })

  it("layoutWidth なしが混在 → 未指定は幅1扱い", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2" }),
      item(), // layoutWidth なし → "1" → 幅1
    ])
    const s = simplify(cells)
    // ①: x=0, w=0.5
    expect(s[0]).toEqual({ x: 0, y: 0, w: 0.5, h: 1 })
    // ②: layoutWidth 未指定 → 幅1 → 1/2+1 > 1 で改行
    expect(s[1]).toEqual({ x: 0, y: 1, w: 1, h: 1 })
  })

  it("heightMultiplier が 0.5 のアイテム", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2", heightMultiplier: 0.5 }),
      item({ layoutWidth: "1/2", heightMultiplier: 1.5 }),
    ])
    const s = simplify(cells)
    expect(s[0].h).toBe(0.5)
    expect(s[1].h).toBe(1.5)
    expect(gridTotalHeight(cells)).toBe(1.5)
  })

  it("break + goUp の組み合わせ: break は goUp より先に評価されない", () => {
    // ① が break → 次の行へ
    // ② が goUp=1 → 配置前に row 0 に戻る
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2", nextPlacement: "break" }),
      item({ layoutWidth: "1/2", goUp: 1 }),
    ])
    const s = simplify(cells)
    expect(s[0]).toEqual({ x: 0, y: 0, w: 0.5, h: 1 })
    // ② は goUp で row 0 に戻り、①の右に配置
    expect(s[1]).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 })
  })

  it("全アイテムに break → 全て別の行", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/3", nextPlacement: "break" }),
      item({ layoutWidth: "1/3", nextPlacement: "break" }),
      item({ layoutWidth: "1/3" }),
    ])
    const s = simplify(cells)
    expect(s[0].y).toBe(0)
    expect(s[1].y).toBe(1)
    expect(s[2].y).toBe(2)
  })

  it("goUp なし + nextPlacement なし → 全て inline", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/4" }),
      item({ layoutWidth: "1/4" }),
      item({ layoutWidth: "1/4" }),
      item({ layoutWidth: "1/4" }),
    ])
    const s = simplify(cells)
    expect(s.every((c) => c.y === 0)).toBe(true)
  })

  it("自動改行後に goUp で戻れる", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2" }), // 自動改行
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2", goUp: 1 }), // row0 に戻る... が rightX=1 なので収まらない
    ])
    const s = simplify(cells)
    // row0: ① ② → rightX=1
    // row1: ③ (x=0, w=0.5) → rightX=0.5
    // ④ goUp=1 → targetIdx=0, maxRightX = max(1, 0.5) = 1
    // curX=1 → 幅超過で改行 → 新しい行
    expect(s[3].y).toBe(2)
    expect(s[3].x).toBe(0)
  })
})

// ─── goUp + 既存行自動進行テスト ───

describe("buildGridLayout: goUp + 既存行自動進行（2カラムパターン）", () => {
  it("2列3行: 左3段 + goUp + 右3段", () => {
    // (1)(4) / (2)(5) / (3)(6)
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2", nextPlacement: "break" }),
      item({ layoutWidth: "1/2", nextPlacement: "break" }),
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2", goUp: 2 }),
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2" }),
    ])
    const s = simplify(cells)
    expect(s[0]).toEqual({ x: 0, y: 0, w: 0.5, h: 1 })
    expect(s[1]).toEqual({ x: 0, y: 1, w: 0.5, h: 1 })
    expect(s[2]).toEqual({ x: 0, y: 2, w: 0.5, h: 1 })
    expect(s[3]).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 })
    expect(s[4]).toEqual({ x: 0.5, y: 1, w: 0.5, h: 1 })
    expect(s[5]).toEqual({ x: 0.5, y: 2, w: 0.5, h: 1 })
  })

  it("2列2行: goUp 後に既存行を埋める", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2", nextPlacement: "break" }),
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2", goUp: 1 }),
      item({ layoutWidth: "1/2" }),
    ])
    const s = simplify(cells)
    expect(s[0]).toEqual({ x: 0, y: 0, w: 0.5, h: 1 })
    expect(s[1]).toEqual({ x: 0, y: 1, w: 0.5, h: 1 })
    expect(s[2]).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 })
    expect(s[3]).toEqual({ x: 0.5, y: 1, w: 0.5, h: 1 })
  })

  it("2列3行 + 下に全幅行", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2", nextPlacement: "break" }),
      item({ layoutWidth: "1/2", nextPlacement: "break" }),
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2", goUp: 2 }),
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/1" }),
    ])
    const s = simplify(cells)
    // 右列が既存3行を埋める
    expect(s[3]).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 })
    expect(s[4]).toEqual({ x: 0.5, y: 1, w: 0.5, h: 1 })
    expect(s[5]).toEqual({ x: 0.5, y: 2, w: 0.5, h: 1 })
    // 全幅行は下に配置
    expect(s[6]).toEqual({ x: 0, y: 3, w: 1, h: 1 })
  })

  it("左3段(h=1) + 右大枠(h=3, goUp): 後続は下に配置", () => {
    // goUp アイテムの高さが大きい場合、後続は goUp ブロックを抜ける
    const cells = buildGridLayout([
      item({ layoutWidth: "1/4", nextPlacement: "break" }),
      item({ layoutWidth: "1/4", nextPlacement: "break" }),
      item({ layoutWidth: "1/4" }),
      item({ layoutWidth: "3/4", goUp: 2, heightMultiplier: 3 }),
      item({ layoutWidth: "1/2" }),
    ])
    const s = simplify(cells)
    // ⑤ は goUp ブロックの下に配置 (y=3)
    expect(s[4].y).toBe(3)
    expect(s[4].x).toBe(0)
  })

  it("2列 + 右列に h=2 セル: lastCellBottom でスキップ", () => {
    // ④ が h=2 で row 0-1 をカバー → ⑤ は row 2 に進む
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2", nextPlacement: "break" }),
      item({ layoutWidth: "1/2", nextPlacement: "break" }),
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2", goUp: 2, heightMultiplier: 2 }),
      item({ layoutWidth: "1/2" }),
    ])
    const s = simplify(cells)
    // ④ at (0.5, 0) h=2 → lastCellBottom=2
    expect(s[3]).toEqual({ x: 0.5, y: 0, w: 0.5, h: 2 })
    // ⑤ は row 2 (y=2) に進む（row 1 は ④ のカバー範囲内なのでスキップ）
    expect(s[4]).toEqual({ x: 0.5, y: 2, w: 0.5, h: 1 })
  })

  it("2列 + 左列に h=2 セル: 右列は4アイテムで埋まる", () => {
    // ユーザー例: 1 5 / 2 6 / 3 7 / 3 8 / 9
    // item 3 が h=2、右列は4アイテム(h=1)でitem 3 の高さ分を埋める
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2", nextPlacement: "break" }), // ① h=1
      item({ layoutWidth: "1/2", nextPlacement: "break" }), // ② h=1
      item({ layoutWidth: "1/2", heightMultiplier: 2 }), // ③ h=2
      item({ layoutWidth: "1/2", goUp: 2 }), // ④ h=1
      item({ layoutWidth: "1/2" }), // ⑤ h=1
      item({ layoutWidth: "1/2" }), // ⑥ h=1
      item({ layoutWidth: "1/2" }), // ⑦ h=1
      item({ layoutWidth: "1/1" }), // ⑧ 全幅
    ])
    const s = simplify(cells)
    // 左列
    expect(s[0]).toEqual({ x: 0, y: 0, w: 0.5, h: 1 })
    expect(s[1]).toEqual({ x: 0, y: 1, w: 0.5, h: 1 })
    expect(s[2]).toEqual({ x: 0, y: 2, w: 0.5, h: 2 }) // h=2
    // 右列: 4アイテムが y=0,1,2,3 に配置
    expect(s[3]).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 })
    expect(s[4]).toEqual({ x: 0.5, y: 1, w: 0.5, h: 1 })
    expect(s[5]).toEqual({ x: 0.5, y: 2, w: 0.5, h: 1 })
    expect(s[6]).toEqual({ x: 0.5, y: 3, w: 0.5, h: 1 }) // ③のh=2内
    // 全幅行は下に
    expect(s[7]).toEqual({ x: 0, y: 4, w: 1, h: 1 })
  })

  it("2列 + 左列先頭が h=2: 右列は既存行を埋めてから新行", () => {
    // ① h=2, ② h=1 → 左列合計高さ3 → 右列は3アイテム配置可能
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2", heightMultiplier: 2, nextPlacement: "break" }), // ① h=2
      item({ layoutWidth: "1/2" }), // ② h=1
      item({ layoutWidth: "1/2", goUp: 1 }), // ③
      item({ layoutWidth: "1/2" }), // ④
      item({ layoutWidth: "1/2" }), // ⑤
    ])
    const s = simplify(cells)
    // 左列
    expect(s[0]).toEqual({ x: 0, y: 0, w: 0.5, h: 2 })
    expect(s[1]).toEqual({ x: 0, y: 2, w: 0.5, h: 1 })
    // 右列: ③④⑤ が y=0,1,2 で ① (h=2) の空間を埋める
    expect(s[2]).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 })
    // ④: ①のh=2内のy=1に中間行を作成して配置
    expect(s[3]).toEqual({ x: 0.5, y: 1, w: 0.5, h: 1 })
    // ⑤: 既存行 (y=2) に配置
    expect(s[4]).toEqual({ x: 0.5, y: 2, w: 0.5, h: 1 })
  })

  it("2列 + 左列中間が h=3: 右列がグリッド内で自動拡張", () => {
    // ① h=1, ② h=3, ③ h=1 → 左列合計高さ5
    // 右列は5アイテム配置可能
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2", nextPlacement: "break" }), // ① h=1
      item({ layoutWidth: "1/2", heightMultiplier: 3, nextPlacement: "break" }), // ② h=3
      item({ layoutWidth: "1/2" }), // ③ h=1
      item({ layoutWidth: "1/2", goUp: 2 }), // ④
      item({ layoutWidth: "1/2" }), // ⑤
      item({ layoutWidth: "1/2" }), // ⑥
      item({ layoutWidth: "1/2" }), // ⑦
      item({ layoutWidth: "1/2" }), // ⑧
    ])
    const s = simplify(cells)
    // 右列: y=0,1,2,3,4
    expect(s[3]).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 })
    expect(s[4]).toEqual({ x: 0.5, y: 1, w: 0.5, h: 1 })
    expect(s[5]).toEqual({ x: 0.5, y: 2, w: 0.5, h: 1 })
    expect(s[6]).toEqual({ x: 0.5, y: 3, w: 0.5, h: 1 })
    expect(s[7]).toEqual({ x: 0.5, y: 4, w: 0.5, h: 1 })
  })

  it("2列 + 右列に h=2 混在: 後続は lastCellBottom を尊重", () => {
    // 左列: ①h=1, ②h=1, ③h=1 → 3行
    // 右列: ④h=2, ⑤h=1 → ④がy=0〜2をカバー、⑤はy=2に配置
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2", nextPlacement: "break" }),
      item({ layoutWidth: "1/2", nextPlacement: "break" }),
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2", goUp: 2, heightMultiplier: 2 }),
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/1" }),
    ])
    const s = simplify(cells)
    expect(s[3]).toEqual({ x: 0.5, y: 0, w: 0.5, h: 2 })
    expect(s[4]).toEqual({ x: 0.5, y: 2, w: 0.5, h: 1 })
    expect(s[5]).toEqual({ x: 0, y: 3, w: 1, h: 1 })
  })

  it("3列パターン: 3段 + goUp × 2（中間カラムに明示break）", () => {
    // 3カラム: 左(①②③) + 中(④⑤⑥) + 右(⑦⑧⑨)
    // 3列では 1/3+1/3+1/3=1.0 で auto-break が発動しないため、
    // 中間カラムの④⑤に明示的 break が必要
    const cells = buildGridLayout([
      item({ layoutWidth: "1/3", nextPlacement: "break" }), // ①
      item({ layoutWidth: "1/3", nextPlacement: "break" }), // ②
      item({ layoutWidth: "1/3" }), // ③
      item({ layoutWidth: "1/3", goUp: 2, nextPlacement: "break" }), // ④
      item({ layoutWidth: "1/3", nextPlacement: "break" }), // ⑤
      item({ layoutWidth: "1/3" }), // ⑥
      item({ layoutWidth: "1/3", goUp: 2 }), // ⑦
      item({ layoutWidth: "1/3" }), // ⑧
      item({ layoutWidth: "1/3" }), // ⑨
    ])
    const s = simplify(cells)
    // 左列 (x=0)
    expect(s[0].x).toBe(0)
    expect(s[0].y).toBe(0)
    expect(s[1].x).toBe(0)
    expect(s[1].y).toBe(1)
    expect(s[2].x).toBe(0)
    expect(s[2].y).toBe(2)
    // 中列 (x≈1/3)
    expect(s[3].x).toBeCloseTo(1 / 3)
    expect(s[3].y).toBe(0)
    expect(s[4].x).toBeCloseTo(1 / 3)
    expect(s[4].y).toBe(1)
    expect(s[5].x).toBeCloseTo(1 / 3)
    expect(s[5].y).toBe(2)
    // 右列 (x≈2/3)
    expect(s[6].x).toBeCloseTo(2 / 3)
    expect(s[6].y).toBe(0)
    expect(s[7].x).toBeCloseTo(2 / 3)
    expect(s[7].y).toBe(1)
    expect(s[8].x).toBeCloseTo(2 / 3)
    expect(s[8].y).toBe(2)
  })
})

// ─── gridTotalHeight テスト ───

describe("gridTotalHeight", () => {
  it("空配列 → 0", () => {
    expect(gridTotalHeight([])).toBe(0)
  })

  it("1セル → y + height", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2", heightMultiplier: 3 }),
    ])
    expect(gridTotalHeight(cells)).toBe(3)
  })

  it("複数行 → 最下端", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2", heightMultiplier: 1 }),
      item({ layoutWidth: "1/2", heightMultiplier: 1 }),
      item({ layoutWidth: "1/1", heightMultiplier: 2 }),
    ])
    // 行0: y=0, 行1: y=1, h=2 → 下端 = 3
    expect(gridTotalHeight(cells)).toBe(3)
  })

  it("goUp で上に配置されたアイテムの高さも考慮", () => {
    const cells = buildGridLayout([
      item({ layoutWidth: "1/2", nextPlacement: "break" }),
      item({ layoutWidth: "1/2" }),
      item({ layoutWidth: "1/2", goUp: 1, heightMultiplier: 5 }),
    ])
    // ③ は y=0, h=5 → 下端=5
    expect(gridTotalHeight(cells)).toBe(5)
  })
})
