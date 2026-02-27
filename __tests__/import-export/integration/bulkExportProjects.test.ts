/**
 * 一括エクスポート (executeBulkExport) の統合テスト
 *
 * テスト対象: electron-src/ipc-handlers/archiveHandlers.ts の executeBulkExport
 * 実際のSQLiteテスト用DBを使用し、複数プロジェクトの順次エクスポートを検証する
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

import {
  cleanupTestDatabase,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../../helpers/testPrismaClient"
import { createFullTestProject } from "../../helpers/testProjectBuilder"

// electronモック
vi.mock("electron", () => ({
  app: {
    getVersion: () => "0.5.0-test",
    getAppPath: () => process.cwd(),
  },
  dialog: {
    showSaveDialog: vi.fn(),
    showOpenDialog: vi.fn(),
  },
  ipcMain: { handle: vi.fn() },
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

import { executeBulkExport } from "../../../electron-src/ipc-handlers/archiveHandlers"

const prisma = getTestPrismaClient()

describe("executeBulkExport", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bulk-export-"))
  })

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  // BE-1: 複数プロジェクトの一括エクスポートが成功する
  it("BE-1: 複数プロジェクトを順次エクスポートし全て成功する", async () => {
    // 2つのプロジェクトを作成
    const project1 = await createFullTestProject(prisma, {
      examName: "数学テスト",
      pageCount: 1,
      cropRegionsPerPage: 1,
      studentCount: 1,
    })
    const project2 = await createFullTestProject(prisma, {
      examName: "英語テスト",
      pageCount: 1,
      cropRegionsPerPage: 1,
      studentCount: 1,
    })

    const outputDir = path.join(tmpDir, "output")
    fs.mkdirSync(outputDir, { recursive: true })

    const result = await executeBulkExport(
      [project1.project.id, project2.project.id],
      project1.user.id,
      outputDir
    )

    expect(result.success).toBe(true)
    expect(result.results).toHaveLength(2)
    expect(result.results[0].success).toBe(true)
    expect(result.results[0].projectName).toBe("数学テスト")
    expect(result.results[1].success).toBe(true)
    expect(result.results[1].projectName).toBe("英語テスト")
    expect(result.outputDirectory).toBe(outputDir)

    // .scoreファイルが実際に作成されている
    const files = fs.readdirSync(outputDir)
    const scoreFiles = files.filter((f) => f.endsWith(".score"))
    expect(scoreFiles).toHaveLength(2)
    expect(scoreFiles.some((f) => f.startsWith("数学テスト-"))).toBe(true)
    expect(scoreFiles.some((f) => f.startsWith("英語テスト-"))).toBe(true)
  })

  // BE-2: 存在しないプロジェクトIDが含まれる場合、そのプロジェクトのみ失敗し他は続行する
  it("BE-2: 存在しないプロジェクトIDは失敗し残りは続行する", async () => {
    const project1 = await createFullTestProject(prisma, {
      examName: "成功テスト",
      pageCount: 1,
      cropRegionsPerPage: 1,
      studentCount: 1,
    })

    const outputDir = path.join(tmpDir, "output")
    fs.mkdirSync(outputDir, { recursive: true })

    const result = await executeBulkExport(
      ["non-existent-id", project1.project.id],
      project1.user.id,
      outputDir
    )

    // 1つ成功しているのでsuccess=true
    expect(result.success).toBe(true)
    expect(result.results).toHaveLength(2)

    // 最初のプロジェクトは失敗
    expect(result.results[0].success).toBe(false)
    expect(result.results[0].projectId).toBe("non-existent-id")
    expect(result.results[0].error).toContain("プロジェクトが見つかりません")

    // 2番目のプロジェクトは成功
    expect(result.results[1].success).toBe(true)
    expect(result.results[1].projectName).toBe("成功テスト")

    // 成功した分のファイルのみ作成される
    const scoreFiles = fs
      .readdirSync(outputDir)
      .filter((f) => f.endsWith(".score"))
    expect(scoreFiles).toHaveLength(1)
  })

  // BE-3: 全て失敗した場合success=false
  it("BE-3: 全プロジェクトが失敗した場合はsuccess=falseになる", async () => {
    const outputDir = path.join(tmpDir, "output")
    fs.mkdirSync(outputDir, { recursive: true })

    const result = await executeBulkExport(
      ["non-existent-1", "non-existent-2"],
      "dummy-user-id",
      outputDir
    )

    expect(result.success).toBe(false)
    expect(result.results).toHaveLength(2)
    expect(result.results.every((r) => !r.success)).toBe(true)
  })

  // BE-4: 単一プロジェクトの一括エクスポート
  it("BE-4: 単一プロジェクトでも正常に動作する", async () => {
    const project = await createFullTestProject(prisma, {
      examName: "単一テスト",
      pageCount: 1,
      cropRegionsPerPage: 1,
      studentCount: 1,
    })

    const outputDir = path.join(tmpDir, "output")
    fs.mkdirSync(outputDir, { recursive: true })

    const result = await executeBulkExport(
      [project.project.id],
      project.user.id,
      outputDir
    )

    expect(result.success).toBe(true)
    expect(result.results).toHaveLength(1)
    expect(result.results[0].success).toBe(true)
    expect(result.results[0].outputPath).toBeDefined()
    expect(result.results[0].outputPath!).toContain("単一テスト-")
    expect(result.results[0].outputPath!).toContain(".score")
  })

  // BE-5: 空の配列を渡した場合
  it("BE-5: 空のプロジェクト配列ではsuccess=falseで結果も空", async () => {
    const outputDir = path.join(tmpDir, "output")
    fs.mkdirSync(outputDir, { recursive: true })

    const result = await executeBulkExport([], "dummy-user-id", outputDir)

    // results.some(r => r.success)がfalseを返す（空配列）
    expect(result.success).toBe(false)
    expect(result.results).toHaveLength(0)
  })

  // BE-6: 出力ファイルパスが各プロジェクトで正しいディレクトリ内に作成される
  it("BE-6: 出力パスが指定ディレクトリ内の正しいファイル名で構成される", async () => {
    const project = await createFullTestProject(prisma, {
      examName: "パス確認テスト",
      pageCount: 1,
      cropRegionsPerPage: 1,
      studentCount: 1,
    })

    const outputDir = path.join(tmpDir, "deep", "nested", "output")
    fs.mkdirSync(outputDir, { recursive: true })

    const result = await executeBulkExport(
      [project.project.id],
      project.user.id,
      outputDir
    )

    expect(result.success).toBe(true)
    const outputPath = result.results[0].outputPath!

    // 指定ディレクトリ内にある
    expect(path.dirname(outputPath)).toBe(outputDir)

    // ファイル名が正しい形式
    const fileName = path.basename(outputPath)
    expect(fileName).toMatch(
      /^パス確認テスト-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.score$/
    )
  })

  // BE-7: エクスポートされた.scoreファイルが有効なアーカイブである
  it("BE-7: 生成された.scoreファイルが有効なZIPアーカイブである", async () => {
    const project = await createFullTestProject(prisma, {
      examName: "アーカイブ検証",
      pageCount: 1,
      cropRegionsPerPage: 1,
      studentCount: 1,
    })

    const outputDir = path.join(tmpDir, "output")
    fs.mkdirSync(outputDir, { recursive: true })

    const result = await executeBulkExport(
      [project.project.id],
      project.user.id,
      outputDir
    )

    expect(result.success).toBe(true)

    // ファイルが存在し、サイズ > 0
    const outputPath = result.results[0].outputPath!
    expect(fs.existsSync(outputPath)).toBe(true)
    const stat = fs.statSync(outputPath)
    expect(stat.size).toBeGreaterThan(0)

    // ZIPマジックナンバーの確認 (PK\x03\x04)
    const fd = fs.openSync(outputPath, "r")
    const buf = Buffer.alloc(4)
    fs.readSync(fd, buf, 0, 4, 0)
    fs.closeSync(fd)
    expect(buf[0]).toBe(0x50) // P
    expect(buf[1]).toBe(0x4b) // K
    expect(buf[2]).toBe(0x03)
    expect(buf[3]).toBe(0x04)
  })
})
