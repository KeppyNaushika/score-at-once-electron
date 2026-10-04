/**
 * PDF加工: 出力プレビューのバッジが示す「面の中の位置」の固定。
 *
 * バッジの番号（出力ページ-何枚目）は読む順のまま変えず、出力用紙のどこに来るかを
 * 図で添える。位置は出力と同じ計算（ページ寸法から格子を選び、並べ方でスロットを置く。
 * 全体 N-up の入れ子は葉ごとに畳む）で決めるので、並べ方を変えると塗る位置が動き、
 * 番号は動かない。
 */
import { describe, expect, it } from "vitest"

import {
  describePlacement,
  describeSheetCell,
  type PagePlacement,
  pagePlacements,
  placementLabel,
} from "@/components/pdf-tools/export-panel/pagePlacements"
import type {
  NUpSheet,
  OutputPage,
  OutputSheet,
  PagesPerSheet,
  RotationDegree,
  SlotOrder,
} from "@/types/pdfTools.types"

const PORTRAIT_THUMBNAIL = { width: 1190, height: 1684 }
const LANDSCAPE_THUMBNAIL = { width: 1684, height: 1190 }

function buildPage(
  pageNumber: number,
  rotation: RotationDegree = 0,
  fileId = "A"
) {
  return {
    kind: "page",
    id: `${fileId}:${pageNumber}`,
    sourceFileId: fileId,
    sourceFileName: `${fileId}.pdf`,
    sourcePageNumber: pageNumber,
    thumbnail: "data:image/png;base64,",
    rotation,
  } satisfies OutputPage
}

function buildSheet(
  pagesPerSheet: PagesPerSheet,
  slotOrder: SlotOrder,
  slots: (OutputSheet | null)[]
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

/** バッジの図の用紙が横向きか（図が無ければ undefined） */
function isLandscapeFigure(placement: PagePlacement | undefined) {
  const paper = placement?.paperFigure?.paper
  return paper && paper.width > paper.height
}

/** 面の各ページを "番号@行列"（マスが無ければ "番号@?"）で書く */
function describeBadges(
  sheet: NUpSheet,
  sizes: Map<string, { width: number; height: number } | null>
): string[] {
  const placementByPageId = pagePlacements([sheet], sizes)
  return sheet.slots.flatMap((slot) => {
    if (!slot || slot.kind === "sheet") return []
    const placement = placementByPageId.get(slot.id)
    const cell = placement?.cellPath?.[0]
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
    const placement = pagePlacements(
      [sheet],
      sizesOf(pages, PORTRAIT_THUMBNAIL)
    ).get("A:1")
    expect(placement?.cellPath).toEqual([
      { rows: 1, columns: 2, row: 0, column: 1 },
    ])
    expect(isLandscapeFigure(placement)).toBe(true)
  })

  it("横長2枚は用紙縦の 2×1", () => {
    const pages = [buildPage(1), buildPage(2)]
    const sheet = buildSheet(2, "from-top-left-rightward", pages)
    const placement = pagePlacements(
      [sheet],
      sizesOf(pages, LANDSCAPE_THUMBNAIL)
    ).get("A:2")
    expect(placement?.cellPath).toEqual([
      { rows: 2, columns: 1, row: 1, column: 0 },
    ])
    expect(isLandscapeFigure(placement)).toBe(false)
  })

  it("縦長のページを90°回すと横長として数える（2×1 用紙縦）", () => {
    const pages = [buildPage(1, 90), buildPage(2, 90)]
    const sheet = buildSheet(2, "from-top-left-rightward", pages)
    const placement = pagePlacements(
      [sheet],
      sizesOf(pages, PORTRAIT_THUMBNAIL)
    ).get("A:1")
    expect(placement?.cellPath?.[0]).toMatchObject({ rows: 2, columns: 1 })
    expect(isLandscapeFigure(placement)).toBe(false)
  })
})

describe("寸法がまだ分からないとき", () => {
  it("面のページが1枚でも読み込み中なら、その面はマスを出さない（番号は出す）", () => {
    const pages = [buildPage(1), buildPage(2)]
    const sheet = buildSheet(2, "from-top-left-rightward", pages)
    const sizes = new Map([["A:1", PORTRAIT_THUMBNAIL]])
    expect(describeBadges(sheet, sizes)).toEqual(["1-1@?", "1-2@?"])
  })

  it("サムネイルの無いページ・読めなかったページは、空きスロットとして格子を選び、そのページには位置を出さない（番号は出す）", () => {
    const blankPage = { ...buildPage(2), thumbnail: "" }
    const pages = [buildPage(1), blankPage, buildPage(3)]
    const sheet = buildSheet(4, "from-top-left-rightward", [...pages, null])
    const sizes = new Map([
      ["A:1", PORTRAIT_THUMBNAIL],
      ["A:3", null],
    ])
    expect(describeBadges(sheet, sizes)).toEqual(["1-1@00", "1-2@?", "1-3@?"])
  })
})

describe("全体 N-up の入れ子の面", () => {
  // 全体 2in1: 左に A の 2in1（横長2枚を上下に重ねた縦長の面）、右に B の1ページ（横長）
  const fileSheet = buildSheet(2, "from-top-left-rightward", [
    buildPage(1),
    buildPage(2),
  ])
  const pageB1 = buildPage(1, 0, "B")
  const globalSheet = buildSheet(2, "from-top-left-rightward", [
    fileSheet,
    pageB1,
  ])
  const sizes = sizesOf(
    [buildPage(1), buildPage(2), pageB1],
    LANDSCAPE_THUMBNAIL
  )
  const placementByPageId = pagePlacements(
    [buildPage(9, 0, "C"), globalSheet],
    sizes
  )

  it("番号は出力ページの中の読む順（入れ子の面も通して数える）", () => {
    expect(
      ["A:1", "A:2", "B:1"].map((pageId) => {
        const placement = placementByPageId.get(pageId)
        return placement && placementLabel(placement)
      })
    ).toEqual(["2-1", "2-2", "2-3"])
  })

  it("入る面の id を外側から段ごとに持つ（枠を段ごとにつなぐのに使う）", () => {
    expect(placementByPageId.get("A:1")?.sheetIds).toEqual(["A:1", "A:1"])
    expect(placementByPageId.get("A:2")?.sheetIds).toEqual(["A:1", "A:1"])
    expect(placementByPageId.get("B:1")?.sheetIds).toEqual(["A:1"])
    expect(placementByPageId.get("C:9")?.sheetIds).toEqual([])
  })

  it("位置は外側のマスから順に言う", () => {
    const placement = placementByPageId.get("A:2")
    expect(placement && describePlacement(placement)).toBe(
      "出力2ページ目の2番目（1×2 の左、その中の 2×1 の下）"
    )
  })

  it("図は出力用紙（横）の上の外形で、このページだけを塗る", () => {
    const figure = placementByPageId.get("A:2")?.paperFigure
    expect(isLandscapeFigure(placementByPageId.get("A:2"))).toBe(true)
    expect(figure?.targetPageId).toBe("A:2")
    expect(figure?.pageRects.map(({ pageId }) => pageId)).toEqual([
      "A:1",
      "A:2",
      "B:1",
    ])
    const rectOf = (pageId: string) =>
      figure?.pageRects.find((pageRect) => pageRect.pageId === pageId)?.rect
    // A の2枚は左半分に上下、B1 は右半分の上下中央（横長なので幅に合わせて縮む）
    expect(rectOf("A:2")?.yTop).toBeGreaterThan(rectOf("A:1")?.yTop ?? 0)
    expect(rectOf("A:1")?.x).toBeLessThan(figure ? figure.paper.width / 2 : 0)
    const b1 = rectOf("B:1")
    expect(b1?.x).toBeCloseTo(figure ? figure.paper.width / 2 : 0, 6)
    expect(b1 && figure && b1.yTop * 2 + b1.height).toBeCloseTo(
      figure?.paper.height ?? 0,
      6
    )
  })

  it("入れ子の面のページが1枚でも読み込み中なら、出力ページ全体で図を出さない", () => {
    const measuring = pagePlacements(
      [globalSheet],
      new Map([
        ["A:1", LANDSCAPE_THUMBNAIL],
        ["B:1", LANDSCAPE_THUMBNAIL],
      ])
    )
    const b1Placement = measuring.get("B:1")
    expect(b1Placement?.paperFigure).toBeUndefined()
    expect(b1Placement?.cellPath).toBeUndefined()
    expect(b1Placement && placementLabel(b1Placement)).toBe("1-3")
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
    expect(describeSheetCell(position)).toBe(label)
  })
})

describe("バッジの番号と、図を隠したときに読ませる位置の文", () => {
  it("面に入らないページは出力のページ番号だけ", () => {
    const placement = { outputPageNumber: 3, sheetIds: [] }
    expect(placementLabel(placement)).toBe("3")
    expect(describePlacement(placement)).toBe("出力3ページ目")
  })

  it("面に入るページは「ページ-何枚目」と、格子のどのマスか", () => {
    const cell = { rows: 2, columns: 2, row: 1, column: 1 }
    const placement = {
      outputPageNumber: 2,
      sheetIds: ["sheet"],
      slotNumber: 4,
      cellPath: [cell],
    }
    expect(placementLabel(placement)).toBe("2-4")
    expect(describePlacement(placement)).toBe(
      `出力2ページ目の4番目（${describeSheetCell(cell)}）`
    )
  })

  it("入れ子の面に入るページは、外側のマスから順に言う", () => {
    const placement = {
      outputPageNumber: 1,
      sheetIds: ["global", "file"],
      slotNumber: 2,
      cellPath: [
        { rows: 1, columns: 2, row: 0, column: 0 },
        { rows: 2, columns: 1, row: 1, column: 0 },
      ],
    }
    expect(placementLabel(placement)).toBe("1-2")
    expect(describePlacement(placement)).toBe(
      "出力1ページ目の2番目（1×2 の左、その中の 2×1 の下）"
    )
  })

  it("格子が決まる前（寸法の読み込み中）は位置の括弧を付けない", () => {
    const placement = {
      outputPageNumber: 2,
      sheetIds: ["sheet"],
      slotNumber: 1,
    }
    expect(describePlacement(placement)).toBe("出力2ページ目の1番目")
  })
})
