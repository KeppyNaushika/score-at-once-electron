/**
 * 「アーカイブが指す利用者は、全員 users.json に居る」ことの統合テスト
 *
 * 指されているのに載っていないと、取り込み側はその人が誰なのか決めようが無く、
 * **取り込んだ人へ倒すしかなくなる**（確定を下した人が取り込むたびに別人へすり替わる）。
 *
 * 突き合わせは**行ごとに手で列挙しない。** 書き出した中身を文字列にして、このPCの
 * 利用者の id が1つでも出てくるならその人は users.json に居なければならない、と見る。
 * 手で列挙すると、次に利用者を指す列が増えたときに黙って漏れる。
 */

import * as crypto from "crypto"
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

import { createIdIntegrationConfig } from "../../helpers/testDataFactory"
import {
  createFullTestExam,
  type FullTestExam,
} from "../../helpers/testExamBuilder"
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

vi.mock("../../../electron-src/lib/dataManager", () => ({
  getDataDirectory: () => "/tmp/test-data",
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
import { collectGraderUserIds } from "../../../electron-src/lib/import/merge/matchers/userMatcher"
import { createTestArchive } from "../../helpers/testArchiveHelper"

const prisma = getTestPrismaClient()

let testDir: string

/**
 * 書き出した本人（A）のほかに、確定・採点担当・返却・参加でだけ現れる教員（B）と、
 * 採点行しか持たない教員（C）を足す。C の採点行は書き出しの絞り込みで落ちるので、
 * **C はアーカイブのどこからも指されない**（＝users.json に載らないのが正しい）。
 */
async function addOtherTeachers(testExam: FullTestExam): Promise<{
  decider: { id: string; username: string }
  unreferenced: { id: string; username: string }
}> {
  const decider = await createTestUser({ username: "decider" })
  const unreferenced = await createTestUser({ username: "unreferenced" })

  const cropRegionId = testExam.cropRegions[0].id
  const examStudentId = testExam.examStudents[0].id

  await prisma.scoreDecision.create({
    data: {
      id: crypto.randomUUID(),
      cropRegionId,
      examStudentId,
      verdict: "correct",
      score: 10,
      decidedByUserId: decider.id,
    },
  })
  await prisma.cropRegionAssignment.create({
    data: { id: crypto.randomUUID(), cropRegionId, userId: decider.id },
  })
  await prisma.returnSnapshot.create({
    data: {
      id: crypto.randomUUID(),
      examStudentId,
      scoresJson: "{}",
      capturedByUserId: decider.id,
    },
  })
  await prisma.userExam.create({
    data: {
      id: crypto.randomUUID(),
      userId: decider.id,
      examId: testExam.exam.id,
      role: "GRADER",
    },
  })

  // 書き出されない採点行（ログイン中の利用者で絞られる）
  await prisma.questionScore.create({
    data: {
      id: crypto.randomUUID(),
      cropRegionId,
      examStudentId,
      userId: unreferenced.id,
      status: "incorrect",
      partialScore: 0,
    },
  })

  return { decider, unreferenced }
}

describe("アーカイブが指す利用者", () => {
  let testExam: FullTestExam

  beforeEach(async () => {
    await cleanupTestDatabase()
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "archive-users-"))
    testExam = await createFullTestExam(prisma, {
      pageCount: 1,
      cropRegionsPerPage: 1,
      studentCount: 1,
      includeScores: true,
    })
  })

  afterEach(() => {
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  it("書き出した中身に id が出てくる利用者は、全員 users.json に居る", async () => {
    const { decider, unreferenced } = await addOtherTeachers(testExam)

    const result = await collectExamData(testExam.exam.id, testExam.user.id)
    expect(result.success).toBe(true)
    const data = result.data!

    // users.json 以外の全セクションを文字列にして、id の出現を探す
    const archiveText = JSON.stringify({
      examData: data.examData,
      studentsData: data.studentsData,
      classesData: data.classesData,
      subtotalsData: data.subtotalsData,
      scoresData: data.scoresData,
      tagsData: data.tagsData,
    })

    const archivedUserIds = new Set(data.usersData.users.map((user) => user.id))
    const allUsers = await prisma.user.findMany()
    const pointedAtUsers = allUsers.filter((user) =>
      archiveText.includes(user.id)
    )

    // 指されている人が1人も居ないなら、この検査は何も見ていないことになる
    expect(pointedAtUsers.length).toBeGreaterThan(0)
    for (const pointedAtUser of pointedAtUsers) {
      expect(archivedUserIds.has(pointedAtUser.id)).toBe(true)
    }

    // 採点担当は username で持ち回るので、名前の側でも突き合わせる
    const archivedUsernames = new Set(
      data.usersData.users.map((user) => user.username)
    )
    expect(data.scoresData.cropRegionAssignments?.length).toBeGreaterThan(0)
    for (const assignment of data.scoresData.cropRegionAssignments ?? []) {
      expect(archivedUsernames.has(assignment.username)).toBe(true)
    }

    // 確定・担当・返却・参加でしか出てこない教員も載る
    expect(archivedUserIds.has(decider.id)).toBe(true)
    // 採点行が絞りで落ちた教員は、どこからも指されていないので載せない
    expect(archivedUserIds.has(unreferenced.id)).toBe(false)
  })

  it("users.json が増えても、人に判断を求める採点者は増えない", async () => {
    const { decider } = await addOtherTeachers(testExam)

    const result = await collectExamData(testExam.exam.id, testExam.user.id)
    const data = result.data!

    const archivePath = path.join(testDir, "users.score")
    createTestArchive(
      data,
      archivePath,
      testExam.exam.id,
      testExam.exam.examName
    )
    const extracted = await extractArchive(archivePath)
    expect(extracted.success).toBe(true)

    // 判断の対象は「採点層から参照されている採点者」だけ。
    // 参加者・返却の記録者・採点担当しか持たない人は入らない
    const graderUserIds = collectGraderUserIds(extracted.data!)
    expect(graderUserIds.has(testExam.user.id)).toBe(true)
    expect(graderUserIds.has(decider.id)).toBe(true)

    const preMatch = await performPreMatching(extracted.data!)
    const askedUserIds = [
      ...(preMatch.user!.byName ?? []),
      ...preMatch.user!.noMatch,
    ].map((item) => item.importId)
    // このPCで書き出したものをこのPCで読むので、全員が id 一致（＝画面には何も出ない）
    expect(askedUserIds).toEqual([])
    expect(preMatch.user!.byId.length).toBe(graderUserIds.size)

    cleanupTempDir(extracted.data!.tempDir)
  })

  it("確定を下した人は、別のパソコンへ持って行っても取り込んだ人へ倒れない", async () => {
    const { decider } = await addOtherTeachers(testExam)
    const exporterId = testExam.user.id

    const result = await collectExamData(testExam.exam.id, exporterId)
    const data = result.data!
    expect(data.scoresData.scoreDecisions?.length).toBe(1)

    const archivePath = path.join(testDir, "decision.score")
    createTestArchive(
      data,
      archivePath,
      testExam.exam.id,
      testExam.exam.examName
    )
    const archiveBuffer = fs.readFileSync(archivePath)

    // 別のパソコンを模す: このPCの中身を全部消し、取り込む人だけを作る
    await cleanupTestDatabase()
    const importer = await createTestUser({ username: "importer" })
    const otherPcArchivePath = path.join(testDir, "decision-other-pc.score")
    fs.writeFileSync(otherPcArchivePath, archiveBuffer)

    const extracted = await extractArchive(otherPcArchivePath)
    expect(extracted.success).toBe(true)
    const preMatch = await performPreMatching(extracted.data!)

    const importResult = await executeIdIntegrationImport(
      extracted.data!,
      preMatch,
      createIdIntegrationConfig(),
      importer.id
    )
    expect(importResult.examId).toBe(testExam.exam.id)

    const importedDecisions = await prisma.scoreDecision.findMany()
    expect(importedDecisions).toHaveLength(1)
    // 確定した人はアーカイブに書かれたその人のまま（取り込んだ人ではない）
    expect(importedDecisions[0].decidedByUserId).toBe(decider.id)
    expect(importedDecisions[0].decidedByUserId).not.toBe(importer.id)

    const recreatedDecider = await prisma.user.findUnique({
      where: { id: decider.id },
    })
    expect(recreatedDecider).not.toBeNull()
    expect(recreatedDecider!.username).toBe("decider")
    // パスコードは持ち回らない
    expect(recreatedDecider!.passcode).toBeNull()

    cleanupTempDir(extracted.data!.tempDir)
  })

  it("users.json にパスコードは載らない", async () => {
    await prisma.user.update({
      where: { id: testExam.user.id },
      data: { passcode: "1234", passcodeType: "pin" },
    })

    const result = await collectExamData(testExam.exam.id, testExam.user.id)
    const usersJson = JSON.stringify(result.data!.usersData)

    expect(usersJson).not.toContain("1234")
    expect(usersJson).not.toContain("passcode")
  })
})
