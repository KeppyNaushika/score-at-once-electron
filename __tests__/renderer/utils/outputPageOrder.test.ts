/**
 * PDF加工: ページの並び順を、元ファイルの**全ページ**（選択していないページも）について
 * 持つことの固定。
 *
 * 以前は見えている出力ページの順だけを覚え、選び直したページを「同じファイルの直前の
 * ページの後ろ」へ推し量って差し込み、その位置を作り直しの effect で書き戻していた。
 * いまは全ページの順を持ち、選択の有無はその順の上で出すかどうかを決めるだけなので、
 * 選択を外して戻しても位置は変わらない。出力ページは描画のたびにそこから導く。
 */
import { describe, expect, it } from "vitest"

import {
  deriveOutputPages,
  pageOrderAfterMove,
} from "@/components/pdf-tools/export-panel/generateOutputPages"
import {
  filePageKeys,
  isArrangementChanged,
  movePageInOrder,
  outputPageKey,
  type PageOrder,
  withoutFilePageOrder,
} from "@/components/pdf-tools/export-panel/outputPageOrder"
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
  nUp: NUpConfig = { enabled: false, layout: "2x1" }
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
  return {
    files,
    mode: "merge",
    interleaveConfig: { transforms: [] },
    pageRotations: new Map(),
    pageOrder: null,
    excludedPages: new Set(),
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
    pageOrder: pageOrderAfterMove(
      screen,
      pageOf(screen, movedKey),
      pageOf(screen, targetKey),
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
    const fileB = buildImportedFile("B", 2)
    screen = {
      ...screen,
      files: [...screen.files, fileB],
      pageOrder: [...(screen.pageOrder ?? []), ...filePageKeys(fileB)],
    }
    expect(keysOf(screen)).toEqual(["A:3", "A:1", "A:2", "B:1", "B:2"])

    expect(withoutFilePageOrder(screen.pageOrder, "A")).toEqual(["B:1", "B:2"])
    expect(withoutFilePageOrder(null, "A")).toBeNull()
  })

  it("出力モードや交互挿入のページ数を変えるのは、順を選び直す操作として扱う", () => {
    const interleave = (pagesPerGroup: number): InterleaveConfig => ({
      transforms: [{ fileId: "A", pagesPerGroup }],
    })
    expect(
      isArrangementChanged(
        { exportMode: "merge", interleaveConfig: interleave(1) },
        { exportMode: "interleave", interleaveConfig: interleave(1) }
      )
    ).toBe(true)
    expect(
      isArrangementChanged(
        { exportMode: "interleave", interleaveConfig: interleave(1) },
        { exportMode: "interleave", interleaveConfig: interleave(2) }
      )
    ).toBe(true)
    // ファイルが増えて設定に1件足されただけなら選び直しではない
    expect(
      isArrangementChanged(
        { exportMode: "interleave", interleaveConfig: interleave(1) },
        {
          exportMode: "interleave",
          interleaveConfig: {
            transforms: [
              { fileId: "A", pagesPerGroup: 1 },
              { fileId: "B", pagesPerGroup: 1 },
            ],
          },
        }
      )
    ).toBe(false)
  })

  it("2-in-1で結合したページは先頭ページの位置に並び、その id は作り直しても変わらない", () => {
    let screen = initialScreen([
      buildImportedFile("A", 4, { enabled: true, layout: "2x1" }),
    ])
    expect(keysOf(screen)).toEqual(["A:1", "A:3"])
    const firstIds = deriveOutputPages(screen).map((page) => page.id)
    expect(deriveOutputPages(screen).map((page) => page.id)).toEqual(firstIds)

    screen = dragged(screen, "A:3", "A:1", "before")
    expect(keysOf(screen)).toEqual(["A:3", "A:1"])
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
