/**
 * アーカイブ往復テスト
 *
 * テスト対象:
 * - electron-src/lib/export/exam-archive/archiveCreator.ts
 * - electron-src/lib/import/exam-archive/archiveExtractor.ts
 *
 * Electron非依存でZIPの作成・抽出・検証を行う
 */

import AdmZip from "adm-zip"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  createMinimalCollectedData,
  createTestArchive,
  verifyArchiveContents,
} from "../../helpers/testArchiveHelper"
import { createMinimalPngBuffer } from "../../helpers/testImageHelper"

// electronモック
vi.mock("electron", () => ({
  app: {
    getVersion: () => "0.5.0-test",
    getAppPath: () => process.cwd(),
  },
  dialog: { showSaveDialog: vi.fn() },
}))

// Prismaクライアントモック（archiveExtractorでは不使用だが依存チェーン対策）
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
  readManifestOnly,
} from "../../../electron-src/lib/import/exam-archive/archiveExtractor"

let testDir: string

describe("archiveRoundTrip", () => {
  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "archive-rt-"))
  })

  afterEach(() => {
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  // RT-1: CollectedDataからアーカイブ作成→抽出→全JSONファイル一致
  it("RT-1: アーカイブ作成→抽出で全JSONデータが一致する", async () => {
    const collectedData = createMinimalCollectedData({
      examId: "rt-exam-1",
      examName: "RT試験",
    })

    // students追加
    collectedData.studentsData.students = [
      {
        id: "s1",
        studentNumber: "S001",
        lastName: "山田",
        firstName: "太郎",
        lastNameKana: "ヤマダ",
        firstNameKana: "タロウ",
        enrollmentYear: 2024,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]
    collectedData.counts.students = 1

    const archivePath = path.join(testDir, "test.score")
    createTestArchive(collectedData, archivePath, "rt-exam-1", "RT試験")

    // 抽出
    const result = await extractArchive(archivePath)
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()

    const data = result.data!

    // JSON一致
    expect(data.examData.exam.id).toBe("rt-exam-1")
    expect(data.studentsData.students.length).toBe(1)
    expect(data.studentsData.students[0].lastName).toBe("山田")
    expect(data.manifest.examName).toBe("RT試験")

    // 後片付け
    cleanupTempDir(data.tempDir)
  })

  // RT-2: マニフェスト構造の検証
  it("RT-2: マニフェスト構造が正しく作成される", async () => {
    const collectedData = createMinimalCollectedData({
      examId: "rt-exam-2",
      examName: "マニフェストテスト",
    })

    const archivePath = path.join(testDir, "manifest-test.score")
    createTestArchive(
      collectedData,
      archivePath,
      "rt-exam-2",
      "マニフェストテスト"
    )

    const contents = verifyArchiveContents(archivePath)
    expect(contents.manifest.version).toBe("1.4.0")
    expect(contents.manifest.examId).toBe("rt-exam-2")
    expect(contents.manifest.examName).toBe("マニフェストテスト")
    expect(contents.manifest.exportedAt).toBeDefined()
    expect(contents.manifest.counts).toBeDefined()
  })

  // RT-3: マスター画像がアーカイブに含まれ抽出可能
  it("RT-3: マスター画像がアーカイブに含まれ抽出可能", async () => {
    const collectedData = createMinimalCollectedData()
    const pngBuffer = createMinimalPngBuffer()

    const archivePath = path.join(testDir, "images-test.score")
    createTestArchive(collectedData, archivePath, "img-exam", "画像テスト", {
      masterImageFiles: [
        { archivePath: "master-images/page1.png", content: pngBuffer },
      ],
    })

    const result = await extractArchive(archivePath)
    expect(result.success).toBe(true)
    expect(result.data!.masterImagePaths.length).toBe(1)
    expect(result.data!.masterImagePaths[0]).toContain("page1.png")

    // ファイルが実際に存在する
    expect(fs.existsSync(result.data!.masterImagePaths[0])).toBe(true)

    cleanupTempDir(result.data!.tempDir)
  })

  // RT-4: 答案画像がアーカイブに含まれ抽出可能
  it("RT-4: 答案画像がアーカイブに含まれ抽出可能", async () => {
    const collectedData = createMinimalCollectedData()
    const pngBuffer = createMinimalPngBuffer()

    const archivePath = path.join(testDir, "answer-images.score")
    createTestArchive(collectedData, archivePath, "img-exam-2", "答案テスト", {
      answerSheetFiles: [
        {
          archivePath: "answer-sheets/S001_page1.png",
          content: pngBuffer,
        },
      ],
    })

    const result = await extractArchive(archivePath)
    expect(result.success).toBe(true)
    expect(result.data!.answerSheetPaths.length).toBe(1)
    expect(result.data!.answerSheetPaths[0]).toContain("S001_page1.png")

    cleanupTempDir(result.data!.tempDir)
  })

  // RT-5: 画像なしアーカイブが成功
  it("RT-5: 画像なしアーカイブが正常に処理される", async () => {
    const collectedData = createMinimalCollectedData()

    const archivePath = path.join(testDir, "no-images.score")
    createTestArchive(collectedData, archivePath, "no-img-exam", "画像なし")

    const result = await extractArchive(archivePath)
    expect(result.success).toBe(true)
    expect(result.data!.masterImagePaths).toHaveLength(0)
    expect(result.data!.answerSheetPaths).toHaveLength(0)

    cleanupTempDir(result.data!.tempDir)
  })

  // RT-6: 存在しないファイルパスでも成功（画像なしの場合）
  it("RT-6: アーカイブの抽出自体は成功する（画像ディレクトリなし）", async () => {
    const collectedData = createMinimalCollectedData()

    const archivePath = path.join(testDir, "sparse.score")
    createTestArchive(collectedData, archivePath, "sparse-exam", "疎テスト")

    const result = await extractArchive(archivePath)
    expect(result.success).toBe(true)

    cleanupTempDir(result.data!.tempDir)
  })

  // RT-7: 存在しないアーカイブパスでエラー
  it("RT-7: 存在しないアーカイブパスでエラーが返る", async () => {
    const result = await extractArchive("/nonexistent/path/file.score")
    expect(result.success).toBe(false)
    expect(result.error).toContain("見つかりません")
  })

  // RT-8: 破損ZIPでエラー
  it("RT-8: 破損ZIPファイルでエラーが返る", async () => {
    const corruptPath = path.join(testDir, "corrupt.score")
    fs.writeFileSync(corruptPath, "this is not a zip file")

    const result = await extractArchive(corruptPath)
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  // RT-9: manifest.jsonなしZIPでエラー
  it("RT-9: manifest.jsonなしのZIPでエラーが返る", async () => {
    const noManifestPath = path.join(testDir, "no-manifest.score")
    const zip = new AdmZip()
    zip.addFile("exam.json", Buffer.from("{}"))
    zip.writeZip(noManifestPath)

    const result = await extractArchive(noManifestPath)
    expect(result.success).toBe(false)
    expect(result.error).toContain("マニフェスト")
  })

  // RT-10: readManifestOnlyで完全抽出なしにマニフェスト取得
  it("RT-10: readManifestOnlyで完全抽出なしにマニフェストを取得できる", async () => {
    const collectedData = createMinimalCollectedData({
      examId: "manifest-only-exam",
    })

    const archivePath = path.join(testDir, "manifest-only.score")
    createTestArchive(
      collectedData,
      archivePath,
      "manifest-only-exam",
      "マニフェストのみ"
    )

    const result = await readManifestOnly(archivePath)
    expect(result.success).toBe(true)
    expect(result.manifest).toBeDefined()
    expect(result.manifest!.examId).toBe("manifest-only-exam")
    expect(result.manifest!.examName).toBe("マニフェストのみ")
  })

  // RT-11: subjects.jsonなし（v1.4.0以前）でデフォルト空配列
  it("RT-11: subjects.jsonなしの場合はデフォルト空配列となる", async () => {
    const archivePath = path.join(testDir, "no-subjects.score")

    // subjects.jsonなしのZIPを手動作成
    const zip = new AdmZip()
    const now = new Date().toISOString()

    zip.addFile(
      "manifest.json",
      Buffer.from(
        JSON.stringify({
          version: "1.3.0",
          schemaVersion: "test",
          appVersion: "0.4.0",
          exportedAt: now,
          examId: "old-exam",
          examName: "旧バージョン",
          counts: {
            students: 0,
            classes: 0,
            users: 0,
            pages: 0,
            regions: 0,
            scores: 0,
            annotations: 0,
            subtotalGroups: 0,
            masterImages: 0,
            answerSheetImages: 0,
          },
        })
      )
    )
    zip.addFile(
      "exam.json",
      Buffer.from(
        JSON.stringify({
          exam: {
            id: "old-exam",
            examName: "旧",
            examDate: now,
            subject: null,
            description: null,
            createdAt: now,
            updatedAt: now,
          },
          examPages: [],
          cropRegions: [],
          pageImages: [],
          masterImages: [],
          studentAnswerImages: [],
          examStudents: [],
          userExams: [],
          examSubtotalGroups: [],
          examClassrooms: [],
        })
      )
    )
    zip.addFile("students.json", Buffer.from(JSON.stringify({ students: [] })))
    zip.addFile(
      "classes.json",
      Buffer.from(JSON.stringify({ classes: [], memberships: [] }))
    )
    zip.addFile("users.json", Buffer.from(JSON.stringify({ users: [] })))
    zip.addFile(
      "subtotals.json",
      Buffer.from(
        JSON.stringify({
          subtotalGroups: [],
          subtotals: [],
          cropSubtotals: [],
        })
      )
    )
    zip.addFile(
      "scores.json",
      Buffer.from(
        JSON.stringify({
          questionScores: [],
          drawingAnnotations: [],
        })
      )
    )
    // subjects.jsonは意図的に含めない
    zip.writeZip(archivePath)

    const result = await extractArchive(archivePath)
    expect(result.success).toBe(true)
    expect(result.data!.tagsData).toBeDefined()
    expect(result.data!.tagsData.tags).toHaveLength(0)
    expect(result.data!.tagsData.tagSubtotalGroups).toHaveLength(0)

    cleanupTempDir(result.data!.tempDir)
  })
})
