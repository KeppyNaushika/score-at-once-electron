/**
 * PDF加工: N-up の面を pdf-lib で描く経路（main プロセス）の固定。
 *
 * 面全体は回さず、スロットの中で各ページを回して置く。埋め込んだページは元PDFの
 * /Rotate を含まない向きで描かれるので、/Rotate を寸法にも回転にも足す必要がある
 * （足さないと、/Rotate 付きのページが横倒しの縦横で収められる）。
 *
 * 全体 N-up の入れ子の面も、葉（元ページ）ごとに出力用紙へ直接描く（内側の面を一度
 * ページにしてから縮めない）。
 */
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import {
  decodePDFRawStream,
  degrees,
  PDFArray,
  PDFDocument,
  PDFRawStream,
} from "pdf-lib"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { mergePdfs } from "@/electron-src/lib/pdf-tools/pdfMerger"
import type {
  NUpConfig,
  PdfNUpSheetInput,
  PdfSourcePageInput,
  RotationDegree,
} from "@/types/pdfTools.types"

const A4 = { width: 595.28, height: 841.89 }
const TWO_UP: NUpConfig = {
  pagesPerSheet: 2,
  slotOrder: "from-top-left-rightward",
}

/** 時計回り90°の回転行列（cos は浮動小数の誤差で 0 にならないので値を問わない） */
const CLOCKWISE_90_MATRIX = /\S+ -1 1 \S+ 0 0 cm/

let workDir: string

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-nup-"))
})

afterEach(() => {
  fs.rmSync(workDir, { recursive: true, force: true })
})

/** A4縦（MediaBox）のページを並べたPDFを作る（/Rotate を付けたページも作れる） */
async function writeSourcePdf(
  name: string,
  pageRotations: number[]
): Promise<string> {
  const sourcePdf = await PDFDocument.create()
  pageRotations.forEach((pageRotation) => {
    const page = sourcePdf.addPage([A4.width, A4.height])
    page.setRotation(degrees(pageRotation))
    // 内容の無いページは埋め込めないので、何か描いておく
    page.drawRectangle({ x: 10, y: 10, width: 100, height: 50 })
  })
  const filePath = path.join(workDir, name)
  fs.writeFileSync(filePath, await sourcePdf.save())
  return filePath
}

function sheetOf(
  filePath: string,
  slots: ({ pageNumber: number; rotation: RotationDegree } | null)[]
): PdfNUpSheetInput {
  return {
    kind: "sheet",
    nUp: TWO_UP,
    slots: slots.map((slot) =>
      slot ? { kind: "page", filePath, ...slot } : null
    ),
  }
}

/** 書き出したPDFの1ページ目の寸法と、描画命令（展開した内容ストリーム） */
async function readFirstPage(outputPath: string) {
  const outputPdf = await PDFDocument.load(fs.readFileSync(outputPath))
  const page = outputPdf.getPage(0)
  const contents = page.node.Contents()
  const streams =
    contents instanceof PDFArray
      ? contents.asArray().map((ref) => outputPdf.context.lookup(ref))
      : [contents]
  const operators = streams
    .map((stream) =>
      stream instanceof PDFRawStream
        ? new TextDecoder().decode(decodePDFRawStream(stream).decode())
        : ""
    )
    .join("\n")
  return {
    size: page.getSize(),
    rotation: page.getRotation().angle,
    pageCount: outputPdf.getPageCount(),
    operators,
  }
}

/** 変換行列 [a b c d e f]（点 (x, y) → (a·x + c·y + e, b·x + d·y + f)） */
type Matrix = [number, number, number, number, number, number]

/**
 * 描画命令から、描いたページ（Do）ごとに、元ページ（A4 縦の MediaBox）が出力用紙の
 * どこを覆うかと、回転の向き（変換行列の回転・拡大の部分の符号）を取り出す。
 * drawPage は q・平行移動・回転・拡大の cm・Do・Q を出すので、q から Do までの cm を
 * 合成する（後に書いた cm から先に点へ掛かる）。
 */
function drawnPages(operators: string) {
  const blocks = operators.split(/\bq\b/).filter((block) => / Do/.test(block))
  return blocks.map((block) => {
    const matrices = [...block.matchAll(/((?:\S+ ){6})cm/g)].map(
      (match): Matrix => {
        const [a, b, c, d, e, f] = match[1].trim().split(" ").map(Number)
        return [a, b, c, d, e, f]
      }
    )
    const transform = (point: { x: number; y: number }) =>
      matrices.reduceRight(
        (current, [a, b, c, d, e, f]) => ({
          x: a * current.x + c * current.y + e,
          y: b * current.x + d * current.y + f,
        }),
        point
      )
    const corners = [
      { x: 0, y: 0 },
      { x: A4.width, y: 0 },
      { x: 0, y: A4.height },
      { x: A4.width, y: A4.height },
    ].map(transform)
    const origin = transform({ x: 0, y: 0 })
    const unitX = transform({ x: 1, y: 0 })
    const xs = corners.map((corner) => corner.x)
    const ys = corners.map((corner) => corner.y)
    return {
      left: Math.min(...xs),
      bottom: Math.min(...ys),
      right: Math.max(...xs),
      top: Math.max(...ys),
      // 元ページの x 軸が出力でどちらを向くか（時計回り90°なら下、270°なら上）
      xAxis: {
        x: Math.sign(Math.round((unitX.x - origin.x) * 1e6)),
        y: Math.sign(Math.round((unitX.y - origin.y) * 1e6)),
      },
    }
  })
}

describe("N-up の面の書き出し", () => {
  it("縦長のページ2枚は、用紙横で左右に並べる（面全体は回さない）", async () => {
    const filePath = await writeSourcePdf("portrait.pdf", [0, 0])
    const outputPath = path.join(workDir, "out.pdf")
    await mergePdfs(
      [
        sheetOf(filePath, [
          { pageNumber: 1, rotation: 0 },
          { pageNumber: 2, rotation: 0 },
        ]),
      ],
      outputPath
    )

    const output = await readFirstPage(outputPath)
    expect(output.size.width).toBeCloseTo(A4.height)
    expect(output.size.height).toBeCloseTo(A4.width)
    expect(output.rotation).toBe(0)
    expect(output.operators.match(/ Do/g)).toHaveLength(2)
  })

  it("/Rotate 90 のページは横長として扱い、用紙縦で上下に並べて /Rotate の分だけ回して描く", async () => {
    const filePath = await writeSourcePdf("rotated.pdf", [90, 90])
    const outputPath = path.join(workDir, "out.pdf")
    await mergePdfs(
      [
        sheetOf(filePath, [
          { pageNumber: 1, rotation: 0 },
          { pageNumber: 2, rotation: 0 },
        ]),
      ],
      outputPath
    )

    const output = await readFirstPage(outputPath)
    expect(output.size.width).toBeCloseTo(A4.width)
    expect(output.size.height).toBeCloseTo(A4.height)
    // 時計回り90° = 反時計回り -90° の回転行列（cos ≒ 0, sin -1）
    expect(output.operators).toMatch(CLOCKWISE_90_MATRIX)
  })

  it("指定の回転と /Rotate を足して回す（/Rotate 90 に 270 を足すと回さない）", async () => {
    const filePath = await writeSourcePdf("rotated.pdf", [90, 90])
    const outputPath = path.join(workDir, "out.pdf")
    await mergePdfs(
      [
        sheetOf(filePath, [
          { pageNumber: 1, rotation: 270 },
          { pageNumber: 2, rotation: 270 },
        ]),
      ],
      outputPath
    )

    const output = await readFirstPage(outputPath)
    // 元の向き（縦長）に戻るので、用紙横で左右に並ぶ
    expect(output.size.width).toBeCloseTo(A4.height)
    expect(output.operators).not.toMatch(CLOCKWISE_90_MATRIX)
  })

  it("空きスロットは描かず、ページは自分のスロットに残る", async () => {
    const filePath = await writeSourcePdf("portrait.pdf", [0])
    const outputPath = path.join(workDir, "out.pdf")
    await mergePdfs(
      [sheetOf(filePath, [{ pageNumber: 1, rotation: 0 }, null])],
      outputPath
    )

    const output = await readFirstPage(outputPath)
    expect(output.pageCount).toBe(1)
    expect(output.operators.match(/ Do/g)).toHaveLength(1)
    // 左のスロット（x=0）に置く
    expect(output.operators).toMatch(/1 0 0 1 0 0 cm/)
  })
})

describe("全体 N-up の入れ子の面の書き出し", () => {
  /** A4 の短辺÷長辺 */
  const A4_RATIO = A4.width / A4.height

  it("2ファイルをまたぎ、ファイルごとの面と単独ページを1面に描く（葉ごとに用紙へ直接描く）", async () => {
    // A: /Rotate 90 のページ2枚（横長として扱う）、B: 縦長のページを 270° 回して横長に
    const filePathA = await writeSourcePdf("a.pdf", [90, 90])
    const filePathB = await writeSourcePdf("b.pdf", [0])
    const pageOf = (
      filePath: string,
      pageNumber: number,
      rotation: RotationDegree
    ): PdfSourcePageInput => ({ kind: "page", filePath, pageNumber, rotation })
    const outputPath = path.join(workDir, "out.pdf")
    await mergePdfs(
      [
        {
          kind: "sheet",
          nUp: TWO_UP,
          slots: [
            {
              kind: "sheet",
              nUp: TWO_UP,
              slots: [pageOf(filePathA, 1, 0), pageOf(filePathA, 2, 0)],
            },
            pageOf(filePathB, 1, 270),
          ],
        },
      ],
      outputPath
    )

    const output = await readFirstPage(outputPath)
    // A の面（横長2枚を上下 = 縦長）と横長の B1 → 用紙横で左右
    expect(output.pageCount).toBe(1)
    expect(output.size.width).toBeCloseTo(A4.height)
    expect(output.size.height).toBeCloseTo(A4.width)
    expect(output.rotation).toBe(0)

    const [a1, a2, b1] = drawnPages(output.operators)
    expect(drawnPages(output.operators)).toHaveLength(3)

    // A の面は左のスロット（幅 A4.height / 2）の高さに合わせて A4_RATIO 倍に縮む。
    // 面の中の横長のページは、面のスロット（A4.width × A4.height / 2）の幅に合わせて縮む
    const slotWidth = A4.height / 2
    const fileSheetLeft = (slotWidth - A4.width * A4_RATIO) / 2
    const pageHeightInFileSheet = A4.width * A4_RATIO
    const pageTopInFileSheet = (A4.height / 2 - pageHeightInFileSheet) / 2
    const a1Top = A4.width - pageTopInFileSheet * A4_RATIO
    const a2Top = A4.width - (A4.height / 2 + pageTopInFileSheet) * A4_RATIO
    for (const [drawn, top] of [
      [a1, a1Top],
      [a2, a2Top],
    ] as const) {
      expect(drawn.left).toBeCloseTo(fileSheetLeft, 3)
      expect(drawn.right).toBeCloseTo(fileSheetLeft + A4.width * A4_RATIO, 3)
      expect(drawn.top).toBeCloseTo(top, 3)
      expect(drawn.top - drawn.bottom).toBeCloseTo(
        pageHeightInFileSheet * A4_RATIO,
        3
      )
      // /Rotate 90 の分だけ時計回りに回して描く（元ページの x 軸が下を向く）
      expect(drawn.xAxis).toEqual({ x: 0, y: -1 })
    }

    // B1 は右のスロットの幅に合わせて半分に縮み、上下中央
    expect(b1.left).toBeCloseTo(slotWidth, 3)
    expect(b1.right).toBeCloseTo(A4.height, 3)
    expect(b1.top - b1.bottom).toBeCloseTo(A4.width / 2, 3)
    expect(b1.bottom).toBeCloseTo(A4.width / 4, 3)
    // 指定の 270°（反時計回り90°）で描く（元ページの x 軸が上を向く）
    expect(b1.xAxis).toEqual({ x: 0, y: 1 })
  })

  it("全体の端数の空きスロットは描かない", async () => {
    const filePathA = await writeSourcePdf("a.pdf", [0, 0])
    const outputPath = path.join(workDir, "out.pdf")
    await mergePdfs(
      [
        {
          kind: "sheet",
          nUp: { pagesPerSheet: 4, slotOrder: "from-top-left-rightward" },
          slots: [
            sheetOf(filePathA, [
              { pageNumber: 1, rotation: 0 },
              { pageNumber: 2, rotation: 0 },
            ]),
            null,
            null,
            null,
          ],
        },
      ],
      outputPath
    )
    const output = await readFirstPage(outputPath)
    expect(output.pageCount).toBe(1)
    expect(drawnPages(output.operators)).toHaveLength(2)
  })
})
