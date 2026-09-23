/**
 * PDF加工: 設定を変えて出力ページを作り直しても、ドラッグで並べ替えた順を保つことの固定。
 *
 * 出力ページは設定を変えるたびに作り直され id も変わるため、以前は並べ替えた順が
 * 作った順に戻っていた。並べ替えた順は元ページのキー（"fileId:pageNumber"）で覚え、
 * 増えたページは同じファイルの前後のページの隣へ、ファイルごと増えたら末尾へ足す。
 */
import { describe, expect, it } from "vitest"

import {
  arrangeInManualOrder,
  outputPageKey,
} from "@/components/pdf-tools/export-panel/outputPageOrder"
import type { OutputPage } from "@/types/pdfTools.types"

function buildOutputPage(
  sourceFileId: string,
  sourcePageNumber: number
): OutputPage {
  return {
    id: `${sourceFileId}-${sourcePageNumber}-${Math.random()}`,
    sourceFileId,
    sourceFileName: `${sourceFileId}.pdf`,
    sourcePageNumber,
    thumbnail: "",
    rotation: 0,
    isNUpCombined: false,
  }
}

function keysOf(pages: OutputPage[]): string[] {
  return pages.map(outputPageKey)
}

describe("arrangeInManualOrder", () => {
  it("並べ替えた順に残っているページはその順で並べる（id が変わっても）", () => {
    const generatedPages = [
      buildOutputPage("A", 1),
      buildOutputPage("A", 2),
      buildOutputPage("A", 3),
    ]
    const arranged = arrangeInManualOrder(generatedPages, ["A:3", "A:1", "A:2"])
    expect(keysOf(arranged)).toEqual(["A:3", "A:1", "A:2"])
  })

  it("減ったページはそのまま消える", () => {
    const generatedPages = [buildOutputPage("A", 1), buildOutputPage("A", 3)]
    const arranged = arrangeInManualOrder(generatedPages, ["A:3", "A:2", "A:1"])
    expect(keysOf(arranged)).toEqual(["A:3", "A:1"])
  })

  it("増えたページは同じファイルの直前のページの後ろへ、増えたファイルは末尾へ", () => {
    const generatedPages = [
      buildOutputPage("A", 1),
      buildOutputPage("A", 2),
      buildOutputPage("A", 3),
      buildOutputPage("B", 1),
      buildOutputPage("B", 2),
    ]
    // A:2 の選択を戻し、B を追加した
    const arranged = arrangeInManualOrder(generatedPages, ["A:3", "A:1"])
    expect(keysOf(arranged)).toEqual(["A:3", "A:1", "A:2", "B:1", "B:2"])
  })

  it("同じファイルに直前のページが無ければ、直後のページの前に置く", () => {
    const generatedPages = [
      buildOutputPage("A", 1),
      buildOutputPage("A", 2),
      buildOutputPage("A", 3),
    ]
    const arranged = arrangeInManualOrder(generatedPages, ["A:3", "A:2"])
    expect(keysOf(arranged)).toEqual(["A:3", "A:1", "A:2"])
  })

  it("作り直したページの中身（回転など）を使う", () => {
    const rotatedPage: OutputPage = { ...buildOutputPage("A", 2), rotation: 90 }
    const generatedPages = [buildOutputPage("A", 1), rotatedPage]
    const arranged = arrangeInManualOrder(generatedPages, ["A:2", "A:1"])
    expect(arranged[0]).toBe(rotatedPage)
  })
})
