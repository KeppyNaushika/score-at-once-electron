/**
 * PDF加工: 入れ子の面（全体 N-up）の配置を、元ページ（葉）ごとの置き場所に畳むことの固定。
 *
 * 全体の面のスロットには、ファイルごとの面が1つの中身として、縦横比を保って縮んで入る。
 * 中身の寸法は、子が面ならその面の用紙の寸法。各段の格子と用紙の向きは、従来どおり
 * 「収めた中身の面積の合計が最大」で選ぶ。描く側（PDF・PNG・プレビュー）は畳んだ葉を
 * 置くだけなので、入れ子を描く処理を持たない。
 */
import { describe, expect, it } from "vitest"

import {
  layoutNestedSheet,
  type LayoutPage,
  type LayoutSheet,
} from "@/lib/pdf-tools/nestedSheetLayout"
import { computeSheetLayout } from "@/lib/pdf-tools/nUpLayout"
import type {
  NUpConfig,
  PagesPerSheet,
  RotationDegree,
  SlotOrder,
} from "@/types/pdfTools.types"

const A4 = { width: 595.28, height: 841.89 }
const PORTRAIT_PAGE = { width: 595.28, height: 841.89 }
const LANDSCAPE_PAGE = { width: 841.89, height: 595.28 }
/** A4 の短辺÷長辺（A4 を半分の A5 の枠へ縦横を入れ替えて収めるときの倍率） */
const A4_RATIO = 595.28 / 841.89

function nUpOf(
  pagesPerSheet: PagesPerSheet,
  slotOrder: SlotOrder = "from-top-left-rightward"
): NUpConfig {
  return { pagesPerSheet, slotOrder }
}

function pageOf(
  leaf: string,
  size: { width: number; height: number },
  rotation: RotationDegree = 0
): LayoutPage<string> {
  return { kind: "page", leaf, ...size, rotation }
}

function sheetOf(
  nUp: NUpConfig,
  slots: LayoutSheet<string>["slots"]
): LayoutSheet<string> {
  return { kind: "sheet", nUp, slots }
}

/** 葉 → 置き場所 */
function leafRects(sheet: LayoutSheet<string>) {
  const layout = layoutNestedSheet(sheet, A4)
  return new Map(
    layout?.leaves.map((leaf) => [leaf.leaf, leaf.placement]) ?? []
  )
}

/** 用紙の向き（"横" | "縦"）と、葉ごとに外側から各段の "行列" */
function describeLayout(sheet: LayoutSheet<string>) {
  const layout = layoutNestedSheet(sheet, A4)
  if (!layout) return null
  return {
    paper: layout.paper.width > layout.paper.height ? "横" : "縦",
    cells: Object.fromEntries(
      layout.leaves.map((leaf) => [
        leaf.leaf,
        leaf.cellPath
          .map(
            (cell) => `${cell.rows}x${cell.columns}@${cell.row}${cell.column}`
          )
          .join(" > "),
      ])
    ),
  }
}

describe("入れ子でない面は、従来の配置と同じ", () => {
  it.each([
    [2, PORTRAIT_PAGE],
    [4, LANDSCAPE_PAGE],
    [8, PORTRAIT_PAGE],
    [9, LANDSCAPE_PAGE],
  ] as const)("%i枚の面", (pagesPerSheet, size) => {
    const pages = Array.from({ length: pagesPerSheet - 1 }, (_, pageIndex) =>
      pageOf(`P${pageIndex + 1}`, size, pageIndex % 2 === 0 ? 0 : 90)
    )
    const slots = [...pages, null]
    const expected = computeSheetLayout(nUpOf(pagesPerSheet), slots, A4)
    const layout = layoutNestedSheet(sheetOf(nUpOf(pagesPerSheet), slots), A4)
    expect(layout?.paper).toEqual(expected.paper)
    expect(layout?.leaves.map((leaf) => leaf.placement)).toEqual(
      expected.placements.filter((placement) => placement !== null)
    )
    expect(layout?.leaves.map((leaf) => leaf.rotation)).toEqual(
      pages.map((page) => page.rotation)
    )
  })
})

describe("全体 2in1: A の 2in1 の面と B の1ページ（横長のページ）", () => {
  // A の面: 横長2枚を上下に重ねた縦長の面（A4 縦の 2×1）
  const fileSheet = sheetOf(nUpOf(2), [
    pageOf("A1", LANDSCAPE_PAGE),
    pageOf("A2", LANDSCAPE_PAGE),
  ])
  const globalSheetWith = (rotation: RotationDegree) =>
    sheetOf(nUpOf(2), [fileSheet, pageOf("B1", LANDSCAPE_PAGE, rotation)])

  // 用紙は横（841.89×595.28）、スロットは左右に 420.945×595.28
  const slotWidth = 841.89 / 2
  // A の面（595.28×841.89）はスロットの高さに合わせて縮む
  const fileSheetScale = A4_RATIO
  const fileSheetLeft = (slotWidth - 595.28 * fileSheetScale) / 2
  // A の面の中で、横長のページは 595.28×420.945 のスロットの幅に合わせて縮み、上下中央
  const pageHeightInFileSheet = 595.28 * A4_RATIO
  const pageTopInFileSheet = (841.89 / 2 - pageHeightInFileSheet) / 2

  it("用紙は横で、左に A の面、右に B1", () => {
    expect(describeLayout(globalSheetWith(0))).toEqual({
      paper: "横",
      cells: {
        A1: "1x2@00 > 2x1@00",
        A2: "1x2@00 > 2x1@10",
        B1: "1x2@01",
      },
    })
  })

  it("A の2枚は、A の面ごと同じ倍率で縮み、左のスロットに上下に並ぶ", () => {
    const rects = leafRects(globalSheetWith(0))
    const a1 = rects.get("A1")
    const a2 = rects.get("A2")
    expect(a1?.x).toBeCloseTo(fileSheetLeft, 6)
    expect(a1?.yTop).toBeCloseTo(pageTopInFileSheet * fileSheetScale, 6)
    expect(a1?.width).toBeCloseTo(595.28 * fileSheetScale, 6)
    expect(a1?.height).toBeCloseTo(pageHeightInFileSheet * fileSheetScale, 6)
    expect(a2?.x).toBeCloseTo(fileSheetLeft, 6)
    expect(a2?.yTop).toBeCloseTo(
      (841.89 / 2 + pageTopInFileSheet) * fileSheetScale,
      6
    )
    // 数値でも: 幅 ≒ 420.90、高さ ≒ 297.61、A2 の上端 ≒ 297.65
    expect(a1?.width).toBeCloseTo(420.9, 1)
    expect(a1?.height).toBeCloseTo(297.61, 1)
    expect(a2?.yTop).toBeCloseTo(297.65, 1)
  })

  it("B1 が 0° なら、縦長のスロットの幅に合わせて縮み、上下中央に置く", () => {
    const b1 = leafRects(globalSheetWith(0)).get("B1")
    expect(b1?.x).toBeCloseTo(slotWidth, 6)
    expect(b1?.width).toBeCloseTo(slotWidth, 6)
    expect(b1?.height).toBeCloseTo(297.64, 6)
    expect(b1?.yTop).toBeCloseTo((595.28 - 297.64) / 2, 6)
  })

  it("B1 が 90° なら、スロットいっぱいに置く（回転はそのまま葉に残る）", () => {
    const layout = layoutNestedSheet(globalSheetWith(90), A4)
    const b1 = layout?.leaves.find((leaf) => leaf.leaf === "B1")
    expect(layout?.paper.width).toBeCloseTo(841.89, 6)
    expect(b1?.rotation).toBe(90)
    expect(b1?.placement.yTop).toBeCloseTo(0, 6)
    expect(b1?.placement.height).toBeCloseTo(595.28, 6)
    expect(b1?.placement.width).toBeCloseTo(595.28 * A4_RATIO, 6)
    expect(b1?.placement.x).toBeCloseTo(
      slotWidth + (slotWidth - 595.28 * A4_RATIO) / 2,
      6
    )
  })
})

describe("全体の並べ方でスロットの順が変わる（中身の順は変わらない）", () => {
  // 全体 4in1: 先頭はファイルごとの 2in1 の面（縦長2枚 → 横長の面）、残りは縦長の単独ページ
  const slotsOf = (): LayoutSheet<string>["slots"] => [
    sheetOf(nUpOf(2), [
      pageOf("A1", PORTRAIT_PAGE),
      pageOf("A2", PORTRAIT_PAGE),
    ]),
    pageOf("B1", PORTRAIT_PAGE),
    pageOf("B2", PORTRAIT_PAGE),
    pageOf("B3", PORTRAIT_PAGE),
  ]

  it.each([
    ["from-top-left-rightward", ["00", "00", "01", "10", "11"]],
    ["from-top-left-downward", ["00", "00", "10", "01", "11"]],
    ["from-top-right-leftward", ["01", "01", "00", "11", "10"]],
    ["from-top-right-downward", ["01", "01", "11", "00", "10"]],
  ] as const)("%s", (slotOrder, outerCells) => {
    const layout = layoutNestedSheet(
      sheetOf(nUpOf(4, slotOrder), slotsOf()),
      A4
    )
    expect(layout?.leaves.map((leaf) => leaf.leaf)).toEqual([
      "A1",
      "A2",
      "B1",
      "B2",
      "B3",
    ])
    expect(
      layout?.leaves.map(
        (leaf) => `${leaf.cellPath[0].row}${leaf.cellPath[0].column}`
      )
    ).toEqual(outerCells)
  })
})

describe("ファイルごとの N が違う面を混ぜても、格子と用紙の向きは規則どおり", () => {
  it("横長の面（縦長2枚の 2in1）と横長の面（横長4枚の 4in1）は、用紙縦で上下に並ぶ", () => {
    expect(
      describeLayout(
        sheetOf(nUpOf(2), [
          sheetOf(nUpOf(2), [
            pageOf("A1", PORTRAIT_PAGE),
            pageOf("A2", PORTRAIT_PAGE),
          ]),
          sheetOf(
            nUpOf(4),
            ["B1", "B2", "B3", "B4"].map((leaf) => pageOf(leaf, LANDSCAPE_PAGE))
          ),
        ])
      )
    ).toEqual({
      paper: "縦",
      cells: {
        A1: "2x1@00 > 1x2@00",
        A2: "2x1@00 > 1x2@01",
        B1: "2x1@10 > 2x2@00",
        B2: "2x1@10 > 2x2@01",
        B3: "2x1@10 > 2x2@10",
        B4: "2x1@10 > 2x2@11",
      },
    })
  })

  it("縦長の面（横長2枚の 2in1）と縦長の面（縦長4枚の 4in1）は、用紙横で左右に並ぶ", () => {
    expect(
      describeLayout(
        sheetOf(nUpOf(2), [
          sheetOf(nUpOf(2), [
            pageOf("A1", LANDSCAPE_PAGE),
            pageOf("A2", LANDSCAPE_PAGE),
          ]),
          sheetOf(
            nUpOf(4),
            ["B1", "B2", "B3", "B4"].map((leaf) => pageOf(leaf, PORTRAIT_PAGE))
          ),
        ])
      )
    ).toMatchObject({
      paper: "横",
      cells: { A1: "1x2@00 > 2x1@00", B4: "1x2@01 > 2x2@11" },
    })
  })

  it("内側の面のページを回すと、内側の面の向きが変わり、外側の格子も変わる", () => {
    // 縦長2枚を 90° 回すと横長2枚 → 内側は縦長の面 → 縦長の面2つは用紙横で左右
    const rotatedFileSheet = sheetOf(nUpOf(2), [
      pageOf("A1", PORTRAIT_PAGE, 90),
      pageOf("A2", PORTRAIT_PAGE, 90),
    ])
    expect(
      describeLayout(
        sheetOf(nUpOf(2), [rotatedFileSheet, pageOf("B1", PORTRAIT_PAGE)])
      )
    ).toMatchObject({ paper: "横", cells: { A1: "1x2@00 > 2x1@00" } })
  })
})

describe("空きスロット", () => {
  it("全体の端数は空きスロットで、中身は自分のスロットに残る", () => {
    expect(
      describeLayout(
        sheetOf(nUpOf(4), [
          pageOf("A1", PORTRAIT_PAGE),
          pageOf("B1", PORTRAIT_PAGE),
          null,
          null,
        ])
      )?.cells
    ).toEqual({ A1: "2x2@00", B1: "2x2@01" })
  })

  it("葉が1枚も無い面は空きスロットとして扱い、全体も空なら null", () => {
    const emptyFileSheet = sheetOf(nUpOf(2), [null, null])
    expect(
      describeLayout(
        sheetOf(nUpOf(2), [emptyFileSheet, pageOf("B1", PORTRAIT_PAGE)])
      )?.cells
    ).toEqual({ B1: "1x2@01" })
    expect(
      layoutNestedSheet(sheetOf(nUpOf(2), [emptyFileSheet, null]), A4)
    ).toBeNull()
  })
})
