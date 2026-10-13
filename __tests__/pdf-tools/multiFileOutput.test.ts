/**
 * いくつものファイルの書き出し（`electron-src/lib/multiFileOutput.ts`）の固定。
 *
 * デスクトップ版はフォルダへ1つずつ書き、web 版は zip 1つにまとめる（保存の領域へ書いた
 * ファイルは1つずつブラウザのダウンロードになり、続けて落とすと Chrome が複数のダウンロードの
 * 許可を求めるため）。web 版かどうかは大域の `scoreAtOnceWeb`（`src/lib/webRuntime.ts`）で決まる。
 */
import { unzipSync } from "fflate"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import sharp from "sharp"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createMultiFileOutput } from "@/electron-src/lib/multiFileOutput"
import { exportPagesToPng } from "@/electron-src/lib/pdf-tools/pdfToPng"
import { PNG_PAGES_ZIP_FILE_NAME } from "@/lib/outputResultText"

const textBytes = (text: string) => new TextEncoder().encode(text)

/** 小さな PNG（ページ画像の代わり） */
const createPng = (red: number) =>
  sharp({
    create: {
      width: 4,
      height: 3,
      channels: 3,
      background: { r: red, g: 0, b: 0 },
    },
  })
    .png()
    .toBuffer()

describe("createMultiFileOutput", () => {
  let outputDir: string

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "multi-file-output-"))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fs.rmSync(outputDir, { recursive: true, force: true })
  })

  it("デスクトップ版はフォルダへ1つずつ書き、書いたパスを返す", async () => {
    const output = createMultiFileOutput(outputDir, "pages.zip")
    const firstPath = await output.add("page_001.txt", textBytes("1"))
    const secondPath = await output.add("page_002.txt", textBytes("2"))
    await output.finish()

    expect(firstPath).toBe(path.join(outputDir, "page_001.txt"))
    expect(secondPath).toBe(path.join(outputDir, "page_002.txt"))
    expect(fs.readdirSync(outputDir).sort()).toEqual([
      "page_001.txt",
      "page_002.txt",
    ])
    expect(fs.readFileSync(firstPath, "utf8")).toBe("1")
  })

  it("web 版は書き終えたときに zip 1つだけを書く", async () => {
    vi.stubGlobal("scoreAtOnceWeb", true)
    const output = createMultiFileOutput(outputDir, "pages.zip")
    const firstPath = await output.add("page_001.txt", textBytes("1"))
    await output.add("page_002.txt", textBytes("2"))

    // 足しただけでは何も書かない（書くたびにダウンロードが起きないように）
    expect(fs.readdirSync(outputDir)).toEqual([])

    await output.finish()

    expect(firstPath).toBe(path.join(outputDir, "pages.zip", "page_001.txt"))
    expect(fs.readdirSync(outputDir)).toEqual(["pages.zip"])
    const zipEntries = unzipSync(
      fs.readFileSync(path.join(outputDir, "pages.zip"))
    )
    expect(Object.keys(zipEntries).sort()).toEqual([
      "page_001.txt",
      "page_002.txt",
    ])
    expect(new TextDecoder().decode(zipEntries["page_002.txt"])).toBe("2")
  })

  it("web 版で1つも足さなければ zip を書かない", async () => {
    vi.stubGlobal("scoreAtOnceWeb", true)
    const output = createMultiFileOutput(outputDir, "pages.zip")
    await output.finish()

    expect(fs.readdirSync(outputDir)).toEqual([])
  })
})

describe("exportPagesToPng（PDF加工の PNG 書き出し）", () => {
  let outputDir: string

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "png-pages-"))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fs.rmSync(outputDir, { recursive: true, force: true })
  })

  it("デスクトップ版はページごとの PNG をフォルダへ書く", async () => {
    const outputPaths = await exportPagesToPng(
      [
        { buffer: await createPng(10), name: "page_001.png" },
        { buffer: await createPng(20), name: "page_002.png" },
      ],
      outputDir
    )

    expect(outputPaths).toHaveLength(2)
    expect(fs.readdirSync(outputDir).sort()).toEqual([
      "page_001.png",
      "page_002.png",
    ])
  })

  it("web 版はページごとの PNG を zip 1つにまとめる", async () => {
    vi.stubGlobal("scoreAtOnceWeb", true)
    const outputPaths = await exportPagesToPng(
      [
        { buffer: await createPng(10), name: "page_001.png" },
        { buffer: await createPng(20), name: "page_002.png", rotation: 90 },
      ],
      outputDir
    )

    // 件数は画面の知らせ（「2枚のPNGを…」）に使うので、デスクトップ版と同じに数える
    expect(outputPaths).toHaveLength(2)
    expect(fs.readdirSync(outputDir)).toEqual([PNG_PAGES_ZIP_FILE_NAME])
    const zipEntries = unzipSync(
      fs.readFileSync(path.join(outputDir, PNG_PAGES_ZIP_FILE_NAME))
    )
    const rotatedMetadata = await sharp(
      Buffer.from(zipEntries["page_002.png"])
    ).metadata()
    // 回転も zip の中のものに効いている（4×3 → 3×4）
    expect([rotatedMetadata.width, rotatedMetadata.height]).toEqual([3, 4])
  })
})
