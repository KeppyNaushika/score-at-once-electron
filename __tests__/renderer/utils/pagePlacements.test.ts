/**
 * PDF加工: 出力プレビューのバッジが示す「面の中の位置」の固定。
 *
 * バッジの番号（出力ページ-スロット）は読む順のまま変えず、面の格子のどのマスに入るかを
 * 図で添える。マスは出力と同じ計算（ページ寸法から格子を選び、並べ方でスロットを置く）
 * で決めるので、並べ方を変えると塗るマスが動き、番号は動かない。
 */
import { describe, expect, it } from "vitest"

import {
  describePlacement,
  describeSheetCell,
  pagePlacements,
  placementLabel,
} from "@/components/pdf-tools/export-panel/pagePlacements"
import type {
  NUpSheet,
  OutputPage,
  PagesPerSheet,
  RotationDegree,
  SlotOrder,
} from "@/types/pdfTools.types"

const PORTRAIT_THUMBNAIL = { width: 1190, height: 1684 }
const LANDSCAPE_THUMBNAIL = { width: 1684, height: 1190 }

function buildPage(pageNumber: number, rotation: RotationDegree = 0) {
  return {
    kind: "page",
    id: `A:${pageNumber}`,
    sourceFileId: "A",
    sourceFileName: "A.pdf",
    sourcePageNumber: pageNumber,
    thumbnail: "data:image/png;base64,",
    rotation,
  } satisfies OutputPage
}

function buildSheet(
  pagesPerSheet: PagesPerSheet,
  slotOrder: SlotOrder,
  slots: (OutputPage | null)[]
): NUpSheet {
  return {
    kind: "sheet",
    id: slots[0]?.id ?? "",
    nUp: { pagesPerSheet, slotOrder },
    slots,
  }
}

/** 寸法がすべて分かっている（全ページ同じ寸法） */
function sizesOf(
  pages: OutputPage[],
  size: { width: number; height: number }
): Map<string, { width: number; height: number } | null> {
  return new Map(pages.map((page) => [page.id, size]))
}

/** 面の各ページを "番号@行列"（マスが無ければ "番号@?"）で書く */
function describeBadges(
  sheet: NUpSheet,
  sizes: Map<string, { width: number; height: number } | null>
): string[] {
  const placementByPageId = pagePlacements([sheet], sizes)
  return sheet.slots.flatMap((slot) => {
    if (!slot) return []
    const placement = placementByPageId.get(slot.id)
    const cell = placement?.cell
    return [
      `${placement?.outputPageNumber}-${placement?.slotNumber}@${cell ? `${cell.row}${cell.column}` : "?"}`,
    ]
  })
}

describe("並べ方で塗るマスが変わり、番号は変わらない（縦長4枚 = 2×2 用紙縦）", () => {
  const pages = [1, 2, 3, 4].map((pageNumber) => buildPage(pageNumber))
  const sizes = sizesOf(pages, PORTRAIT_THUMBNAIL)

  it.each([
    ["from-top-left-rightward", ["1-1@00", "1-2@01", "1-3@10", "1-4@11"]],
    ["from-top-left-downward", ["1-1@00", "1-2@10", "1-3@01", "1-4@11"]],
    ["from-top-right-leftward", ["1-1@01", "1-2@00", "1-3@11", "1-4@10"]],
    ["from-top-right-downward", ["1-1@01", "1-2@11", "1-3@00", "1-4@10"]],
  ] as const)("%s", (slotOrder, badges) => {
    expect(describeBadges(buildSheet(4, slotOrder, pages), sizes)).toEqual(
      badges
    )
  })
})

describe("格子と用紙の向きは出力と同じく、ページの寸法（回転後）から選ぶ", () => {
  it("縦長2枚は用紙横の 1×2、右上から左へなら1枚目が右", () => {
    const pages = [buildPage(1), buildPage(2)]
    const sheet = buildSheet(2, "from-top-right-leftward", pages)
    const cell = pagePlacements(
      [sheet],
      sizesOf(pages, PORTRAIT_THUMBNAIL)
    ).get("A:1")?.cell
    expect(cell).toEqual({
      rows: 1,
      columns: 2,
      row: 0,
      column: 1,
      isLandscape: true,
    })
  })

  it("横長2枚は用紙縦の 2×1", () => {
    const pages = [buildPage(1), buildPage(2)]
    const sheet = buildSheet(2, "from-top-left-rightward", pages)
    const cell = pagePlacements(
      [sheet],
      sizesOf(pages, LANDSCAPE_THUMBNAIL)
    ).get("A:2")?.cell
    expect(cell).toEqual({
      rows: 2,
      columns: 1,
      row: 1,
      column: 0,
      isLandscape: false,
    })
  })

  it("縦長のページを90°回すと横長として数える（2×1 用紙縦）", () => {
    const pages = [buildPage(1, 90), buildPage(2, 90)]
    const sheet = buildSheet(2, "from-top-left-rightward", pages)
    const cell = pagePlacements(
      [sheet],
      sizesOf(pages, PORTRAIT_THUMBNAIL)
    ).get("A:1")?.cell
    expect(cell).toMatchObject({ rows: 2, columns: 1, isLandscape: false })
  })
})

describe("寸法がまだ分からないとき", () => {
  it("面のページが1枚でも読み込み中なら、その面はマスを出さない（番号は出す）", () => {
    const pages = [buildPage(1), buildPage(2)]
    const sheet = buildSheet(2, "from-top-left-rightward", pages)
    const sizes = new Map([["A:1", PORTRAIT_THUMBNAIL]])
    expect(describeBadges(sheet, sizes)).toEqual(["1-1@?", "1-2@?"])
  })

  it("サムネイルの無いページ・読めなかったページは、空きスロットとして格子を選ぶ", () => {
    const blankPage = { ...buildPage(2), thumbnail: "" }
    const pages = [buildPage(1), blankPage, buildPage(3)]
    const sheet = buildSheet(4, "from-top-left-rightward", [...pages, null])
    const sizes = new Map([
      ["A:1", PORTRAIT_THUMBNAIL],
      ["A:3", null],
    ])
    expect(describeBadges(sheet, sizes)).toEqual(["1-1@00", "1-2@01", "1-3@10"])
  })
})

describe("マスの読み上げ", () => {
  it.each([
    [{ rows: 2, columns: 2, row: 0, column: 1 }, "2×2 の右上"],
    [{ rows: 2, columns: 2, row: 1, column: 0 }, "2×2 の左下"],
    [{ rows: 1, columns: 2, row: 0, column: 0 }, "1×2 の左"],
    [{ rows: 2, columns: 1, row: 1, column: 0 }, "2×1 の下"],
    [{ rows: 3, columns: 3, row: 1, column: 1 }, "3×3 の中段の中央"],
    [{ rows: 2, columns: 4, row: 1, column: 2 }, "2×4 の下段の左から3列目"],
    [
      { rows: 4, columns: 4, row: 2, column: 3 },
      "4×4 の上から3段目の左から4列目",
    ],
  ])("%o → %s", (position, label) => {
    expect(describeSheetCell({ ...position, isLandscape: false })).toBe(label)
  })
})

describe("バッジの番号と、図を隠したときに読ませる位置の文", () => {
  it("面に入らないページは出力のページ番号だけ", () => {
    const placement = { outputPageNumber: 3 }
    expect(placementLabel(placement)).toBe("3")
    expect(describePlacement(placement)).toBe("出力3ページ目")
  })

  it("面に入るページは「ページ-スロット」と、格子のどのマスか", () => {
    const placement = {
      outputPageNumber: 2,
      sheetId: "sheet",
      slotNumber: 4,
      cell: { rows: 2, columns: 2, row: 1, column: 1, isLandscape: false },
    }
    expect(placementLabel(placement)).toBe("2-4")
    expect(describePlacement(placement)).toBe(
      `出力2ページ目の4番目（${describeSheetCell(placement.cell)}）`
    )
  })

  it("格子が決まる前（寸法の読み込み中）は位置の括弧を付けない", () => {
    const placement = { outputPageNumber: 2, sheetId: "sheet", slotNumber: 1 }
    expect(describePlacement(placement)).toBe("出力2ページ目の1番目")
  })
})
