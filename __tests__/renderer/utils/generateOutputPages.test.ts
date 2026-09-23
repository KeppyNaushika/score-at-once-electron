/**
 * PDF加工: 出力ページの生成で、2-in-1・回転がファイルの設定（左のファイル欄）から取られることの固定。
 *
 * 以前は交互挿入の欄がファイルを読み込んだ時点の 2-in-1・回転を写し取って持ち、出力はその写しを
 * 使っていたため、読み込んだ後に左の欄で変えても交互挿入に効かなかった。いまは交互挿入の欄が
 * 持つのは1回に入れるページ数だけで、2-in-1・回転は結合・交互挿入とも同じファイルの設定を使う。
 */
import { describe, expect, it } from "vitest"

import { generateOutputPages } from "@/components/pdf-tools/export-panel/generateOutputPages"
import type {
  ImportedFile,
  InterleaveConfig,
  NUpConfig,
  OutputPage,
  RotationDegree,
} from "@/types/pdfTools.types"

function buildImportedFile(
  id: string,
  pageCount: number,
  settings: { nUp?: NUpConfig; rotation?: RotationDegree } = {}
): ImportedFile {
  const pageNumbers = Array.from({ length: pageCount }, (_, i) => i + 1)
  return {
    id,
    name: `${id}.pdf`,
    path: `/tmp/${id}.pdf`,
    pageCount,
    thumbnails: pageNumbers.map(() => ""),
    selectedPages: new Set(pageNumbers),
    nUp: settings.nUp ?? { enabled: false, layout: "2x1" },
    rotation: settings.rotation ?? 0,
    sourcePdfMetadata: null,
  }
}

const interleaveConfig = (
  ...transforms: [string, number][]
): InterleaveConfig => ({
  transforms: transforms.map(([fileId, pagesPerGroup]) => ({
    fileId,
    pagesPerGroup,
  })),
})

describe("generateOutputPages", () => {
  it("交互挿入でも、ファイルの2-in-1・回転を使う", () => {
    const files = [
      buildImportedFile("a", 4, {
        nUp: { enabled: true, layout: "1x2" },
        rotation: 90,
      }),
      buildImportedFile("b", 2),
    ]

    const pages = generateOutputPages(
      files,
      "interleave",
      interleaveConfig(["a", 1], ["b", 1]),
      new Map()
    )

    expect(
      pages.map((page) => [
        page.sourceFileId,
        page.combinedPages ?? [page.sourcePageNumber],
        page.rotation,
        page.nUpLayout,
      ])
    ).toEqual([
      ["a", [1, 2], 90, "1x2"],
      ["b", [1], 0, undefined],
      ["a", [3, 4], 90, "1x2"],
      ["b", [2], 0, undefined],
    ])
  })

  it("結合と交互挿入で、同じファイルのページは同じ2-in-1・回転になる", () => {
    const files = [
      buildImportedFile("a", 3, {
        nUp: { enabled: true, layout: "2x1" },
        rotation: 180,
      }),
      buildImportedFile("b", 1, { rotation: 270 }),
    ]
    const describePage = (page: OutputPage) =>
      `${page.sourceFileId}:${page.sourcePageNumber}:${page.rotation}:${page.isNUpCombined}:${page.combinedPages?.join("+")}:${page.nUpLayout}`

    const merged = generateOutputPages(
      files,
      "merge",
      interleaveConfig(),
      new Map()
    )
    const interleaved = generateOutputPages(
      files,
      "interleave",
      interleaveConfig(["a", 1], ["b", 1]),
      new Map()
    )

    expect(interleaved.map(describePage).sort()).toEqual(
      merged.map(describePage).sort()
    )
  })

  it("交互挿入でも、プレビューで個別に回したページはその角度を優先する", () => {
    const files = [
      buildImportedFile("a", 2, { rotation: 90 }),
      buildImportedFile("b", 2),
    ]

    const pages = generateOutputPages(
      files,
      "interleave",
      interleaveConfig(["a", 1], ["b", 1]),
      new Map<string, RotationDegree>([["a:2", 180]])
    )

    expect(pages.map((page) => [outputKey(page), page.rotation])).toEqual([
      ["a:1", 90],
      ["b:1", 0],
      ["a:2", 180],
      ["b:2", 0],
    ])
  })

  it("取り除いたファイルの交互挿入設定が残っていても、1回に入れるページ数が別のファイルにずれない", () => {
    const files = [buildImportedFile("a", 2), buildImportedFile("b", 4)]

    const pages = generateOutputPages(
      files,
      "interleave",
      interleaveConfig(["removed", 3], ["a", 1], ["b", 2]),
      new Map()
    )

    expect(pages.map(outputKey)).toEqual([
      "a:1",
      "b:1",
      "b:2",
      "a:2",
      "b:3",
      "b:4",
    ])
  })
})

function outputKey(page: OutputPage): string {
  return `${page.sourceFileId}:${page.sourcePageNumber}`
}
