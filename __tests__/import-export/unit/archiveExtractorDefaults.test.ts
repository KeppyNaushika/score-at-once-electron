/**
 * archiveExtractor が「型の上では必ず在る配列」に既定を入れることの検証
 *
 * JSON は書き手が省いたキーを黙って落とすので、型が `T[]` を主張していても実物が
 * `undefined` である可能性は消えない。取り込み側は `for...of` で回すため、欠けたキーは
 * `TypeError: … is not iterable` でトランザクションごと巻き戻り、利用者には型エラーが
 * そのまま出ていた。
 */

import AdmZip from "adm-zip"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { EXAM_CURRENT_VERSION } from "../../../src/types/examArchive.types"

vi.mock("electron", () => ({
  app: {
    getVersion: () => "0.5.0-test",
    getAppPath: () => process.cwd(),
  },
  dialog: { showSaveDialog: vi.fn() },
}))

vi.mock("../../../electron-src/lib/prisma/client", () => {
  const { getTestPrismaClient } = require("../../helpers/testPrismaClient")
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

vi.mock("../../../electron-src/lib/dataManager", () => ({
  getDataDirectory: () => "/tmp/test-data",
}))

import {
  cleanupTempDir,
  extractArchive,
} from "../../../electron-src/lib/import/exam-archive/archiveExtractor"

let testDir: string

/**
 * セクションのキーを欠いたアーカイブを組む。
 * 型付きの CollectedData から `delete` すると型を偽ることになるので、
 * ここでは生のオブジェクトのまま zip へ書く。
 */
function createArchiveWithBareSections(outputPath: string): void {
  const zip = new AdmZip()
  const write = (name: string, value: unknown) =>
    zip.addFile(name, Buffer.from(JSON.stringify(value)))

  write("manifest.json", {
    version: EXAM_CURRENT_VERSION,
    schemaVersion: "test",
    appVersion: "0.5.0-test",
    exportedAt: new Date().toISOString(),
    examId: "bare-exam",
    examName: "キーを欠くアーカイブ",
    counts: {},
  })
  write("exam.json", {
    exam: {
      id: "bare-exam",
      examName: "キーを欠くアーカイブ",
      referenceDate: null,
      description: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    // examPages / cropRegions / examStudents / userExams /
    // examSubtotalGroups / examClassrooms / pageImages を丸ごと欠く
  })
  write("students.json", {})
  write("classes.json", {})
  write("users.json", {})
  // 段階58 で見つかった実例。1.0.0 の実エクスポータは書いていたが、
  // 型も変換器も既定を持たないので欠けたら落ちていた
  write("subtotals.json", { subtotalGroups: [], subtotals: [] })
  write("scores.json", {})
  write("tags.json", {})

  zip.writeZip(outputPath)
}

describe("archiveExtractorDefaults", () => {
  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "archive-defaults-"))
  })

  afterEach(() => {
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  it("セクションのキーを欠くアーカイブでも、配列は空配列として読める", async () => {
    const archivePath = path.join(testDir, "bare.score")
    createArchiveWithBareSections(archivePath)

    const result = await extractArchive(archivePath)
    expect(result.success).toBe(true)
    const data = result.data!

    expect(data.examData.examPages).toEqual([])
    expect(data.examData.cropRegions).toEqual([])
    expect(data.examData.examStudents).toEqual([])
    expect(data.examData.userExams).toEqual([])
    expect(data.examData.examSubtotalGroups).toEqual([])
    expect(data.examData.examClassrooms).toEqual([])
    expect(data.examData.pageImages).toEqual([])
    expect(data.studentsData.students).toEqual([])
    expect(data.classesData.classrooms).toEqual([])
    expect(data.classesData.memberships).toEqual([])
    expect(data.usersData.users).toEqual([])
    expect(data.subtotalsData.subtotalGroups).toEqual([])
    expect(data.subtotalsData.subtotals).toEqual([])
    expect(data.subtotalsData.cropSubtotals).toEqual([])
    expect(data.scoresData.questionScores).toEqual([])
    expect(data.scoresData.drawingAnnotations).toEqual([])
    expect(data.tagsData.tags).toEqual([])
    expect(data.tagsData.tagSubtotalGroups).toEqual([])
    expect(data.tagsData.examTags).toEqual([])

    // 既定を入れても for...of が落ちないことを、実際に回して確かめる
    for (const cropSubtotal of data.subtotalsData.cropSubtotals) {
      expect(cropSubtotal).toBeDefined()
    }

    cleanupTempDir(data.tempDir)
  })
})
