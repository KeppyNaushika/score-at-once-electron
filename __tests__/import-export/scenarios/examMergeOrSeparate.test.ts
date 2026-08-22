/**
 * 同じ試験が既にあるアーカイブを、統合するか別物として取り込むかの分かれ道
 *
 * 試験IDが一致したときの扱いは人が選ぶ（`IdIntegrationConfig.exam`）。
 *
 * - separate: 既存の試験はそのまま残り、試験も配下の行も別々に並ぶ
 * - merge:    既存の試験へ入れる。**試験自身の列も updatedAt の LWW で更新する**
 *   （人が統合先を指定した以上、新しい方が正しい。古ければ何も動かさない）
 *
 * ここは「行数が合う」ではなく「どの行にぶら下がったか」「どの値になったか」まで見る。
 * 試験名だけ更新して試験日を落とす、のような列の数え落としが起きた場所だから。
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

import type { ImportAction } from "../../../src/types/importAction.types"
import {
  createTestArchive,
  verifyArchiveContents,
} from "../../helpers/testArchiveHelper"
import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createTestUser,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../../helpers/testPrismaClient"

vi.mock("electron", () => ({
  app: {
    getVersion: () => "0.5.0-test",
    getAppPath: () => process.cwd(),
  },
  dialog: { showSaveDialog: vi.fn() },
}))

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

/** 試験を書き出してアーカイブのパスを返す */
async function exportToArchive(
  examId: string,
  userId: string,
  filename: string
): Promise<string> {
  const exportResult = await collectExamData(examId, userId)
  expect(exportResult.success).toBe(true)
  const archivePath = path.join(tmpDir, filename)
  createTestArchive(exportResult.data!, archivePath, examId, "分岐テスト試験")
  return archivePath
}

/**
 * 同じDBへ取り込む（＝試験IDが一致する状況）。
 *
 * 生徒・学級・小計グループは既定の戦略のまま（同じDBなのでID一致で自動的に紐づく）。
 * 分かれ道は試験の扱いだけ。
 */
async function importIntoSameDatabase(
  archivePath: string,
  currentUserId: string,
  exam: ImportAction
): Promise<{ examId: string; warnings: string[] }> {
  const extractResult = await extractArchive(archivePath)
  expect(extractResult.success).toBe(true)
  const extracted = extractResult.data!
  const preMatch = await performPreMatching(extracted)
  expect(preMatch.exam!.isIdMatch).toBe(true)

  const importResult = await executeIdIntegrationImport(
    extracted,
    preMatch,
    createIdIntegrationConfig({ exam }),
    currentUserId
  )
  cleanupTempDir(extracted.tempDir)
  return { examId: importResult.examId, warnings: importResult.warnings }
}

describe("examMergeOrSeparate", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "exam-merge-or-separate-"))
  })

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  it("別で追加すると、既存の試験が残ったまま2つになる（子も別々に付く）", async () => {
    const testExam = await createFullTestExam(prisma, {
      pageCount: 1,
      cropRegionsPerPage: 2,
      studentCount: 2,
    })

    const archivePath = await exportToArchive(
      testExam.exam.id,
      testExam.user.id,
      "separate.score"
    )
    const archivedExam = verifyArchiveContents(archivePath).examData.exam

    const { examId } = await importIntoSameDatabase(
      archivePath,
      testExam.user.id,
      "separate"
    )

    // 既存の試験は残り、取り込んだ方は別の試験になる
    expect(examId).not.toBe(testExam.exam.id)
    const exams = await prisma.exam.findMany()
    expect(exams.length).toBe(2)
    expect(exams.find((exam) => exam.id === testExam.exam.id)!.examName).toBe(
      "テスト試験"
    )
    // 一覧で見分けられるよう名前をずらす
    const importedExam = exams.find((exam) => exam.id === examId)!
    expect(importedExam.examName).toBe("テスト試験 (2)")
    // 新しい行なので誰とも競合しない。時刻はアーカイブの値をそのまま持つ
    expect(importedExam.createdAt.toISOString()).toBe(
      new Date(archivedExam.createdAt).toISOString()
    )
    expect(importedExam.updatedAt.toISOString()).toBe(
      new Date(archivedExam.updatedAt).toISOString()
    )

    // ページ・設問は取り込んだ試験に別の行として付く（既存の行にぶら下がらない）
    const importedPages = await prisma.examPage.findMany({ where: { examId } })
    expect(importedPages.length).toBe(1)
    expect(
      await prisma.examPage.count({ where: { examId: testExam.exam.id } })
    ).toBe(1)
    const originalPageIds = new Set(testExam.pages.map((page) => page.id))
    expect(importedPages.some((page) => originalPageIds.has(page.id))).toBe(
      false
    )

    const importedRegions = await prisma.cropRegion.findMany({
      where: { examPage: { examId } },
    })
    expect(importedRegions.length).toBe(2)
    const originalRegionIds = new Set(
      testExam.cropRegions.map((cropRegion) => cropRegion.id)
    )
    expect(
      importedRegions.some((cropRegion) => originalRegionIds.has(cropRegion.id))
    ).toBe(false)

    // 受験者・採点も試験ごとに別々
    expect(await prisma.examStudent.count({ where: { examId } })).toBe(2)
    expect(
      await prisma.examStudent.count({ where: { examId: testExam.exam.id } })
    ).toBe(2)
    expect(
      await prisma.questionScore.count({
        where: { cropRegion: { examPage: { examId } } },
      })
    ).toBe(testExam.questionScores.length)
    expect(
      await prisma.questionScore.count({
        where: { cropRegion: { examPage: { examId: testExam.exam.id } } },
      })
    ).toBe(testExam.questionScores.length)

    // 生徒・学級・小計グループは試験をまたいで共有される実体なので増えない
    expect(await prisma.student.count()).toBe(2)
    expect(await prisma.classroom.count()).toBe(1)
    expect(await prisma.subtotalGroup.count()).toBe(1)
  })

  it("統合を選ぶと、アーカイブが新しければ試験自身の列が更新される", async () => {
    const testExam = await createFullTestExam(prisma, {
      pageCount: 1,
      cropRegionsPerPage: 1,
      studentCount: 1,
    })

    // 書き出す側の値（全列を既定と違う値にしておく）
    await prisma.exam.update({
      where: { id: testExam.exam.id },
      data: {
        examName: "書き出した側の試験名",
        referenceDate: new Date("2026-03-01T00:00:00.000Z"),
        description: "書き出した側の説明",
        markerCorrectionEnabled: true,
      },
    })

    const archivePath = await exportToArchive(
      testExam.exam.id,
      testExam.user.id,
      "merge-newer.score"
    )
    const archivedExam = verifyArchiveContents(archivePath).examData.exam

    // 取り込む側は別の値で、しかも更新が古い
    await prisma.exam.update({
      where: { id: testExam.exam.id },
      data: {
        examName: "このPCの試験名",
        referenceDate: new Date("2020-05-05T00:00:00.000Z"),
        description: null,
        markerCorrectionEnabled: false,
        updatedAt: new Date("2020-01-01T00:00:00.000Z"),
      },
    })

    const { examId, warnings } = await importIntoSameDatabase(
      archivePath,
      testExam.user.id,
      "merge"
    )
    expect(examId).toBe(testExam.exam.id)

    const merged = await prisma.exam.findUnique({ where: { id: examId } })
    // Exam の列は id / examName / referenceDate / description /
    // markerCorrectionEnabled / createdAt / updatedAt で全部。
    // id と createdAt を除く全列がアーカイブ側の値になる
    expect(merged!.examName).toBe("書き出した側の試験名")
    expect(merged!.referenceDate!.toISOString()).toBe(
      "2026-03-01T00:00:00.000Z"
    )
    expect(merged!.description).toBe("書き出した側の説明")
    expect(merged!.markerCorrectionEnabled).toBe(true)
    // 勝ったときの updatedAt はアーカイブ側の値（取り込み時刻ではない）
    expect(merged!.updatedAt.toISOString()).toBe(
      new Date(archivedExam.updatedAt).toISOString()
    )
    // 黙って上書きしない
    expect(
      warnings.some((warning) =>
        warning.includes("読み込んだデータの方が新しい")
      )
    ).toBe(true)

    // 同じアーカイブをもう一度取り込んでも、もう新しくないので何も動かない
    const secondImport = await importIntoSameDatabase(
      archivePath,
      testExam.user.id,
      "merge"
    )
    expect(
      secondImport.warnings.some((warning) =>
        warning.includes("読み込んだデータの方が新しい")
      )
    ).toBe(false)
    expect(await prisma.exam.count()).toBe(1)
  })

  it("統合を選んでも、アーカイブが古ければ試験自身の列は更新されない", async () => {
    const testExam = await createFullTestExam(prisma, {
      pageCount: 1,
      cropRegionsPerPage: 1,
      studentCount: 1,
    })

    await prisma.exam.update({
      where: { id: testExam.exam.id },
      data: {
        examName: "書き出した側の試験名",
        referenceDate: new Date("2026-03-01T00:00:00.000Z"),
        description: "書き出した側の説明",
        markerCorrectionEnabled: true,
      },
    })

    const archivePath = await exportToArchive(
      testExam.exam.id,
      testExam.user.id,
      "merge-older.score"
    )

    // 取り込む側の方が新しく書かれている
    const localUpdatedAt = new Date("2999-01-01T00:00:00.000Z")
    await prisma.exam.update({
      where: { id: testExam.exam.id },
      data: {
        examName: "このPCの試験名",
        referenceDate: new Date("2020-05-05T00:00:00.000Z"),
        description: null,
        markerCorrectionEnabled: false,
        updatedAt: localUpdatedAt,
      },
    })

    const { examId, warnings } = await importIntoSameDatabase(
      archivePath,
      testExam.user.id,
      "merge"
    )
    expect(examId).toBe(testExam.exam.id)

    const merged = await prisma.exam.findUnique({ where: { id: examId } })
    expect(merged!.examName).toBe("このPCの試験名")
    expect(merged!.referenceDate!.toISOString()).toBe(
      "2020-05-05T00:00:00.000Z"
    )
    expect(merged!.description).toBeNull()
    expect(merged!.markerCorrectionEnabled).toBe(false)
    expect(merged!.updatedAt.toISOString()).toBe(localUpdatedAt.toISOString())
    expect(
      warnings.some((warning) =>
        warning.includes("読み込んだデータの方が新しい")
      )
    ).toBe(false)
  })

  it("上書きを選ぶと、アーカイブが古くても置き換わり、updatedAt は取り込み時刻になる", async () => {
    const testExam = await createFullTestExam(prisma, {
      pageCount: 1,
      cropRegionsPerPage: 1,
      studentCount: 1,
    })

    await prisma.exam.update({
      where: { id: testExam.exam.id },
      data: {
        examName: "書き出した側の試験名",
        referenceDate: new Date("2026-03-01T00:00:00.000Z"),
        description: "書き出した側の説明",
        markerCorrectionEnabled: true,
      },
    })

    const archivePath = await exportToArchive(
      testExam.exam.id,
      testExam.user.id,
      "overwrite.score"
    )
    const archivedExam = verifyArchiveContents(archivePath).examData.exam

    // 取り込む側の方が後に書かれている（統合なら勝つ側）
    const localUpdatedAt = new Date("2999-01-01T00:00:00.000Z")
    const beforeImport = await prisma.exam.update({
      where: { id: testExam.exam.id },
      data: {
        examName: "このPCの試験名",
        referenceDate: new Date("2020-05-05T00:00:00.000Z"),
        description: null,
        markerCorrectionEnabled: false,
        updatedAt: localUpdatedAt,
      },
    })

    const importStartedAt = new Date()
    const { examId, warnings } = await importIntoSameDatabase(
      archivePath,
      testExam.user.id,
      "overwrite"
    )
    expect(examId).toBe(testExam.exam.id)

    // 「いまこれが正しい」と言い切る操作なので、時刻を見ずに置き換わる
    const overwritten = await prisma.exam.findUnique({ where: { id: examId } })
    expect(overwritten!.examName).toBe("書き出した側の試験名")
    expect(overwritten!.referenceDate!.toISOString()).toBe(
      "2026-03-01T00:00:00.000Z"
    )
    expect(overwritten!.description).toBe("書き出した側の説明")
    expect(overwritten!.markerCorrectionEnabled).toBe(true)

    // updatedAt は取り込み時刻。アーカイブの値でも元の値でもない
    // （保つと次の同期で相手に負け、上書きが取り消される）
    expect(overwritten!.updatedAt.getTime()).toBeGreaterThanOrEqual(
      importStartedAt.getTime()
    )
    expect(overwritten!.updatedAt.toISOString()).not.toBe(
      new Date(archivedExam.updatedAt).toISOString()
    )
    expect(overwritten!.updatedAt.toISOString()).not.toBe(
      localUpdatedAt.toISOString()
    )
    // 既にある行なので createdAt は動かさない
    expect(overwritten!.createdAt.toISOString()).toBe(
      beforeImport.createdAt.toISOString()
    )
    expect(await prisma.exam.count()).toBe(1)
    expect(
      warnings.some((warning) => warning.includes("読み込んだデータで上書き"))
    ).toBe(true)
  })

  it("別で追加しても、このパソコンの生徒の情報には触らない", async () => {
    const testExam = await createFullTestExam(prisma, {
      pageCount: 1,
      cropRegionsPerPage: 1,
      studentCount: 1,
    })
    const student = testExam.students[0]

    const archivePath = await exportToArchive(
      testExam.exam.id,
      testExam.user.id,
      "separate-keeps-student.score"
    )

    // 書き出したあとに、このパソコンで氏名を直した（＝アーカイブより新しい）
    await prisma.student.update({
      where: { id: student.id },
      data: { lastName: "このPCで直した姓" },
    })

    await importIntoSameDatabase(archivePath, testExam.user.id, "separate")

    const afterImport = await prisma.student.findUniqueOrThrow({
      where: { id: student.id },
    })
    expect(afterImport.lastName).toBe("このPCで直した姓")
    // 生徒は増えない（試験だけが2つになる）
    expect(await prisma.student.count()).toBe(1)
    expect(await prisma.exam.count()).toBe(2)
  })

  it("統合すると、このパソコンの生徒の情報もアーカイブが新しければ書き換わる", async () => {
    const testExam = await createFullTestExam(prisma, {
      pageCount: 1,
      cropRegionsPerPage: 1,
      studentCount: 1,
    })
    const student = testExam.students[0]

    const archivePath = await exportToArchive(
      testExam.exam.id,
      testExam.user.id,
      "merge-updates-student.score"
    )

    // このパソコンの側を古い時刻のまま別の値にしておく
    await prisma.student.update({
      where: { id: student.id },
      data: {
        lastName: "このPCの姓",
        updatedAt: new Date("2020-01-01T00:00:00.000Z"),
      },
    })

    await importIntoSameDatabase(archivePath, testExam.user.id, "merge")

    const afterImport = await prisma.student.findUniqueOrThrow({
      where: { id: student.id },
    })
    expect(afterImport.lastName).toBe(student.lastName)
  })

  it("別で追加した試験の受験者名簿は、1..n の連番になる", async () => {
    const testExam = await createFullTestExam(prisma, {
      pageCount: 1,
      cropRegionsPerPage: 1,
      studentCount: 3,
    })
    // 取り込み元の名簿の並びを、重複と穴のある状態にしておく
    for (const examStudent of testExam.examStudents) {
      await prisma.examStudent.update({
        where: { id: examStudent.id },
        data: { customOrder: 7 },
      })
    }

    const archivePath = await exportToArchive(
      testExam.exam.id,
      testExam.user.id,
      "separate-reorder.score"
    )

    const { examId } = await importIntoSameDatabase(
      archivePath,
      testExam.user.id,
      "separate"
    )

    const importedRoster = await prisma.examStudent.findMany({
      where: { examId },
    })
    expect(importedRoster).toHaveLength(3)
    expect(
      importedRoster
        .map((examStudent) => examStudent.customOrder)
        .sort((left, right) => (left ?? 0) - (right ?? 0))
    ).toEqual([1, 2, 3])

    // 取り込み元の名簿は触らない（行が増えていないので詰め直しも走らない）
    const originalRoster = await prisma.examStudent.findMany({
      where: { examId: testExam.exam.id },
    })
    expect(
      originalRoster.every((examStudent) => examStudent.customOrder === 7)
    ).toBe(true)
  })

  it("上書きすると、新しく作られる行の時刻も取り込み時刻になる", async () => {
    const testExam = await createFullTestExam(prisma, {
      pageCount: 1,
      cropRegionsPerPage: 1,
      studentCount: 1,
    })
    const archivePath = await exportToArchive(
      testExam.exam.id,
      testExam.user.id,
      "overwrite-new-row.score"
    )
    const archivedExam = verifyArchiveContents(archivePath).examData.exam

    // 空のDBへ「上書きする」で取り込む（＝全部が新しく作る行になる）
    await cleanupTestDatabase()
    const importUser = await createTestUser()
    const extractResult = await extractArchive(archivePath)
    const extracted = extractResult.data!
    const preMatch = await performPreMatching(extracted)
    const importStartedAt = new Date()
    const importResult = await executeIdIntegrationImport(
      extracted,
      preMatch,
      createIdIntegrationConfig({ exam: "overwrite" }),
      importUser.id
    )
    cleanupTempDir(extracted.tempDir)

    const imported = await prisma.exam.findUniqueOrThrow({
      where: { id: importResult.examId },
    })
    expect(imported.createdAt.getTime()).toBeGreaterThanOrEqual(
      importStartedAt.getTime()
    )
    expect(imported.createdAt.toISOString()).not.toBe(
      new Date(archivedExam.createdAt).toISOString()
    )
    expect(imported.updatedAt.toISOString()).toBe(
      imported.createdAt.toISOString()
    )
  })

  it("Exam の列が増えたら規則の対象漏れになる（schema と実装を突き合わせる）", () => {
    const schemaPath = path.resolve(__dirname, "../../../prisma/schema.prisma")
    const schema = fs.readFileSync(schemaPath, "utf-8")
    const examModel = /model\s+Exam\s*\{([\s\S]*?)\n\}/.exec(schema)
    expect(examModel).not.toBeNull()

    /** スカラー列だけを拾う（リレーションは大文字始まりの型・配列で書かれる） */
    const scalarFields = examModel![1]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("//"))
      .map((line) => line.split(/\s+/))
      .filter(
        ([, fieldType]) =>
          fieldType !== undefined &&
          /^(String|Int|Float|Boolean|DateTime|Decimal|Bytes|Json)\??$/.test(
            fieldType
          )
      )
      .map(([fieldName]) => fieldName)

    // 列が増減したらここが落ちる。増えた列を LWW の対象にするか決めること
    expect(scalarFields.sort()).toEqual(
      [
        "createdAt",
        "description",
        "referenceDate",
        "examName",
        "id",
        "markerCorrectionEnabled",
        "updatedAt",
      ].sort()
    )

    // id（同定そのもの）と createdAt（生まれた時刻）以外は全て LWW で書き換える
    const importExamCorePath = path.resolve(
      __dirname,
      "../../../electron-src/lib/import/merge/importExamCore.ts"
    )
    const importExamCore = fs.readFileSync(importExamCorePath, "utf-8")
    const functionStart = importExamCore.indexOf(
      "async function applyExamColumns"
    )
    expect(functionStart).toBeGreaterThan(-1)
    const functionBody = importExamCore.slice(
      functionStart,
      importExamCore.indexOf("\n}\n", functionStart)
    )

    // 探すのは `update` へ渡す `data` の中だけ。関数の本文ぜんぶを見ると
    // `exam.updatedAt` のような**読み出し**まで書き込みと数えてしまう
    const dataStart = functionBody.indexOf("data: {")
    expect(dataStart).toBeGreaterThan(-1)
    const dataBlock = functionBody.slice(
      dataStart,
      functionBody.indexOf("\n    },", dataStart)
    )

    for (const fieldName of scalarFields) {
      if (fieldName === "id" || fieldName === "createdAt") continue
      // `updatedAt` は算出した変数をそのまま渡す省略記法なので `名前:` では拾えない
      expect(dataBlock).toMatch(
        new RegExp(`(^|[{\\s])${fieldName}\\s*[:,]`, "m")
      )
    }
  })
})
