/**
 * アーカイブの入口の規約をソースの走査で守る（docs/unified-archive-design.md §7.6）。
 *
 * - 書き出しは統合アーカイブ（.sao）に一本化した。旧5種（.score・.coursework・.grade・
 *   .asb・.students）を書き出す入口・チャンネルは無い
 * - 読み込みの入口は一覧ごとに1つの「読み込み」。旧形式ごとの読み込みボタンは無い
 * - 「読み込み」の種類は拡張子で決まる（大文字小文字は区別しない）
 *
 * 旧形式の読み込みの画面・チャンネルは凍結して残す（ここでは見ない）。
 */

import AdmZip from "adm-zip"
import { execSync } from "child_process"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterAll, describe, expect, it } from "vitest"

import { archiveImportFileKindOf } from "@/electron-src/lib/import/archiveImportFileKind"

const REPO_ROOT = path.resolve(__dirname, "../..")

/** 追跡中（と未追跡で無視されていない）のファイルのうち、実在するもの */
function listFiles(pattern: string): string[] {
  return execSync(
    `git ls-files --cached --others --exclude-standard ${pattern}`,
    { cwd: REPO_ROOT, encoding: "utf8" }
  )
    .trim()
    .split("\n")
    .filter(Boolean)
    .filter((relativePath) => fs.existsSync(path.join(REPO_ROOT, relativePath)))
}

/** 本文に needle を含むファイル（REPO_ROOT からの相対パス） */
function filesContaining(files: string[], needle: string): string[] {
  return files.filter((relativePath) =>
    fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8").includes(needle)
  )
}

const LEGACY_EXTENSIONS = [
  ".score",
  ".coursework",
  ".grade",
  ".asb",
  ".students",
]

describe("旧形式の書き出しの入口が無い", () => {
  const rendererFiles = listFiles("'src/**/*.ts' 'src/**/*.tsx'")
  const handlerFiles = listFiles("'electron-src/ipc-handlers/*.ts'")

  it.each(LEGACY_EXTENSIONS)("画面に「%s 書き出し」が無い", (extension) => {
    expect(filesContaining(rendererFiles, `${extension} 書き出し`)).toEqual([])
  })

  it.each(LEGACY_EXTENSIONS)(
    "画面に「%s 読み込み」のボタンが無い",
    (extension) => {
      expect(filesContaining(rendererFiles, `"${extension} 読み込み"`)).toEqual(
        []
      )
      expect(filesContaining(rendererFiles, `>${extension} 読み込み<`)).toEqual(
        []
      )
    }
  )

  it.each([
    "archive:exportExam",
    "archive:bulkExportExams",
    "studentArchive:exportStudents",
    "coursework:exportArchive",
    "grade:exportArchive",
    "asb:export-definition",
  ])("チャンネル %s が登録されていない", (channel) => {
    expect(filesContaining(handlerFiles, `"${channel}"`)).toEqual([])
  })

  it.each(["exam", "coursework", "grade", "asb", "student"])(
    "ハンドラが旧書き出し（lib/export/%s-archive）を引かない",
    (kind) => {
      expect(
        filesContaining(handlerFiles, `lib/export/${kind}-archive`)
      ).toEqual([])
    }
  )
})

describe("「読み込み」のファイルの種類", () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "archive-kind-"))
  afterAll(() => fs.rmSync(workDir, { recursive: true, force: true }))

  it.each([
    ["/x/a.sao", "sao"],
    ["/x/a.score", "score"],
    ["/x/a.hsz", "hsz"],
    ["/x/a.coursework", "coursework"],
    ["/x/a.grade", "grade"],
    ["/x/a.asb", "asb"],
    ["/x/a.students", "students"],
    ["/x/A.SAO", "sao"],
    ["/x/期末.Score", "score"],
  ])("%s は %s", (filePath, kind) => {
    expect(archiveImportFileKindOf(filePath)).toBe(kind)
  })

  it("知らない拡張子・拡張子なしは null", () => {
    expect(archiveImportFileKindOf("/x/a.zip")).toBeNull()
    expect(archiveImportFileKindOf("/x/archive")).toBeNull()
  })

  it(".dat はリアテンダント™の形式なら dat、そうでなければ .score として扱う", () => {
    const realtendant = new AdmZip()
    realtendant.addFile("data/RealtendantAppVersion.txt", Buffer.from("1.0"))
    const realtendantPath = path.join(workDir, "realtendant.dat")
    realtendant.writeZip(realtendantPath)

    const other = new AdmZip()
    other.addFile("manifest.json", Buffer.from("{}"))
    const otherPath = path.join(workDir, "other.dat")
    other.writeZip(otherPath)

    const notZipPath = path.join(workDir, "broken.dat")
    fs.writeFileSync(notZipPath, "not a zip")

    expect(archiveImportFileKindOf(realtendantPath)).toBe("dat")
    expect(archiveImportFileKindOf(otherPath)).toBe("score")
    expect(archiveImportFileKindOf(notZipPath)).toBe("score")
  })
})
