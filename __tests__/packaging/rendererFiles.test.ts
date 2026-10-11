/**
 * パッケージ版の画面の配り方（`electron-src/lib/rendererFiles.ts`）。
 *
 * 静的書き出しと同じ形のファイルを一時フォルダに並べ、URL からどのファイルが返るかを見る。
 */
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { resolveRendererFile } from "@/electron-src/lib/rendererFiles"

const EXPORT_FILES = [
  "index.html",
  "index.txt",
  "404.html",
  "exams.html",
  "exams/__next._tree.txt",
  "exams/__.html",
  "exams/__.txt",
  "exams/__/07-score-at-once.html",
  "exams/__/07-score-at-once.txt",
  "exams/__/07-score-at-once/__next._tree.txt",
  "_next/static/chunks/main.js",
  "js/pdf.worker.min.mjs",
]

let exportDir: string

beforeAll(() => {
  exportDir = fs.mkdtempSync(path.join(os.tmpdir(), "renderer-export-"))
  EXPORT_FILES.forEach((relativePath) => {
    const filePath = path.join(exportDir, relativePath)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, relativePath)
  })
  fs.writeFileSync(path.join(exportDir, "..", "outside.txt"), "outside")
})

afterAll(() => {
  fs.rmSync(path.join(exportDir, "..", "outside.txt"), { force: true })
  fs.rmSync(exportDir, { recursive: true, force: true })
})

const servedFile = (requestUrl: string) => {
  const rendererFile = resolveRendererFile(exportDir, requestUrl)
  if (!rendererFile) return null
  return {
    file: path.relative(exportDir, rendererFile.filePath),
    statusCode: rendererFile.statusCode,
    contentType: rendererFile.contentType,
  }
}

describe("画面の静的書き出しを配る", () => {
  it.each([
    ["/", "index.html"],
    ["/exams", "exams.html"],
    ["/exams/__next._tree.txt?_rsc=x1", "exams/__next._tree.txt"],
    ["/exams/abc-123", "exams/__.html"],
    ["/exams/abc-123/07-score-at-once", "exams/__/07-score-at-once.html"],
    [
      "/exams/abc-123/07-score-at-once.txt?_rsc=x1",
      "exams/__/07-score-at-once.txt",
    ],
    [
      "/exams/abc-123/07-score-at-once/__next._tree.txt",
      "exams/__/07-score-at-once/__next._tree.txt",
    ],
    ["/_next/static/chunks/main.js", "_next/static/chunks/main.js"],
  ])("%s → %s", (requestUrl, file) => {
    expect(servedFile(requestUrl)).toMatchObject({ file, statusCode: 200 })
  })

  it("Content-Type を拡張子から決める（PDF.js の作業者は JavaScript として）", () => {
    expect(servedFile("/js/pdf.worker.min.mjs")?.contentType).toMatch(
      /^text\/javascript/
    )
    expect(servedFile("/exams/abc-123")?.contentType).toMatch(/^text\/html/)
  })

  it.each([
    "/no-such-page",
    "/exams/abc-123/99-no-such-step",
    "/..%2Foutside.txt",
    "/%E0%A4%A",
  ])("無いものは 404.html を 404 で返す: %s", (requestUrl) => {
    expect(servedFile(requestUrl)).toMatchObject({
      file: "404.html",
      statusCode: 404,
    })
  })
})
