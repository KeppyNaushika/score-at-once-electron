import { describe, expect, it } from "vitest"

import { DEFAULT_SETTINGS } from "@/components/answer-sheet-builder/constants"
import { computeLayoutFromDefinition } from "@/components/answer-sheet-builder/hooks/layout/computeLayout"
import {
  transformLayoutToVertical,
  transposePoint,
  transposeRect,
} from "@/components/answer-sheet-builder/hooks/layout/verticalTransform"
import type { AnswerSheetDefinition } from "@/types/answerSheetDefinition.types"
import type {
  ComputedCell,
  ComputedLayout,
} from "@/types/answerSheetLayout.types"

// A4縦: 実寸 W=210, H=297（縦組みでも物理用紙は不変）
const W = 210
const H = 297

describe("transposePoint", () => {
  it("論理原点(0,0)は実座標の右上(W,0)へ", () => {
    expect(transposePoint(0, 0, W)).toEqual({ x: W, y: 0 })
  })

  it("x'=W-y, y'=x", () => {
    expect(transposePoint(30, 50, W)).toEqual({ x: W - 50, y: 30 })
  })
})

describe("transposeRect", () => {
  it("矩形は幅高さが入れ替わり、原点は右→左へミラー", () => {
    expect(transposeRect(10, 20, 30, 40, W)).toEqual({
      x: W - (20 + 40),
      y: 10,
      w: 40,
      h: 30,
    })
  })

  it("面積は保存される", () => {
    const r = transposeRect(5, 7, 11, 13, W)
    expect(r.w * r.h).toBe(11 * 13)
  })

  it("論理ページ右下端の矩形が実座標内に収まる", () => {
    // 論理ページは幅高さ入れ替え (LW=H, LH=W)。論理の右下隅 (LW, LH)=(297,210)
    const r = transposeRect(H - 10, W - 10, 10, 10, W)
    expect(r.x).toBeGreaterThanOrEqual(0)
    expect(r.y).toBeGreaterThanOrEqual(0)
    expect(r.x + r.w).toBeLessThanOrEqual(W + 1e-9)
    expect(r.y + r.h).toBeLessThanOrEqual(H + 1e-9)
  })
})

function makeCell(overrides: Partial<ComputedCell> = {}): ComputedCell {
  return {
    questionPath: [0, 0],
    x: 10,
    y: 20,
    width: 30,
    height: 40,
    normalizedX: 10 / H, // 論理座標は LW=H で正規化されている
    normalizedY: 20 / W,
    normalizedW: 30 / H,
    normalizedH: 40 / W,
    label: "1-(1)",
    points: 5,
    textElements: [],
    cellType: "answer",
    pageIndex: 0,
    ...overrides,
  }
}

function makeLayout(cells: ComputedCell[]): ComputedLayout {
  return {
    pageWidthMm: H, // 論理ページ幅 = 実高さ
    pageHeightMm: W,
    cells,
    lines: [],
    numberLabels: [],
    omrMarkerPositions: [],
    headerFields: [],
    overflow: false,
    contentHeightMm: 100,
  }
}

describe("transformLayoutToVertical", () => {
  it("ページ寸法は実寸 (W,H) に設定される", () => {
    const out = transformLayoutToVertical(makeLayout([makeCell()]), W, H)
    expect(out.pageWidthMm).toBe(W)
    expect(out.pageHeightMm).toBe(H)
  })

  it("セルの normalized は変換後の実座標で再計算され [0,1] に収まる", () => {
    const out = transformLayoutToVertical(makeLayout([makeCell()]), W, H)
    const c = out.cells[0]
    expect(c.normalizedX).toBeCloseTo(c.x / W)
    expect(c.normalizedY).toBeCloseTo(c.y / H)
    expect(c.normalizedW).toBeCloseTo(c.width / W)
    expect(c.normalizedH).toBeCloseTo(c.height / H)
    for (const v of [
      c.normalizedX,
      c.normalizedY,
      c.normalizedW,
      c.normalizedH,
    ]) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it("原稿用紙グリッドは columns↔rows が入れ替わり vertical=true になる", () => {
    const cell = makeCell({
      manuscriptGrid: {
        columns: 20,
        rows: 5,
        cellSizeMm: 8,
        gridX: 10,
        gridY: 20,
        gridWidth: 160,
        gridHeight: 40,
        vertical: false,
        charDividerStyle: "dashed",
        charDividerWidth: 0.2,
        lineDividerStyle: "solid",
        lineDividerWidth: 0.2,
        charGuides: [{ atChar: 80, label: "80" }],
        guideFontSize: 2.2,
        guidePosition: "bottom-left",
      },
    })
    const out = transformLayoutToVertical(makeLayout([cell]), W, H)
    const g = out.cells[0].manuscriptGrid!
    expect(g.columns).toBe(5)
    expect(g.rows).toBe(20)
    expect(g.vertical).toBe(true)
    expect(g.cellSizeMm).toBe(8)
    // 矩形の幅高さも入れ替わる
    expect(g.gridWidth).toBe(40)
    expect(g.gridHeight).toBe(160)
    // 罫線スタイル・ガイドは方向セマンティック/atChar基準のため転置不変で素通り
    expect(g.charDividerStyle).toBe("dashed")
    expect(g.lineDividerStyle).toBe("solid")
    expect(g.charGuides).toEqual([{ atChar: 80, label: "80" }])
    expect(g.guidePosition).toBe("bottom-left")
  })

  it("OMRマーカーは矩形変換で四隅アンカーが保たれ用紙内に収まる", () => {
    // 論理ページ右下隅のマーカー（LW=H, LH=W）。size=5, offset=3
    const size = 5
    const offset = 3
    const layout = makeLayout([])
    layout.omrMarkerPositions = [
      // 論理: 左上 / 右上 / 左下 / 右下
      { x: offset, y: offset, size },
      { x: H - offset - size, y: offset, size },
      { x: offset, y: W - offset - size, size },
      { x: H - offset - size, y: W - offset - size, size },
    ]
    const out = transformLayoutToVertical(layout, W, H)
    for (const m of out.omrMarkerPositions) {
      expect(m.size).toBe(size)
      expect(m.x).toBeGreaterThanOrEqual(0)
      expect(m.y).toBeGreaterThanOrEqual(0)
      expect(m.x + m.size).toBeLessThanOrEqual(W + 1e-9)
      expect(m.y + m.size).toBeLessThanOrEqual(H + 1e-9)
    }
    // 全マーカーが実用紙の四隅（offset余白）に1つずつ配置される
    const corners = out.omrMarkerPositions
      .map((m) => `${Math.round(m.x)},${Math.round(m.y)}`)
      .sort()
    expect(corners).toEqual(
      [
        `${offset},${offset}`,
        `${offset},${H - offset - size}`,
        `${W - offset - size},${offset}`,
        `${W - offset - size},${H - offset - size}`,
      ].sort()
    )
  })

  it("OMRバブルの正規化中心と幅高さが縦組み変換される", () => {
    const cell = makeCell({
      omrBubbles: [
        {
          normalizedCx: 0.25,
          normalizedCy: 0.1,
          normalizedWidth: 0.02,
          normalizedHeight: 0.032,
          choiceIndex: 0,
          label: "ア",
        },
      ],
    })
    const out = transformLayoutToVertical(makeLayout([cell]), W, H)
    const b = out.cells[0].omrBubbles![0]
    expect(b.normalizedCx).toBeCloseTo(1 - 0.1)
    expect(b.normalizedCy).toBeCloseTo(0.25)
    expect(b.normalizedWidth).toBeCloseTo(0.032)
    expect(b.normalizedHeight).toBeCloseTo(0.02)
  })
})

describe("computeLayoutFromDefinition の vertical フラグ伝播", () => {
  function makeDef(
    vertical: boolean,
    multiColumn: boolean
  ): AnswerSheetDefinition {
    return {
      id: "d1",
      name: "t",
      renderMode: "answer-sheet",
      settings: {
        ...DEFAULT_SETTINGS,
        verticalLayout: vertical,
        multiColumn: {
          ...DEFAULT_SETTINGS.multiColumn,
          enabled: multiColumn,
          columnCount: 2,
        },
      },
      majorQuestions: [
        {
          id: "m1",
          label: "一",
          subQuestions: [
            {
              id: "s1",
              label: "(1)",
              branchQuestions: [],
              heightMultiplier: 2,
              points: 5,
              textElements: [
                {
                  id: "t1",
                  text: "あいう",
                  fontSize: 6,
                  horizontalAlign: "center",
                  verticalAlign: "middle",
                },
              ],
            },
          ],
        },
      ],
    }
  }

  it("縦書き・段組みなしで layout.vertical=true", () => {
    expect(computeLayoutFromDefinition(makeDef(true, false)).vertical).toBe(
      true
    )
  })

  it("縦書き・段組みありでも layout.vertical=true（委譲経路でも伝播）", () => {
    expect(computeLayoutFromDefinition(makeDef(true, true)).vertical).toBe(true)
  })

  it("横書きでは layout.vertical は未設定（falsy）", () => {
    expect(
      computeLayoutFromDefinition(makeDef(false, false)).vertical
    ).toBeFalsy()
  })
})
