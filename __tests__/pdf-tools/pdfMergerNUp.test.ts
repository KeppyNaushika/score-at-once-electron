/**
 * PDF加工: N-up の面を pdf-lib で描く経路（main プロセス）の固定。
 *
 * 面全体は回さず、スロットの中で各ページを回して置く。埋め込んだページは元PDFの
 * /Rotate を含まない向きで描かれるので、/Rotate を寸法にも回転にも足す必要がある
 * （足さないと、/Rotate 付きのページが横倒しの縦横で収められる）。
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
