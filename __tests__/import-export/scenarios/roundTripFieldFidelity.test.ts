/**
 * Export→Import で「アーカイブには載っているのにコードが落としていた」行と列の回帰テスト
 *
 * 中身の入った試験を書き出して空DBへ取り込み、行ごと・列ごとに突き合わせて見つかった
 * 3件（ReturnSnapshot が丸ごと消える／Exam.markerCorrectionEnabled が書かれない／
 * ExamTag と Tag が消える）を、往復で守る。
 *
 * どれも警告すら出ずに消えていた。**テストが無かったことが原因なので、
 * ここは「行数が一致する」ではなく「値まで一致する」まで見る。**
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
  createTestArchive(exportResult.data!, archivePath, examId, "往復テスト試験")
  return archivePath
}

/** アーカイブを取り込み、警告を返す */
async function importArchive(
  archivePath: string,
  currentUserId: string
): Promise<{ examId: string; warnings: string[] }> {
  const extractResult = await extractArchive(archivePath)
  expect(extractResult.success).toBe(true)
  const extracted = extractResult.data!
  const preMatch = await performPreMatching(extracted)
  const importResult = await executeIdIntegrationImport(
    extracted,
    preMatch,
    createIdIntegrationConfig({
      student: { strategy: "all_new", decisions: [] },
      classroom: { strategy: "all_new", decisions: [] },
      subtotalGroup: { strategy: "all_new", decisions: [] },
    }),
    currentUserId
  )
  cleanupTempDir(extracted.tempDir)
  return { examId: importResult.examId, warnings: importResult.warnings }
}

describe("roundTripFieldFidelity", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rt-fidelity-"))
  })

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  it("Exam.markerCorrectionEnabled が往復で保たれる", async () => {
    const testExam = await createFullTestExam(prisma, {
      pageCount: 1,
      cropRegionsPerPage: 1,
      studentCount: 1,
    })
    await prisma.exam.update({
      where: { id: testExam.exam.id },
      data: { markerCorrectionEnabled: true },
    })

    const archivePath = await exportToArchive(
      testExam.exam.id,
      testExam.user.id,
      "marker.score"
    )

    await cleanupTestDatabase()
    const importUser = await createTestUser()
    const { examId } = await importArchive(archivePath, importUser.id)

    const imported = await prisma.exam.findUnique({ where: { id: examId } })
    expect(imported!.markerCorrectionEnabled).toBe(true)
  })

  it("ExamTag と Tag が往復で保たれる（TagSubtotalGroup が1行も無くても）", async () => {
    // 実際に起きていた形。TagSubtotalGroup が0行なので、タグ本体を小計グループ経由でしか
    // 集めていなかった頃はここが常に空になり、タグ付けが警告なしに全部消えていた
    const testExam = await createFullTestExam(prisma, {
      pageCount: 1,
      cropRegionsPerPage: 1,
      studentCount: 1,
    })
    const tag = await prisma.tag.create({
      data: { name: "数学　定期テスト", order: 3, color: "#3b82f6" },
    })
    await prisma.examTag.create({
      data: { examId: testExam.exam.id, tagId: tag.id },
    })
    expect(await prisma.tagSubtotalGroup.count()).toBe(0)

    const exportResult = await collectExamData(
      testExam.exam.id,
      testExam.user.id
    )
    // 書き出し側が examTags の指す先の Tag を集めていること
    expect(
      exportResult.data!.tagsData.tags.map((archivedTag) => archivedTag.id)
    ).toEqual([tag.id])

    const archivePath = path.join(tmpDir, "tags.score")
    createTestArchive(
      exportResult.data!,
      archivePath,
      testExam.exam.id,
      "往復テスト試験"
    )

    await cleanupTestDatabase()
    const importUser = await createTestUser()
    const { examId, warnings } = await importArchive(archivePath, importUser.id)

    const importedExamTags = await prisma.examTag.findMany({
      where: { examId },
      include: { tag: true },
    })
    expect(importedExamTags.length).toBe(1)
    // 表示順と色もタグの持ち物なので落とさない
    expect(importedExamTags[0].tag.name).toBe("数学　定期テスト")
    expect(importedExamTags[0].tag.order).toBe(3)
    expect(importedExamTags[0].tag.color).toBe("#3b82f6")
    expect(warnings.some((warning) => warning.includes("タグ付け"))).toBe(false)
  })

  it("タグ本体を欠くアーカイブは、タグ付けを黙って捨てず警告を出す", async () => {
    const testExam = await createFullTestExam(prisma, {
      pageCount: 1,
      cropRegionsPerPage: 1,
      studentCount: 1,
    })
    const tag = await prisma.tag.create({ data: { name: "本体を落とすタグ" } })
    await prisma.examTag.create({
      data: { examId: testExam.exam.id, tagId: tag.id },
    })

    const exportResult = await collectExamData(
      testExam.exam.id,
      testExam.user.id
    )
    // 書き出し側がタグ本体を集め損ねていた頃のアーカイブを模す
    exportResult.data!.tagsData.tags = []

    const archivePath = path.join(tmpDir, "orphan-tags.score")
    createTestArchive(
      exportResult.data!,
      archivePath,
      testExam.exam.id,
      "往復テスト試験"
    )

    await cleanupTestDatabase()
    const importUser = await createTestUser()
    const { examId, warnings } = await importArchive(archivePath, importUser.id)

    expect(await prisma.examTag.count({ where: { examId } })).toBe(0)
    expect(warnings.some((warning) => warning.includes("タグ付け"))).toBe(true)
  })

  it("ReturnSnapshot が往復で保たれ、記録者は取り込む人へ倒さない", async () => {
    const testExam = await createFullTestExam(prisma, {
      pageCount: 1,
      cropRegionsPerPage: 1,
      studentCount: 2,
    })
    const [firstExamStudent, secondExamStudent] = testExam.examStudents
    const capturedAt = new Date("2026-06-19T05:24:52.000Z")
    await prisma.returnSnapshot.create({
      data: {
        examStudentId: firstExamStudent.id,
        scoresJson: '{"v":1,"scores":[],"annotations":[]}',
        totalScore: 8,
        capturedByUserId: testExam.user.id,
        capturedAt,
      },
    })
    await prisma.returnSnapshot.create({
      data: {
        examStudentId: secondExamStudent.id,
        scoresJson: '{"v":1,"scores":[],"annotations":[]}',
        totalScore: null,
        capturedByUserId: null,
        capturedAt,
      },
    })

    const archivePath = await exportToArchive(
      testExam.exam.id,
      testExam.user.id,
      "snapshots.score"
    )

    await cleanupTestDatabase()
    const importUser = await createTestUser()
    const { examId, warnings } = await importArchive(archivePath, importUser.id)

    const imported = await prisma.returnSnapshot.findMany({
      where: { examStudent: { examId } },
      orderBy: { id: "asc" },
    })
    expect(imported.length).toBe(2)
    for (const snapshot of imported) {
      expect(snapshot.scoresJson).toBe('{"v":1,"scores":[],"annotations":[]}')
      expect(snapshot.capturedAt.toISOString()).toBe(capturedAt.toISOString())
      // 返却したのは取り込んだ人ではない
      expect(snapshot.capturedByUserId).not.toBe(importUser.id)
    }
    const capturedByExamStudentId = new Map(
      imported.map((snapshot) => [
        snapshot.examStudentId,
        snapshot.capturedByUserId,
      ])
    )
    // 書き出し元の利用者は「採点者」としてこのDBに作られる（採点行が親を失わないため）ので、
    // 返却の記録者もその人のまま残る
    expect(capturedByExamStudentId.get(firstExamStudent.id)).toBe(
      testExam.user.id
    )
    // 元から記録者なしだったものは、なしのまま
    expect(capturedByExamStudentId.get(secondExamStudent.id)).toBeNull()
    const totalScoreByExamStudentId = new Map(
      imported.map((snapshot) => [
        snapshot.examStudentId,
        snapshot.totalScore?.toNumber() ?? null,
      ])
    )
    expect(totalScoreByExamStudentId.get(firstExamStudent.id)).toBe(8)
    expect(totalScoreByExamStudentId.get(secondExamStudent.id)).toBeNull()
    // 記録者は解決できたので「記録者なし」の警告は出ない。代わりに採点者を
    // 新しく作ったことが伝わる
    expect(warnings.some((warning) => warning.includes("記録者なし"))).toBe(
      false
    )
    expect(
      warnings.some((warning) => warning.includes("新しく作りました"))
    ).toBe(true)
  })

  it("ReturnSnapshot の記録者は、同じ利用者が取り込み先に居れば引き継ぐ", async () => {
    const testExam = await createFullTestExam(prisma, {
      pageCount: 1,
      cropRegionsPerPage: 1,
      studentCount: 1,
    })
    const capturerUserId = testExam.user.id
    await prisma.returnSnapshot.create({
      data: {
        examStudentId: testExam.examStudents[0].id,
        scoresJson: "{}",
        capturedByUserId: capturerUserId,
      },
    })

    const archivePath = await exportToArchive(
      testExam.exam.id,
      capturerUserId,
      "snapshots-same-user.score"
    )

    await cleanupTestDatabase()
    // 同じパソコンへ戻す場合を模す（利用者の id まで一致する）
    const importUser = await createTestUser({ id: capturerUserId })
    const { examId, warnings } = await importArchive(archivePath, importUser.id)

    const imported = await prisma.returnSnapshot.findMany({
      where: { examStudent: { examId } },
    })
    expect(imported.length).toBe(1)
    expect(imported[0].capturedByUserId).toBe(capturerUserId)
    expect(warnings.some((warning) => warning.includes("記録者なし"))).toBe(
      false
    )
  })

  it("同じアーカイブを二度取り込んでも ReturnSnapshot と ExamTag は増えない", async () => {
    const testExam = await createFullTestExam(prisma, {
      pageCount: 1,
      cropRegionsPerPage: 1,
      studentCount: 1,
    })
    const tag = await prisma.tag.create({ data: { name: "二度取り込みタグ" } })
    await prisma.examTag.create({
      data: { examId: testExam.exam.id, tagId: tag.id },
    })
    await prisma.returnSnapshot.create({
      data: {
        examStudentId: testExam.examStudents[0].id,
        scoresJson: "{}",
      },
    })

    const archivePath = await exportToArchive(
      testExam.exam.id,
      testExam.user.id,
      "twice.score"
    )

    await cleanupTestDatabase()
    const importUser = await createTestUser()
    await importArchive(archivePath, importUser.id)
    const { examId } = await importArchive(archivePath, importUser.id)

    expect(
      await prisma.returnSnapshot.count({ where: { examStudent: { examId } } })
    ).toBe(1)
    expect(await prisma.examTag.count({ where: { examId } })).toBe(1)
    expect(await prisma.tag.count()).toBe(1)
  })

  it("採点の覚え書き（QuestionScore.comment）が往復で保たれる", async () => {
    const testExam = await createFullTestExam(prisma, {
      pageCount: 1,
      cropRegionsPerPage: 1,
      studentCount: 2,
    })

    // 1件だけ覚え書きを書く。もう1件は空のまま（＝書いていない側も往復で壊れない）
    const [firstScore, secondScore] = await prisma.questionScore.findMany({
      orderBy: { id: "asc" },
    })
    await prisma.questionScore.update({
      where: { id: firstScore.id },
      data: { comment: "誤字は減点しない方針なので3点\n（2行目も保つ）" },
    })

    const archivePath = await exportToArchive(
      testExam.exam.id,
      testExam.user.id,
      "score-comment.score"
    )

    await cleanupTestDatabase()
    const importUser = await createTestUser()
    await importArchive(archivePath, importUser.id)

    const imported = await prisma.questionScore.findMany({
      orderBy: { id: "asc" },
    })
    expect(imported).toHaveLength(2)
    expect(
      imported.find((questionScore) => questionScore.id === firstScore.id)!
        .comment
    ).toBe("誤字は減点しない方針なので3点\n（2行目も保つ）")
    expect(
      imported.find((questionScore) => questionScore.id === secondScore.id)!
        .comment
    ).toBe("")
  })

  it("非表示の学級は往復しても非表示のまま", async () => {
    const testExam = await createFullTestExam(prisma, {
      pageCount: 1,
      cropRegionsPerPage: 1,
      studentCount: 1,
    })
    await prisma.classroom.update({
      where: { id: testExam.classroom.id },
      data: { isVisible: false },
    })

    const archivePath = await exportToArchive(
      testExam.exam.id,
      testExam.user.id,
      "hidden-classroom.score"
    )

    await cleanupTestDatabase()
    const importUser = await createTestUser()
    await importArchive(archivePath, importUser.id)

    const imported = await prisma.classroom.findMany()
    expect(imported.length).toBe(1)
    expect(imported[0].isVisible).toBe(false)
  })
})
