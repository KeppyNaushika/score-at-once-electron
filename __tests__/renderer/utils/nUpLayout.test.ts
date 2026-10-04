/**
 * PDF加工: N-up の面の幾何（PDF出力とPNG出力が共有する純関数）の固定。
 *
 * 行×列と用紙の縦横は、置くページの縦横（回転後）から、ページが最も大きく収まる方に
 * 決める。各ページはスロットの中で回してから、縦横比を保って中央に収める。
 */
import { describe, expect, it } from "vitest"

import {
  chooseSheetGrid,
  computeSheetLayout,
  fitInSlot,
  normalizeRotation,
  rotatedSize,
  slotPosition,
  toPdfDrawing,
} from "@/lib/pdf-tools/nUpLayout"
import type {
  PagesPerSheet,
  RotationDegree,
  SlotOrder,
} from "@/types/pdfTools.types"

const A4 = { width: 595.28, height: 841.89 }
const PORTRAIT_PAGE = { width: 595.28, height: 841.89 }
const LANDSCAPE_PAGE = { width: 841.89, height: 595.28 }

/** 格子を "行x列 縦|横" で書く */
function describeGrid(
  pagesPerSheet: PagesPerSheet,
  page: { width: number; height: number }
): string {
  const grid = chooseSheetGrid(
    pagesPerSheet,
    Array.from({ length: pagesPerSheet }, () => page),
    A4
  )
  const orientation = grid.paper.width > grid.paper.height ? "横" : "縦"
  return `${grid.rows}x${grid.columns} ${orientation}`
}

describe("格子と用紙の向き", () => {
  it.each([
    [2, "1x2 横", "2x1 縦"],
    [4, "2x2 縦", "2x2 横"],
    [8, "2x4 横", "4x2 縦"],
    [9, "3x3 縦", "3x3 横"],
    [16, "4x4 縦", "4x4 横"],
  ] as const)(
    "%i枚: 縦長のページは %s、横長のページは %s",
    (pagesPerSheet, portraitGrid, landscapeGrid) => {
      expect(describeGrid(pagesPerSheet, PORTRAIT_PAGE)).toBe(portraitGrid)
      expect(describeGrid(pagesPerSheet, LANDSCAPE_PAGE)).toBe(landscapeGrid)
    }
  )

  it("向きは回転後の縦横で決める（縦長のページを90°回すと、横長として上下に並ぶ）", () => {
    const layout = computeSheetLayout(
      { pagesPerSheet: 2, slotOrder: "from-top-left-rightward" },
      [
        { ...PORTRAIT_PAGE, rotation: 90 },
        { ...PORTRAIT_PAGE, rotation: 90 },
      ],
      A4
    )
    expect([layout.rows, layout.columns]).toEqual([2, 1])
    expect(layout.paper.height).toBeGreaterThan(layout.paper.width)
  })

  it("正方形のページで大きさが同じなら、2枚は用紙横で左右に並べる", () => {
    expect(describeGrid(2, { width: 100, height: 100 })).toBe("1x2 横")
  })
})

describe("並べ方のスロット順", () => {
  const grid = { rows: 2, columns: 3 }
  const positionsOf = (slotOrder: SlotOrder) =>
    Array.from({ length: 6 }, (_, slotIndex) => {
      const position = slotPosition(slotIndex, grid, slotOrder)
      return `${position.row}${position.column}`
    })

  it("左上から右へ（Z）", () => {
    expect(positionsOf("from-top-left-rightward")).toEqual([
      "00",
      "01",
      "02",
      "10",
      "11",
      "12",
    ])
  })

  it("左上から下へ（N）", () => {
    expect(positionsOf("from-top-left-downward")).toEqual([
      "00",
      "10",
      "01",
      "11",
      "02",
      "12",
    ])
  })

  it("右上から左へ", () => {
    expect(positionsOf("from-top-right-leftward")).toEqual([
      "02",
      "01",
      "00",
      "12",
      "11",
      "10",
    ])
  })

  it("右上から下へ", () => {
    expect(positionsOf("from-top-right-downward")).toEqual([
      "02",
      "12",
      "01",
      "11",
      "00",
      "10",
    ])
  })
})

describe("スロット内の回転と配置", () => {
  it("90°・270°で幅と高さが入れ替わる", () => {
    expect(rotatedSize({ width: 3, height: 4 }, 90)).toEqual({
      width: 4,
      height: 3,
    })
    expect(rotatedSize({ width: 3, height: 4 }, 180)).toEqual({
      width: 3,
      height: 4,
    })
    expect(rotatedSize({ width: 3, height: 4 }, 270)).toEqual({
      width: 4,
      height: 3,
    })
  })

  it("縦長のスロットに横長のページは、幅に合わせて縮めて上下中央に置く", () => {
    expect(
      fitInSlot(
        { width: 200, height: 100 },
        { x: 10, yTop: 20, width: 100, height: 200 }
      )
    ).toEqual({ x: 10, yTop: 95, width: 100, height: 50 })
  })

  it("回さなければ縦スロットの横ページは縮み、90°回せばスロットいっぱいになる", () => {
    const nUp = {
      pagesPerSheet: 4,
      slotOrder: "from-top-left-rightward",
    } as const
    // 縦長が多いので用紙縦の2x2（各スロットは縦長）。4枚目だけ横長
    const pagesWithLastRotated = (rotation: RotationDegree) => [
      { ...PORTRAIT_PAGE, rotation: 0 as const },
      { ...PORTRAIT_PAGE, rotation: 0 as const },
      { ...PORTRAIT_PAGE, rotation: 0 as const },
      { ...LANDSCAPE_PAGE, rotation },
    ]
    const notRotated = computeSheetLayout(nUp, pagesWithLastRotated(0), A4)
    const rotated = computeSheetLayout(nUp, pagesWithLastRotated(90), A4)
    const slot = {
      x: A4.width / 2,
      yTop: A4.height / 2,
      width: A4.width / 2,
      height: A4.height / 2,
    }

    expect(notRotated.paper).toEqual(A4)
    // 幅に合わせて縮み、スロットの上下中央に来る
    const shrunk = notRotated.placements[3]
    expect(shrunk?.x).toBeCloseTo(slot.x)
    expect(shrunk?.width).toBeCloseTo(slot.width)
    expect(shrunk?.height).toBeCloseTo((slot.width * 595.28) / 841.89)
    expect(shrunk?.yTop).toBeCloseTo(
      slot.yTop + (slot.height - (shrunk?.height ?? 0)) / 2
    )

    expect(rotated.paper).toEqual(A4)
    expect(rotated.placements[3]?.x).toBeCloseTo(slot.x)
    expect(rotated.placements[3]?.yTop).toBeCloseTo(slot.yTop)
    expect(rotated.placements[3]?.width).toBeCloseTo(slot.width)
    expect(rotated.placements[3]?.height).toBeCloseTo(slot.height)
  })

  it("空きスロットは null のまま、残りのページは自分のスロットから動かない", () => {
    const layout = computeSheetLayout(
      { pagesPerSheet: 4, slotOrder: "from-top-left-rightward" },
      [{ ...PORTRAIT_PAGE, rotation: 0 }, null, null, null],
      A4
    )
    expect(layout.placements.slice(1)).toEqual([null, null, null])
    expect(layout.placements[0]).toMatchObject({ x: 0, yTop: 0 })
  })
})

describe("pdf-lib への変換", () => {
  const placement = { x: 10, yTop: 20, width: 40, height: 30 }
  const paperHeight = 100
  // 左下原点では、矩形は x: 10〜50、y: 50〜80

  it.each([
    [0, { x: 10, y: 50, width: 40, height: 30, counterClockwiseDegrees: 0 }],
    [90, { x: 10, y: 80, width: 30, height: 40, counterClockwiseDegrees: -90 }],
    [
      180,
      { x: 50, y: 80, width: 40, height: 30, counterClockwiseDegrees: -180 },
    ],
    [
      270,
      { x: 50, y: 50, width: 30, height: 40, counterClockwiseDegrees: -270 },
    ],
  ] as const)(
    "時計回り%i°: 回した後の外形が配置矩形に重なる",
    (rotation, expected) => {
      const drawing = toPdfDrawing(placement, rotation, paperHeight)
      expect(drawing).toEqual(expected)

      // 回す前の矩形の4隅を、原点まわりに回して外形を求める
      const radians = (drawing.counterClockwiseDegrees * Math.PI) / 180
      const corners = [
        [0, 0],
        [drawing.width, 0],
        [0, drawing.height],
        [drawing.width, drawing.height],
      ].map(([u, v]) => [
        drawing.x + u * Math.cos(radians) - v * Math.sin(radians),
        drawing.y + u * Math.sin(radians) + v * Math.cos(radians),
      ])
      const xs = corners.map(([x]) => x)
      const ys = corners.map(([, y]) => y)
      expect(Math.min(...xs)).toBeCloseTo(10)
      expect(Math.max(...xs)).toBeCloseTo(50)
      expect(Math.min(...ys)).toBeCloseTo(50)
      expect(Math.max(...ys)).toBeCloseTo(80)
    }
  )

  it("元PDFの /Rotate を足した角度を 0/90/180/270 へ正規化する", () => {
    expect(normalizeRotation(270 + 180)).toBe(90)
    expect(normalizeRotation(-90)).toBe(270)
    expect(normalizeRotation(360)).toBe(0)
  })
})
