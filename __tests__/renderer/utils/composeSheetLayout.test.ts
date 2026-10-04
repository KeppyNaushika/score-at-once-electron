/**
 * PDF加工: PNG 出力で面を合成するキャンバスの配置の固定。
 *
 * 画像要素（HTMLImageElement）の width・height はプロトタイプのゲッターなので、
 * 寸法をオブジェクトの展開で写すと undefined になり、配置が NaN になって真っ白な
 * PNG が出た。用紙の向きも NaN の比較で常に最初の候補（横）になっていた。
 */
import { describe, expect, it } from "vitest"

import { composeSheetLayout } from "@/components/pdf-tools/export-panel/composeSheetImage"
import { toLayoutSheet } from "@/components/pdf-tools/export-panel/outputSheets"
import { layoutNestedSheet } from "@/lib/pdf-tools/nestedSheetLayout"
import type {
  NUpSheet,
  OutputPage,
  OutputSheet,
  PagesPerSheet,
} from "@/types/pdfTools.types"

const A4 = { width: 595.28, height: 841.89 }
const PORTRAIT_IMAGE = { width: 1190, height: 1684 }
const LANDSCAPE_IMAGE = { width: 1684, height: 1190 }

/** 画像要素のように、寸法をクラスのゲッターで持つもの（展開すると写らない） */
class GetterSizedImage {
  #width: number
  #height: number
  constructor(size: { width: number; height: number }) {
    this.#width = size.width
    this.#height = size.height
  }
  get width() {
    return this.#width
  }
  get height() {
    return this.#height
  }
}

function buildPage(id: string): OutputPage {
  return {
    kind: "page",
    id,
    sourceFileId: id.split(":")[0],
    sourceFileName: "A.pdf",
    sourcePageNumber: 1,
    thumbnail: "data:image/png;base64,",
    rotation: 0,
  }
}

function buildSheet(
  pagesPerSheet: PagesPerSheet,
  slots: (OutputSheet | null)[]
): NUpSheet {
  return {
    kind: "sheet",
    id: slots[0]?.id ?? "",
    nUp: { pagesPerSheet, slotOrder: "from-top-left-rightward" },
    slots,
  }
}

describe("寸法の受け渡し", () => {
  it("寸法をゲッターで持つオブジェクトを渡しても、葉の配置は有限の値になる", () => {
    const sheet = buildSheet(2, [
      buildSheet(2, [buildPage("A:1"), buildPage("A:2")]),
      buildPage("B:1"),
    ])
    const image = new GetterSizedImage(PORTRAIT_IMAGE)
    // 前提: 展開では寸法が写らない
    expect({ ...image }).toEqual({})

    const layout = layoutNestedSheet(
      toLayoutSheet(sheet, () => image),
      A4
    )
    expect(layout?.leaves).toHaveLength(3)
    layout?.leaves.forEach(({ placement }) => {
      expect(Object.values(placement).every(Number.isFinite)).toBe(true)
      expect(placement.width).toBeGreaterThan(0)
    })
  })
})

describe("キャンバスの寸法は、配置の計算が決めた用紙の向きから取る", () => {
  const sizesOf = (pages: OutputPage[], size: typeof PORTRAIT_IMAGE) =>
    new Map(pages.map((page) => [page.id, size]))

  it("縦長2枚の 2in1 は横のキャンバス", () => {
    const pages = [buildPage("A:1"), buildPage("A:2")]
    const layout = composeSheetLayout(
      buildSheet(2, pages),
      sizesOf(pages, PORTRAIT_IMAGE)
    )
    expect(layout?.canvasSize).toEqual({ width: 1684, height: 1191 })
  })

  it("横長2枚の 2in1 は縦のキャンバス", () => {
    const pages = [buildPage("A:1"), buildPage("A:2")]
    const layout = composeSheetLayout(
      buildSheet(2, pages),
      sizesOf(pages, LANDSCAPE_IMAGE)
    )
    expect(layout?.canvasSize).toEqual({ width: 1191, height: 1684 })
    layout?.leaves.forEach(({ placement }) => {
      expect(Object.values(placement).every(Number.isFinite)).toBe(true)
    })
  })

  it("全体 2in1 で横長の面2つ（縦長2枚の 2in1 ×2）は縦のキャンバス", () => {
    const pages = ["A:1", "A:2", "A:3", "A:4"].map(buildPage)
    const layout = composeSheetLayout(
      buildSheet(2, [
        buildSheet(2, pages.slice(0, 2)),
        buildSheet(2, pages.slice(2)),
      ]),
      sizesOf(pages, PORTRAIT_IMAGE)
    )
    expect(layout?.canvasSize).toEqual({ width: 1191, height: 1684 })
  })

  it("寸法の分かるページが無ければ null（合成しない）", () => {
    const pages = [buildPage("A:1")]
    expect(composeSheetLayout(buildSheet(2, pages), new Map())).toBeNull()
  })
})

describe("面積が同点になる並びでも、PDF（ポイント）と PNG（画素）で同じ格子と向きを選ぶ", () => {
  // 横長2枚の 2in1（縦長の面）と横長の B1 を全体 2in1: 用紙縦の 2×1 と用紙横の 1×2 が
  // ちょうど同じ面積になる。サムネイルは画素に丸めるので縦横比がわずかにずれる
  const pages = ["D:1", "D:2", "B:1"].map(buildPage)
  const sheet = buildSheet(2, [buildSheet(2, pages.slice(0, 2)), pages[2]])
  const POINT_SIZE = { width: 841.89, height: 595.28 }
  const PIXEL_SIZE = { width: 1683, height: 1190 }

  const describeLayout = (
    layout: ReturnType<typeof layoutNestedSheet<OutputPage>>
  ) =>
    layout && {
      isLandscape: layout.paper.width > layout.paper.height,
      cells: layout.leaves.map((leaf) =>
        leaf.cellPath
          .map(
            (cell) => `${cell.rows}x${cell.columns}@${cell.row}${cell.column}`
          )
          .join(" > ")
      ),
    }

  it("用紙横の 1×2（列の多い格子は用紙横を先に取る）で一致する", () => {
    const pdfLayout = describeLayout(
      layoutNestedSheet(
        toLayoutSheet(sheet, () => POINT_SIZE),
        A4
      )
    )
    const pngLayout = composeSheetLayout(
      sheet,
      new Map(pages.map((page) => [page.id, PIXEL_SIZE]))
    )
    expect(pdfLayout).toEqual({
      isLandscape: true,
      cells: ["1x2@00 > 2x1@00", "1x2@00 > 2x1@10", "1x2@01"],
    })
    expect(describeLayout(pngLayout)).toEqual(pdfLayout)
    expect(pngLayout?.canvasSize).toEqual({ width: 1684, height: 1191 })
  })
})
