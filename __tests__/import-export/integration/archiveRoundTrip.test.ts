/**
 * 試験アーカイブ（.score）の展開テスト
 *
 * テスト対象:
 * - electron-src/lib/import/exam-archive/archiveExtractor.ts
 *
 * 旧書き出しで作った固定ファイル（__tests__/fixtures/legacy-archives/exam-full.score）と、
 * テスト内で手組みした ZIP（testArchiveHelper）を展開して確かめる。
 */

import AdmZip from "adm-zip"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  createMinimalArchiveContents,
  createTestArchive,
} from "../../helpers/testArchiveHelper"
import { createMinimalPngBuffer } from "../../helpers/testImageHelper"
import { getTestPrismaClient } from "../../helpers/testPrismaClient"

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
import { legacyArchivePath } from "../../helpers/legacyArchiveFixtures"

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
    const archiveContents = createMinimalArchiveContents({
      examId: "rt-exam-1",
      examName: "RT試験",
    })

    // students追加
    archiveContents.studentsData.students = [
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
    archiveContents.counts.students = 1

    const archivePath = path.join(testDir, "test.score")
    createTestArchive(archiveContents, archivePath, "rt-exam-1", "RT試験")

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

  // RT-F: 旧書き出しが実際に書いた形を読めること。固定ファイル exam-full.score は
  // createFullTestExam（2ページ×2設問・3名・採点・注釈・模範解答と答案の画像・
  // 出力設定・タグ）に返却版・覚え書き・非表示の学級を足した試験を、旧書き出しで書いたもの
  it("RT-F: 旧書き出しで作った試験アーカイブを、ZIP の各 JSON どおりに展開できる", async () => {
    const archivePath = legacyArchivePath("exam-full.score")
    const zip = new AdmZip(archivePath)
    const readZipJson = (entryName: string): unknown =>
      JSON.parse(zip.readAsText(entryName))

    const result = await extractArchive(archivePath)
    expect(result.success).toBe(true)
    const data = result.data!

    expect(data.manifest).toEqual(readZipJson("manifest.json"))
    expect(data.examData).toEqual(readZipJson("exam.json"))
    expect(data.studentsData).toEqual(readZipJson("students.json"))
    expect(data.classesData).toEqual(readZipJson("classes.json"))
    expect(data.usersData).toEqual(readZipJson("users.json"))
    expect(data.subtotalsData).toEqual(readZipJson("subtotals.json"))
    expect(data.scoresData).toEqual(readZipJson("scores.json"))
    expect(data.tagsData).toEqual(readZipJson("tags.json"))
    expect(data.transformWarnings).toEqual([])

    // 画像は模範解答・答案とも、件数どおりに展開される
    expect(data.masterImagePaths).toHaveLength(
      data.manifest.counts.masterImages
    )
    expect(data.answerSheetPaths).toHaveLength(
      data.manifest.counts.answerSheetImages
    )
    expect(data.answerSheetPaths.length).toBeGreaterThan(0)
    for (const imagePath of [
      ...data.masterImagePaths,
      ...data.answerSheetPaths,
    ]) {
      expect(fs.existsSync(imagePath)).toBe(true)
    }

    cleanupTempDir(data.tempDir)
  })

  // RT-3: マスター画像がアーカイブに含まれ抽出可能
  it("RT-3: マスター画像がアーカイブに含まれ抽出可能", async () => {
    const archiveContents = createMinimalArchiveContents()
    const pngBuffer = createMinimalPngBuffer()

    const archivePath = path.join(testDir, "images-test.score")
    createTestArchive(archiveContents, archivePath, "img-exam", "画像テスト", {
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
    const archiveContents = createMinimalArchiveContents()
    const pngBuffer = createMinimalPngBuffer()

    const archivePath = path.join(testDir, "answer-images.score")
    createTestArchive(
      archiveContents,
      archivePath,
      "img-exam-2",
      "答案テスト",
      {
        answerSheetFiles: [
          {
            archivePath: "answer-sheets/S001_page1.png",
            content: pngBuffer,
          },
        ],
      }
    )

    const result = await extractArchive(archivePath)
    expect(result.success).toBe(true)
    expect(result.data!.answerSheetPaths.length).toBe(1)
    expect(result.data!.answerSheetPaths[0]).toContain("S001_page1.png")

    cleanupTempDir(result.data!.tempDir)
  })

  // RT-5: 画像なしアーカイブが成功
  it("RT-5: 画像なしアーカイブが正常に処理される", async () => {
    const archiveContents = createMinimalArchiveContents()

    const archivePath = path.join(testDir, "no-images.score")
    createTestArchive(archiveContents, archivePath, "no-img-exam", "画像なし")

    const result = await extractArchive(archivePath)
    expect(result.success).toBe(true)
    expect(result.data!.masterImagePaths).toHaveLength(0)
    expect(result.data!.answerSheetPaths).toHaveLength(0)

    cleanupTempDir(result.data!.tempDir)
  })

  // RT-6: 存在しないファイルパスでも成功（画像なしの場合）
  it("RT-6: アーカイブの抽出自体は成功する（画像ディレクトリなし）", async () => {
    const archiveContents = createMinimalArchiveContents()

    const archivePath = path.join(testDir, "sparse.score")
    createTestArchive(archiveContents, archivePath, "sparse-exam", "疎テスト")

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
    const archiveContents = createMinimalArchiveContents({
      examId: "manifest-only-exam",
    })

    const archivePath = path.join(testDir, "manifest-only.score")
    createTestArchive(
      archiveContents,
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
            referenceDate: now,
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
