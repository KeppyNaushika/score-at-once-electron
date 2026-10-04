/**
 * PDF加工: ファイルごとの N-up の面を、並び順の**後で**組むことの固定。
 *
 * 以前は 2-in-1 の組を並び順より前に（選択したページをページ番号順に2枚ずつ）作って
 * いたので、ドラッグで並べ替えても組み合わせは変わらず、交互挿入で 2-in-1 を切り替える
 * と、組を先頭ページの位置へ寄せたぶん交互が崩れた。いまは並び順から見えるページを
 * 取り出し、ファイルごとにそのファイルのページだけを N 枚ずつ面にする。面は先頭ページの
 * 位置に置き、除外・回転はページ単位。
 */
import { describe, expect, it } from "vitest"

import {
  filePageKeys,
  movePageInOrder,
  type PageOrder,
  rebuildPageOrder,
} from "@/components/pdf-tools/export-panel/outputPageOrder"
import {
  deriveOutputPages,
  groupIntoGlobalSheets,
  groupIntoSheets,
  sheetLeafPages,
} from "@/components/pdf-tools/export-panel/outputSheets"
import { buildPdfPageInputs } from "@/components/pdf-tools/export-panel/pdfPageInputs"
import type {
  ImportedFile,
  InterleaveConfig,
  NUpConfig,
  OutputSheet,
  PagesPerSheet,
  RotationDegree,
} from "@/types/pdfTools.types"

function nUpOf(pagesPerSheet: PagesPerSheet): NUpConfig {
  return { pagesPerSheet, slotOrder: "from-top-left-rightward" }
}

function buildImportedFile(
  id: string,
  pageCount: number,
  settings: { pagesPerSheet?: PagesPerSheet; rotation?: RotationDegree } = {}
): ImportedFile {
  const pageNumbers = Array.from({ length: pageCount }, (_, i) => i + 1)
  return {
    id,
    name: `${id}.pdf`,
    path: `/tmp/${id}.pdf`,
    pageCount,
    thumbnails: pageNumbers.map(() => ""),
    selectedPages: new Set(pageNumbers),
    nUp: nUpOf(settings.pagesPerSheet ?? 1),
    rotation: settings.rotation ?? 0,
    sourcePdfMetadata: null,
  }
}

interface SheetSettings {
  files: ImportedFile[]
  /** 全体の N-up（既定は 1in1 = まとめない） */
  globalNUp?: NUpConfig
  pageOrder?: PageOrder
  excludedPages?: Set<string>
  pageRotations?: Map<string, RotationDegree>
}

function sheetsOf(settings: SheetSettings): OutputSheet[] {
  const pages = deriveOutputPages({
    files: settings.files,
    pageOrder: settings.pageOrder ?? settings.files.flatMap(filePageKeys),
    excludedPages: settings.excludedPages ?? new Set(),
    pageRotations: settings.pageRotations ?? new Map(),
  })
  return groupIntoGlobalSheets(
    groupIntoSheets(pages, settings.files),
    settings.globalNUp ?? nUpOf(1)
  )
}

/**
 * 面を "A:1+A:2"（空きスロットは "_"）、単独ページを "B:1" と書く。
 * 入れ子の面（全体の面に入ったファイルごとの面）は "[A:1+A:2]" と括る
 */
function describeSheet(sheet: OutputSheet): string {
  return sheet.kind === "page"
    ? sheet.id
    : sheet.slots
        .map((slot) =>
          slot === null
            ? "_"
            : slot.kind === "sheet"
              ? `[${describeSheet(slot)}]`
              : slot.id
        )
        .join("+")
}

function describeSheets(sheets: OutputSheet[]): string[] {
  return sheets.map(describeSheet)
}

const interleaveConfig = (
  ...transforms: [string, number][]
): InterleaveConfig => ({
  transforms: transforms.map(([fileId, pagesPerGroup]) => ({
    fileId,
    pagesPerGroup,
  })),
})

describe("ファイルごとの N-up の面", () => {
  it("並びの順に N 枚ずつ面にし、割り切れない最後の面は空きスロットを残す", () => {
    expect(
      describeSheets(
        sheetsOf({ files: [buildImportedFile("A", 5, { pagesPerSheet: 4 })] })
      )
    ).toEqual(["A:1+A:2+A:3+A:4", "A:5+_+_+_"])
  })

  it("間に他のファイルのページがあっても飛ばして組み、面は先頭ページの位置に置く", () => {
    const files = [
      buildImportedFile("A", 4, { pagesPerSheet: 2 }),
      buildImportedFile("B", 2),
    ]
    expect(
      describeSheets(
        sheetsOf({
          files,
          pageOrder: ["A:1", "B:1", "A:2", "A:3", "B:2", "A:4"],
        })
      )
    ).toEqual(["A:1+A:2", "B:1", "A:3+A:4", "B:2"])
  })

  it("除外したページは詰めて組む（面ごとには消えない）", () => {
    const files = [buildImportedFile("A", 5, { pagesPerSheet: 2 })]
    expect(
      describeSheets(sheetsOf({ files, excludedPages: new Set(["A:2"]) }))
    ).toEqual(["A:1+A:3", "A:4+A:5"])
  })

  it("選択していないページも詰めて組む", () => {
    const files = [buildImportedFile("A", 4, { pagesPerSheet: 2 })]
    files[0].selectedPages = new Set([1, 3, 4])
    expect(describeSheets(sheetsOf({ files }))).toEqual(["A:1+A:3", "A:4+_"])
  })

  it("ドラッグで並べ替えると組み合わせが変わる", () => {
    const files = [buildImportedFile("A", 4, { pagesPerSheet: 2 })]
    const pageOrder = movePageInOrder(
      filePageKeys(files[0]),
      "A:4",
      "A:1",
      "before"
    )
    expect(describeSheets(sheetsOf({ files, pageOrder }))).toEqual([
      "A:4+A:1",
      "A:2+A:3",
    ])
  })

  it("面の id は先頭ページのキーで、組み直しても同じ並びなら変わらない", () => {
    const files = [buildImportedFile("A", 4, { pagesPerSheet: 2 })]
    const first = sheetsOf({ files }).map((sheet) => sheet.id)
    const second = sheetsOf({
      files,
      pageRotations: new Map<string, RotationDegree>([["A:2", 90]]),
    }).map((sheet) => sheet.id)
    expect(first).toEqual(["A:1", "A:3"])
    expect(second).toEqual(first)
  })

  it("回転はページごとに持ち、個別に回した角度がファイルの既定より優先する", () => {
    const files = [
      buildImportedFile("A", 2, { pagesPerSheet: 2, rotation: 90 }),
    ]
    const [sheet] = sheetsOf({
      files,
      pageRotations: new Map<string, RotationDegree>([["A:2", 180]]),
    })
    expect(sheet.kind).toBe("sheet")
    if (sheet.kind !== "sheet") return
    expect(
      sheet.slots.map((slot) => (slot?.kind === "page" ? slot.rotation : null))
    ).toEqual([90, 180])
  })

  it("1in1 のファイルのページは面にせず、そのまま1ページとして出す", () => {
    const files = [
      buildImportedFile("A", 2),
      buildImportedFile("B", 2, { pagesPerSheet: 2 }),
    ]
    const sheets = sheetsOf({ files })
    expect(sheets.map((sheet) => sheet.kind)).toEqual(["page", "page", "sheet"])
  })
})

describe("交互挿入との組み合わせ", () => {
  const files = [
    buildImportedFile("A", 4, { pagesPerSheet: 2 }),
    buildImportedFile("B", 2),
  ]

  it("N-up を切り替えても並び順は作り直さず、元ページの交互の並びが保たれる", () => {
    const pageOrder = rebuildPageOrder(
      files.map((file) => ({ ...file, nUp: nUpOf(1) })),
      "interleave",
      interleaveConfig(["A", 1], ["B", 1])
    )
    // N-up にしてから作り直しても、同じ並び順になる（N は並び順に効かない）
    expect(
      rebuildPageOrder(
        files,
        "interleave",
        interleaveConfig(["A", 1], ["B", 1])
      )
    ).toEqual(pageOrder)

    // N=1 なら元ページ単位で交互、N=2 にしてもページの並びは同じで、A の面は A を飛ばして組む
    expect(
      describeSheets(
        sheetsOf({
          files: files.map((file) => ({ ...file, nUp: nUpOf(1) })),
          pageOrder,
        })
      )
    ).toEqual(["A:1", "B:1", "A:2", "B:2", "A:3", "A:4"])
    expect(describeSheets(sheetsOf({ files, pageOrder }))).toEqual([
      "A:1+A:2",
      "B:1",
      "B:2",
      "A:3+A:4",
    ])
  })

  it("1回に入れるページ数を N に合わせると、面と他のファイルのページが交互になる", () => {
    const pageOrder = rebuildPageOrder(
      files,
      "interleave",
      interleaveConfig(["A", 2], ["B", 1])
    )
    expect(describeSheets(sheetsOf({ files, pageOrder }))).toEqual([
      "A:1+A:2",
      "B:1",
      "A:3+A:4",
      "B:2",
    ])
  })
})

describe("全体の N-up", () => {
  const files = [
    buildImportedFile("A", 4, { pagesPerSheet: 2 }),
    buildImportedFile("B", 2),
  ]
  const pageOrder = rebuildPageOrder(
    files,
    "interleave",
    interleaveConfig(["A", 2], ["B", 1])
  )

  it("全体 1in1 なら、ファイルごとの面に組んだ結果をそのまま出す", () => {
    const fileSheets = groupIntoSheets(
      deriveOutputPages({
        files,
        pageOrder,
        excludedPages: new Set(),
        pageRotations: new Map(),
      }),
      files
    )
    expect(groupIntoGlobalSheets(fileSheets, nUpOf(1))).toBe(fileSheets)
    expect(describeSheets(sheetsOf({ files, pageOrder }))).toEqual([
      "A:1+A:2",
      "B:1",
      "A:3+A:4",
      "B:2",
    ])
  })

  it("交互挿入した A の面と B のページをまたいで、隣り合う N 個ずつ1面にまとめる", () => {
    const sheets = sheetsOf({ files, pageOrder, globalNUp: nUpOf(2) })
    expect(describeSheets(sheets)).toEqual(["[A:1+A:2]+B:1", "[A:3+A:4]+B:2"])
    // 全体の面の id は先頭の元ページのキー
    expect(sheets.map((sheet) => sheet.id)).toEqual(["A:1", "A:3"])
  })

  it("ファイルごとの N が 1 なら、ページどうしをファイルをまたいでまとめる", () => {
    const singlePageFiles = files.map((file) => ({ ...file, nUp: nUpOf(1) }))
    const interleavedOrder = rebuildPageOrder(
      singlePageFiles,
      "interleave",
      interleaveConfig(["A", 1], ["B", 1])
    )
    expect(
      describeSheets(
        sheetsOf({
          files: singlePageFiles,
          pageOrder: interleavedOrder,
          globalNUp: nUpOf(2),
        })
      )
    ).toEqual(["A:1+B:1", "A:2+B:2", "A:3+A:4"])
  })

  it("全体の端数は空きスロットにする", () => {
    expect(
      describeSheets(sheetsOf({ files, pageOrder, globalNUp: nUpOf(4) }))
    ).toEqual(["[A:1+A:2]+B:1+[A:3+A:4]+B:2"])
    expect(
      describeSheets(
        sheetsOf({
          files,
          pageOrder,
          globalNUp: nUpOf(4),
          excludedPages: new Set(["B:2"]),
        })
      )
    ).toEqual(["[A:1+A:2]+B:1+[A:3+A:4]+_"])
  })

  it("除外はページ単位で詰め、ファイルごとの面を組み直してから全体をまとめる", () => {
    expect(
      describeSheets(
        sheetsOf({
          files,
          pageOrder,
          globalNUp: nUpOf(2),
          excludedPages: new Set(["A:2"]),
        })
      )
    ).toEqual(["[A:1+A:3]+B:1", "[A:4+_]+B:2"])
  })

  it("全体の面の元ページは、入れ子の面もスロットの順にたどって読む順に並ぶ", () => {
    const [sheet] = sheetsOf({ files, pageOrder, globalNUp: nUpOf(4) })
    expect(sheetLeafPages(sheet).map((page) => page.id)).toEqual([
      "A:1",
      "A:2",
      "B:1",
      "A:3",
      "A:4",
      "B:2",
    ])
  })
})

describe("main プロセスへ渡すページ入力", () => {
  it("面はスロットの並び（空きスロットの null も）のまま、ページごとの回転を付けて渡す", () => {
    const files = [
      buildImportedFile("A", 3, { pagesPerSheet: 2 }),
      buildImportedFile("B", 1, { rotation: 270 }),
    ]
    const inputs = buildPdfPageInputs(
      sheetsOf({
        files,
        pageRotations: new Map<string, RotationDegree>([["A:2", 90]]),
      }),
      files
    )
    expect(inputs).toEqual([
      {
        kind: "sheet",
        nUp: nUpOf(2),
        slots: [
          { kind: "page", filePath: "/tmp/A.pdf", pageNumber: 1, rotation: 0 },
          { kind: "page", filePath: "/tmp/A.pdf", pageNumber: 2, rotation: 90 },
        ],
      },
      {
        kind: "sheet",
        nUp: nUpOf(2),
        slots: [
          { kind: "page", filePath: "/tmp/A.pdf", pageNumber: 3, rotation: 0 },
          null,
        ],
      },
      { kind: "page", filePath: "/tmp/B.pdf", pageNumber: 1, rotation: 270 },
    ])
  })

  it("全体の面は、ファイルごとの面を面のまま入れ子にして、葉ごとにファイルを付けて渡す", () => {
    const files = [
      buildImportedFile("A", 2, { pagesPerSheet: 2 }),
      buildImportedFile("B", 1, { rotation: 90 }),
    ]
    const inputs = buildPdfPageInputs(
      sheetsOf({ files, globalNUp: nUpOf(4) }),
      files
    )
    expect(inputs).toEqual([
      {
        kind: "sheet",
        nUp: nUpOf(4),
        slots: [
          {
            kind: "sheet",
            nUp: nUpOf(2),
            slots: [
              {
                kind: "page",
                filePath: "/tmp/A.pdf",
                pageNumber: 1,
                rotation: 0,
              },
              {
                kind: "page",
                filePath: "/tmp/A.pdf",
                pageNumber: 2,
                rotation: 0,
              },
            ],
          },
          { kind: "page", filePath: "/tmp/B.pdf", pageNumber: 1, rotation: 90 },
          null,
          null,
        ],
      },
    ])
  })
})
