/**
 * Export→Import ラウンドトリップ E2Eテスト
 *
 * 実際のDBを使い、export→アーカイブ→import の全パイプラインを検証する
 */

import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { createTestArchive } from "../../helpers/testArchiveHelper"
import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createTestUser,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../../helpers/testPrismaClient"

// electronモック
vi.mock("electron", () => ({
  app: {
    getVersion: () => "0.5.0-test",
    getAppPath: () => process.cwd(),
  },
  dialog: { showSaveDialog: vi.fn() },
}))

// Prismaクライアントのモック
vi.mock("../../../electron-src/lib/prisma/client", () => {
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

let tmpDir: string
vi.mock("../../../electron-src/lib/dataManager", () => ({
  getDataDirectory: () => tmpDir || "/tmp/test-data",
}))

// 画像コピーのモック
vi.mock("../../../electron-src/lib/import/merge/imageImporter", () => ({
  copyImportImages: vi.fn().mockResolvedValue(undefined),
  createImportImageRecords: vi.fn().mockResolvedValue(undefined),
}))

import { collectExamData } from "../../../electron-src/lib/export/exam-archive/dataCollector"
import {
  cleanupTempDir,
  extractArchive,
} from "../../../electron-src/lib/import/exam-archive/archiveExtractor"
import { executeIdIntegrationImport } from "../../../electron-src/lib/import/merge/idIntegrationImporter"
import { performPreMatching } from "../../../electron-src/lib/import/merge/matcher"
import { createIdIntegrationConfig } from "../../helpers/testDataFactory"

const prisma = getTestPrismaClient()

describe("exportImportRoundTrip", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-rt-"))
  })

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  // E2E-1: export→import（クリーンDB）: 全データ一致
  it("E2E-1: export→importでクリーンDBに全データがインポートされる", async () => {
    // 1. テスト試験作成
    const testExam = await createFullTestExam(prisma, {
      pageCount: 2,
      cropRegionsPerPage: 2,
      studentCount: 3,
    })

    // 2. エクスポート（データ収集）
    const exportResult = await collectExamData(
      testExam.exam.id,
      testExam.user.id
    )
    expect(exportResult.success).toBe(true)

    // 3. アーカイブ作成
    const archivePath = path.join(tmpDir, "export.score")
    createTestArchive(
      exportResult.data!,
      archivePath,
      testExam.exam.id,
      testExam.exam.examName
    )

    // 4. DBクリーン
    await cleanupTestDatabase()

    // 5. 新しいユーザーを作成
    const importUser = await createTestUser()

    // 6. アーカイブ抽出
    const extractResult = await extractArchive(archivePath)
    expect(extractResult.success).toBe(true)

    // 7. プレマッチング（クリーンDBなので全てnoMatch）
    const preMatch = await performPreMatching(extractResult.data!)

    // 8. インポート
    const importResult = await executeIdIntegrationImport(
      extractResult.data!,
      preMatch,
      createIdIntegrationConfig(),
      importUser.id
    )

    expect(importResult.success).toBe(true)
    expect(importResult.examId).toBeDefined()

    // 9. データ検証
    const importedExam = await prisma.exam.findUnique({
      where: { id: importResult.examId! },
      include: {
        examPages: { include: { cropRegions: true } },
        examStudents: true,
      },
    })

    expect(importedExam).not.toBeNull()
    expect(importedExam!.examPages.length).toBe(2)
    expect(
      importedExam!.examPages.flatMap((examPage) => examPage.cropRegions).length
    ).toBe(4)
    expect(importedExam!.examStudents.length).toBe(3)

    cleanupTempDir(extractResult.data!.tempDir)
  })

  // E2E-2: export→import（同一試験存在）: マージ動作
  it("E2E-2: 同一試験が存在する場合にマージされる", async () => {
    const testExam = await createFullTestExam(prisma, {
      pageCount: 1,
      cropRegionsPerPage: 1,
      studentCount: 1,
    })

    // エクスポート
    const exportResult = await collectExamData(
      testExam.exam.id,
      testExam.user.id
    )
    expect(exportResult.success).toBe(true)

    const archivePath = path.join(tmpDir, "merge.score")
    createTestArchive(
      exportResult.data!,
      archivePath,
      testExam.exam.id,
      testExam.exam.examName
    )

    // アーカイブ抽出
    const extractResult = await extractArchive(archivePath)
    expect(extractResult.success).toBe(true)

    // プレマッチング（同一DBなので全てID一致）
    const preMatch = await performPreMatching(extractResult.data!)
    expect(preMatch.exam!.isIdMatch).toBe(true)

    // インポート（マージ）
    const importResult = await executeIdIntegrationImport(
      extractResult.data!,
      preMatch,
      createIdIntegrationConfig(),
      testExam.user.id
    )

    expect(importResult.success).toBe(true)
    expect(importResult.examId).toBe(testExam.exam.id)

    // 試験が重複していないことを確認
    const examCount = await prisma.exam.count({
      where: { id: testExam.exam.id },
    })
    expect(examCount).toBe(1)

    cleanupTempDir(extractResult.data!.tempDir)
  })

  // E2E-3: export→import（別ユーザー）: ユーザーフィルタ確認
  it("E2E-3: 別ユーザーのインポートでUserExamが適切に作成される", async () => {
    const testExam = await createFullTestExam(prisma, {
      pageCount: 1,
      cropRegionsPerPage: 1,
      studentCount: 1,
    })

    // エクスポート
    const exportResult = await collectExamData(
      testExam.exam.id,
      testExam.user.id
    )
    expect(exportResult.success).toBe(true)

    const archivePath = path.join(tmpDir, "other-user.score")
    createTestArchive(
      exportResult.data!,
      archivePath,
      testExam.exam.id,
      testExam.exam.examName
    )

    // アーカイブ抽出
    const extractResult = await extractArchive(archivePath)
    expect(extractResult.success).toBe(true)

    // 別ユーザー作成
    const otherUser = await createTestUser({
      username: `other_${Date.now()}`,
    })

    // プレマッチング
    const preMatch = await performPreMatching(extractResult.data!)

    // 別ユーザーでインポート
    const importResult = await executeIdIntegrationImport(
      extractResult.data!,
      preMatch,
      createIdIntegrationConfig(),
      otherUser.id
    )

    expect(importResult.success).toBe(true)

    // 新ユーザーのUserExamが作成されている
    const userExam = await prisma.userExam.findFirst({
      where: {
        userId: otherUser.id,
        examId: importResult.examId!,
      },
    })
    expect(userExam).not.toBeNull()

    cleanupTempDir(extractResult.data!.tempDir)
  })

  // E2E-4: export→import（画像あり）: 画像レコード検証
  it("E2E-4: 画像付き試験のエクスポートでパスが含まれる", async () => {
    const testExam = await createFullTestExam(prisma, {
      pageCount: 1,
      cropRegionsPerPage: 1,
      studentCount: 1,
      includeMasterImages: true,
      includeStudentAnswerImages: true,
    })

    const exportResult = await collectExamData(
      testExam.exam.id,
      testExam.user.id
    )

    expect(exportResult.success).toBe(true)
    expect(exportResult.data!.masterImagePaths.length).toBeGreaterThan(0)
    expect(exportResult.data!.answerSheetPaths.length).toBeGreaterThan(0)
  })

  // E2E-5: export→import（v1.4.0データ）: 全新規フィールド保持
  it("E2E-5: v1.4.0の全新規フィールドが保持される", async () => {
    const testExam = await createFullTestExam(prisma, {
      pageCount: 1,
      cropRegionsPerPage: 1,
      studentCount: 1,
      includeV140Data: true,
    })

    // エクスポート
    const exportResult = await collectExamData(
      testExam.exam.id,
      testExam.user.id
    )
    expect(exportResult.success).toBe(true)

    // v1.4.0データが含まれている
    const data = exportResult.data!
    expect(data.examData.examMarkingFormats!.length).toBeGreaterThan(0)
    expect(data.examData.examExportSettings).not.toBeNull()
    expect(data.tagsData.tags.length).toBeGreaterThan(0)
    expect(data.tagsData.tagSubtotalGroups.length).toBeGreaterThan(0)

    // アーカイブ作成→抽出
    const archivePath = path.join(tmpDir, "v140.score")
    createTestArchive(
      data,
      archivePath,
      testExam.exam.id,
      testExam.exam.examName
    )

    // DBクリーン→再インポート
    await cleanupTestDatabase()
    const importUser = await createTestUser()

    const extractResult = await extractArchive(archivePath)
    expect(extractResult.success).toBe(true)

    const preMatch = await performPreMatching(extractResult.data!)

    const importResult = await executeIdIntegrationImport(
      extractResult.data!,
      preMatch,
      createIdIntegrationConfig(),
      importUser.id
    )

    expect(importResult.success).toBe(true)

    // v1.4.0データが正しくインポートされた
    const formats = await prisma.examMarkingFormat.findMany({
      where: { examId: importResult.examId! },
    })
    expect(formats.length).toBeGreaterThan(0)

    const settings = await prisma.examExportSettings.findUnique({
      where: { examId: importResult.examId! },
    })
    expect(settings).not.toBeNull()

    const tags = await prisma.tag.findMany()
    expect(tags.length).toBeGreaterThan(0)

    cleanupTempDir(extractResult.data!.tempDir)
  })
})
