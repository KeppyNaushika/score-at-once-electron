/**
 * 共有するファイルの根からパスを組む関数（`electron-src/lib/dataManager.ts`）が、
 * 根の外を指すパスと、パスの1区切りにできない id を断ることを縛る。
 *
 * - `getAbsolutePathFromSharedFiles` は正常な相対パスを今までどおり解決し、根の外・根そのものは例外
 * - `getExamDirectory` 等は uuid・cuid（初期の版の id）を通し、区切り・`.`・`..` を含む id は例外
 * - `removeDirectoryUnderSharedFiles` は根そのもの・根の外を消さない
 */
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterAll, describe, expect, it } from "vitest"

import { fixLocalStorageRootsForTest } from "../helpers/localStorageRoots"

const TEST_DATA_DIR = path.join(
  os.tmpdir(),
  `score-at-once-shared-files-directories-${process.pid}`
)
fixLocalStorageRootsForTest(TEST_DATA_DIR)

import {
  getAbsolutePathFromSharedFiles,
  getAnswerSheetsDirectory,
  getAsbDefinitionDirectory,
  getAsbImagesDirectory,
  getExamDirectory,
  getMasterAnswersDirectory,
  removeDirectoryUnderSharedFiles,
} from "../../electron-src/lib/dataManager"
import { PathOutsideRootError } from "../../electron-src/lib/pathContainment"

const EXAM_UUID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e"
const EXAM_CUID = "clx1a2b3c0000abcd1234efgh"

const UNSAFE_IDS = ["", ".", "..", "../other", "a/b", "a\\b", "C:", "a\0b"]

afterAll(() => {
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true })
})

describe("getAbsolutePathFromSharedFiles", () => {
  it("正常な相対パスは今までどおり根の下の絶対パスにする", () => {
    expect(
      getAbsolutePathFromSharedFiles(
        `exams/${EXAM_UUID}/master-answers/page.png`
      )
    ).toBe(
      path.join(TEST_DATA_DIR, "exams", EXAM_UUID, "master-answers", "page.png")
    )
  })

  const refusedPaths = [
    "",
    ".",
    "..",
    "../outside.png",
    "exams/../../outside.png",
    "/outside/file.png",
    path.join(TEST_DATA_DIR, "exams", "page.png"),
    "C:/outside/file.png",
    "exams/page.png\0",
  ]
  for (const refusedPath of refusedPaths) {
    it(`根の外・根そのものは断る: ${JSON.stringify(refusedPath)}`, () => {
      expect(() => getAbsolutePathFromSharedFiles(refusedPath)).toThrow(
        PathOutsideRootError
      )
    })
  }
})

describe("id からディレクトリを作る関数", () => {
  it("uuid と cuid の id は今までどおりのディレクトリにする", () => {
    expect(getExamDirectory(EXAM_UUID)).toBe(
      path.join(TEST_DATA_DIR, "exams", EXAM_UUID)
    )
    expect(getExamDirectory(EXAM_CUID)).toBe(
      path.join(TEST_DATA_DIR, "exams", EXAM_CUID)
    )
    expect(getAnswerSheetsDirectory(EXAM_UUID)).toBe(
      path.join(TEST_DATA_DIR, "exams", EXAM_UUID, "answer-sheets")
    )
    expect(getMasterAnswersDirectory(EXAM_UUID)).toBe(
      path.join(TEST_DATA_DIR, "exams", EXAM_UUID, "master-answers")
    )
    expect(getAsbDefinitionDirectory(EXAM_UUID)).toBe(
      path.join(TEST_DATA_DIR, "answer-sheet-builder", EXAM_UUID)
    )
    expect(getAsbImagesDirectory(EXAM_UUID)).toBe(
      path.join(TEST_DATA_DIR, "answer-sheet-builder", EXAM_UUID, "images")
    )
  })

  for (const unsafeId of UNSAFE_IDS) {
    it(`パスの1区切りにできない id は断る: ${JSON.stringify(unsafeId)}`, () => {
      expect(() => getExamDirectory(unsafeId)).toThrow(PathOutsideRootError)
      expect(() => getAnswerSheetsDirectory(unsafeId)).toThrow(
        PathOutsideRootError
      )
      expect(() => getMasterAnswersDirectory(unsafeId)).toThrow(
        PathOutsideRootError
      )
      expect(() => getAsbDefinitionDirectory(unsafeId)).toThrow(
        PathOutsideRootError
      )
      expect(() => getAsbImagesDirectory(unsafeId)).toThrow(
        PathOutsideRootError
      )
    })
  }
})

describe("removeDirectoryUnderSharedFiles", () => {
  it("根そのもの・根の外は消さずに断る", async () => {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true })
    await expect(
      removeDirectoryUnderSharedFiles(TEST_DATA_DIR)
    ).rejects.toThrow(PathOutsideRootError)
    await expect(
      removeDirectoryUnderSharedFiles(path.dirname(TEST_DATA_DIR))
    ).rejects.toThrow(PathOutsideRootError)
    expect(fs.existsSync(TEST_DATA_DIR)).toBe(true)
  })

  it("根の下の試験のディレクトリは消す", async () => {
    const examDirectory = getExamDirectory(EXAM_UUID)
    fs.mkdirSync(path.join(examDirectory, "answer-sheets"), {
      recursive: true,
    })
    fs.writeFileSync(path.join(examDirectory, "answer-sheets", "a.png"), "")
    await removeDirectoryUnderSharedFiles(examDirectory)
    expect(fs.existsSync(examDirectory)).toBe(false)
    expect(fs.existsSync(TEST_DATA_DIR)).toBe(true)
  })
})
