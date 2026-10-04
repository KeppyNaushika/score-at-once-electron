/**
 * PDF加工: ページの並び順を、元ファイルの**全ページ**（選択していないページも）について
 * 持つことの固定。
 *
 * 以前は見えている出力ページの順だけを覚え、選び直したページを「同じファイルの直前の
 * ページの後ろ」へ推し量って差し込み、その位置を作り直しの effect で書き戻していた。
 * いまは全ページの順を持ち、選択の有無はその順の上で出すかどうかを決めるだけなので、
 * 選択を外して戻しても位置は変わらない。出力ページは描画のたびにそこから導く。
 *
 * 並び順は常に実体の列で、出力の順を決めるのはそれだけ。出力モードや交互挿入の
 * ページ数を変えたときは、その設定の順に並び順を1回作り直し、その後はドラッグで直せる。
 */
import { describe, expect, it } from "vitest"

import {
  filePageKeys,
  movePageInOrder,
  outputPageKey,
  type PageOrder,
  rebuildPageOrder,
  withoutFilePageOrder,
} from "@/components/pdf-tools/export-panel/outputPageOrder"
import { deriveOutputPages } from "@/components/pdf-tools/export-panel/outputSheets"
import type {
  ImportedFile,
  InterleaveConfig,
  NUpConfig,
  OutputPage,
  PdfExportMode,
  RotationDegree,
} from "@/types/pdfTools.types"

function buildImportedFile(
  id: string,
  pageCount: number,
  nUp: NUpConfig = { pagesPerSheet: 1, slotOrder: "from-top-left-rightward" }
): ImportedFile {
  const pageNumbers = Array.from({ length: pageCount }, (_, i) => i + 1)
  return {
    id,
    name: `${id}.pdf`,
    path: `/tmp/${id}.pdf`,
    pageCount,
    thumbnails: pageNumbers.map(() => ""),
    selectedPages: new Set(pageNumbers),
    nUp,
    rotation: 0,
    sourcePdfMetadata: null,
  }
}

/** 画面の state に相当するもの（ExportPanel が導くのと同じ材料） */
interface ScreenState {
  files: ImportedFile[]
  mode: PdfExportMode
  interleaveConfig: InterleaveConfig
  pageRotations: Map<string, RotationDegree>
  pageOrder: PageOrder
  excludedPages: Set<string>
}

function initialScreen(files: ImportedFile[]): ScreenState {
  return files.reduce(imported, {
    files: [],
    mode: "merge",
    interleaveConfig: { transforms: [] },
    pageRotations: new Map(),
    pageOrder: [],
    excludedPages: new Set(),
  })
}

/** ファイルを取り込んだ（PdfToolsMainView と同じく、並び順の末尾に付ける） */
function imported(screen: ScreenState, file: ImportedFile): ScreenState {
  return {
    ...screen,
    files: [...screen.files, file],
    pageOrder: [...screen.pageOrder, ...filePageKeys(file)],
    interleaveConfig: {
      transforms: [
        ...screen.interleaveConfig.transforms,
        { fileId: file.id, pagesPerGroup: 1 },
      ],
    },
  }
}

/** ファイルを外した */
function removed(screen: ScreenState, fileId: string): ScreenState {
  return {
    ...screen,
    files: screen.files.filter((file) => file.id !== fileId),
    pageOrder: withoutFilePageOrder(screen.pageOrder, fileId),
    interleaveConfig: {
      transforms: screen.interleaveConfig.transforms.filter(
        (transform) => transform.fileId !== fileId
      ),
    },
  }
}

/** 出力モードを変えた（並び順をその方式の順に作り直す） */
function modeChanged(screen: ScreenState, mode: PdfExportMode): ScreenState {
  return {
    ...screen,
    mode,
    pageOrder: rebuildPageOrder(screen.files, mode, screen.interleaveConfig),
  }
}

/** 交互挿入で1回に入れるページ数を変えた（並び順をその数で作り直す） */
function pagesPerGroupChanged(
  screen: ScreenState,
  fileId: string,
  pagesPerGroup: number
): ScreenState {
  const interleaveConfig: InterleaveConfig = {
    transforms: screen.interleaveConfig.transforms.map((transform) =>
      transform.fileId === fileId ? { ...transform, pagesPerGroup } : transform
    ),
  }
  return {
    ...screen,
    interleaveConfig,
    pageOrder: rebuildPageOrder(screen.files, screen.mode, interleaveConfig),
  }
}

function keysOf(screen: ScreenState): string[] {
  return deriveOutputPages(screen).map(outputPageKey)
}

function pageOf(screen: ScreenState, pageKey: string): OutputPage {
  const page = deriveOutputPages(screen).find(
    (candidatePage) => outputPageKey(candidatePage) === pageKey
  )
  if (!page) throw new Error(`${pageKey} が出力に無い`)
  return page
}

function withSelectedPages(
  screen: ScreenState,
  fileId: string,
  selectedPages: number[]
): ScreenState {
  return {
    ...screen,
    files: screen.files.map((file) =>
      file.id === fileId
        ? { ...file, selectedPages: new Set(selectedPages) }
        : file
    ),
  }
}

function dragged(
  screen: ScreenState,
  movedKey: string,
  targetKey: string,
  placement: "before" | "after"
): ScreenState {
  return {
    ...screen,
    pageOrder: movePageInOrder(
      screen.pageOrder,
      outputPageKey(pageOf(screen, movedKey)),
      outputPageKey(pageOf(screen, targetKey)),
      placement
    ),
  }
}

describe("ページの並び順（全ページ）", () => {
  it("選択を外して戻しても、ほかのページの選択を変えても、位置が変わらない", () => {
    let screen = initialScreen([buildImportedFile("A", 5)])

    screen = withSelectedPages(screen, "A", [1, 2, 4, 5])
    expect(keysOf(screen)).toEqual(["A:1", "A:2", "A:4", "A:5"])

    screen = dragged(screen, "A:4", "A:2", "before")
    expect(keysOf(screen)).toEqual(["A:1", "A:4", "A:2", "A:5"])

    screen = withSelectedPages(screen, "A", [1, 2, 3, 4, 5])
    expect(keysOf(screen)).toEqual(["A:1", "A:4", "A:2", "A:3", "A:5"])

    screen = withSelectedPages(screen, "A", [1, 3, 4, 5])
    expect(keysOf(screen)).toEqual(["A:1", "A:4", "A:3", "A:5"])
  })

  it("後ろへ動かしたときは、移動先のページの直後へ入る", () => {
    let screen = initialScreen([buildImportedFile("A", 4)])
    screen = dragged(screen, "A:1", "A:3", "after")
    expect(keysOf(screen)).toEqual(["A:2", "A:3", "A:1", "A:4"])
  })

  it("見えていないページは、互いの位置関係を保つ", () => {
    expect(
      movePageInOrder(["A:1", "A:2", "A:3", "A:4"], "A:4", "A:1", "before")
    ).toEqual(["A:4", "A:1", "A:2", "A:3"])
  })

  it("取り込んだファイルのページは並び順の末尾に付き、外したファイルのページは順から消える", () => {
    let screen = initialScreen([buildImportedFile("A", 3)])
    screen = dragged(screen, "A:3", "A:1", "before")
    screen = imported(screen, buildImportedFile("B", 2))
    expect(keysOf(screen)).toEqual(["A:3", "A:1", "A:2", "B:1", "B:2"])

    screen = removed(screen, "A")
    expect(screen.pageOrder).toEqual(["B:1", "B:2"])
    expect(keysOf(screen)).toEqual(["B:1", "B:2"])
  })

  it("ファイルを外しても、残ったページはドラッグで直した順を保つ", () => {
    let screen = initialScreen([
      buildImportedFile("A", 2),
      buildImportedFile("B", 2),
      buildImportedFile("C", 2),
    ])
    screen = dragged(screen, "C:1", "A:1", "before")
    screen = dragged(screen, "A:2", "B:2", "after")
    expect(keysOf(screen)).toEqual(["C:1", "A:1", "B:1", "B:2", "A:2", "C:2"])

    screen = removed(screen, "B")
    expect(keysOf(screen)).toEqual(["C:1", "A:1", "A:2", "C:2"])
  })

  it("出力モードを変えると、ドラッグで直した順をその方式の順に作り直す", () => {
    let screen = initialScreen([
      buildImportedFile("A", 3),
      buildImportedFile("B", 2),
    ])
    screen = dragged(screen, "B:2", "A:1", "before")
    expect(keysOf(screen)).toEqual(["B:2", "A:1", "A:2", "A:3", "B:1"])

    screen = modeChanged(screen, "interleave")
    expect(keysOf(screen)).toEqual(["A:1", "B:1", "A:2", "B:2", "A:3"])

    screen = modeChanged(screen, "merge")
    expect(keysOf(screen)).toEqual(["A:1", "A:2", "A:3", "B:1", "B:2"])
  })

  it("交互挿入のページ数を変えると、その数で並び順を作り直す", () => {
    let screen = modeChanged(
      initialScreen([buildImportedFile("A", 4), buildImportedFile("B", 2)]),
      "interleave"
    )
    expect(keysOf(screen)).toEqual(["A:1", "B:1", "A:2", "B:2", "A:3", "A:4"])

    screen = dragged(screen, "A:4", "A:1", "before")
    screen = pagesPerGroupChanged(screen, "A", 2)
    expect(keysOf(screen)).toEqual(["A:1", "A:2", "B:1", "A:3", "A:4", "B:2"])
  })

  it("作り直した並び順は、選択していないページにも位置を持つ", () => {
    let screen = withSelectedPages(
      initialScreen([buildImportedFile("A", 3), buildImportedFile("B", 3)]),
      "A",
      [1, 3]
    )
    screen = modeChanged(screen, "interleave")
    expect(screen.pageOrder).toEqual(["A:1", "B:1", "A:2", "B:2", "A:3", "B:3"])
    expect(keysOf(screen)).toEqual(["A:1", "B:1", "B:2", "A:3", "B:3"])

    screen = withSelectedPages(screen, "A", [1, 2, 3])
    expect(keysOf(screen)).toEqual(["A:1", "B:1", "A:2", "B:2", "A:3", "B:3"])
  })

  it("N-up は並び順に効かない（作り直しても、元ページ単位で交互に並ぶ）", () => {
    const screen = modeChanged(
      initialScreen([
        buildImportedFile("A", 4, {
          pagesPerSheet: 2,
          slotOrder: "from-top-left-rightward",
        }),
        buildImportedFile("B", 2),
      ]),
      "interleave"
    )
    expect(screen.pageOrder).toEqual(["A:1", "B:1", "A:2", "B:2", "A:3", "A:4"])
    expect(keysOf(screen)).toEqual(screen.pageOrder)
  })

  it("作り直した後も、ドラッグで自由に直せる", () => {
    let screen = modeChanged(
      initialScreen([buildImportedFile("A", 2), buildImportedFile("B", 2)]),
      "interleave"
    )
    screen = dragged(screen, "B:2", "A:1", "before")
    expect(keysOf(screen)).toEqual(["B:2", "A:1", "B:1", "A:2"])

    screen = dragged(screen, "A:1", "A:2", "after")
    expect(keysOf(screen)).toEqual(["B:2", "B:1", "A:2", "A:1"])
  })

  it("交互挿入の設定に載っていないファイルも、作り直した並び順から落ちない", () => {
    const files = [buildImportedFile("A", 2), buildImportedFile("B", 1)]
    expect(
      rebuildPageOrder(files, "interleave", {
        transforms: [{ fileId: "B", pagesPerGroup: 1 }],
      })
    ).toEqual(["B:1", "A:1", "A:2"])
  })

  it("回転と除外は並び順と独立に保たれる", () => {
    let screen = initialScreen([buildImportedFile("A", 3)])
    screen = dragged(screen, "A:3", "A:1", "before")
    screen = {
      ...screen,
      pageRotations: new Map([["A:3", 90]]),
      excludedPages: new Set(["A:2"]),
    }
    const pages = deriveOutputPages(screen)
    expect(pages.map(outputPageKey)).toEqual(["A:3", "A:1"])
    expect(pages[0].rotation).toBe(90)
  })
})
