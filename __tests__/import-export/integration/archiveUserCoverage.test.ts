/**
 * 旧形式の試験アーカイブ（.score）が指す利用者を、取り込みが正しく扱うことの統合テスト
 *
 * 指されているのに載っていないと、取り込み側はその人が誰なのか決めようが無く、
 * **取り込んだ人へ倒すしかなくなる**（確定を下した人が取り込むたびに別人へすり替わる）。
 *
 * 取り込むのは旧書き出しで作った固定ファイル `exam-other-teachers.score`。元データは
 * createFullTestExam（1ページ×1設問・1名・採点あり）を書き出した本人（"exporter"）のほかに、
 * 確定・採点担当・返却・参加でだけ現れる教員（"decider"）と、採点行しか持たない教員
 * （"unreferenced"。書き出しの絞り込みで採点行が落ちるので、アーカイブのどこからも
 * 指されない）を足したもの。users.json には exporter と decider の2人が載っている。
 *
 * 書き出しがあった頃は「users.json が指される人を全員載せる」「パスコードを載せない」も
 * ここで書き出し側を見ていたが、書き出しが無くなったので取り込み側だけを見る。
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import { createIdIntegrationConfig } from "../../helpers/testDataFactory"
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

import { cleanupTempDir } from "../../../electron-src/lib/import/exam-archive/archiveExtractor"
import { executeIdIntegrationImport } from "../../../electron-src/lib/import/merge/idIntegrationImporter"
import { performPreMatching } from "../../../electron-src/lib/import/merge/matcher"
import { collectGraderUserIds } from "../../../electron-src/lib/import/merge/matchers/userMatcher"
import {
  createUsersFromArchive,
  extractLegacyExamArchive,
  LEGACY_EXAM_EXPORTER_USERNAME,
} from "../../helpers/legacyArchiveFixtures"

const prisma = getTestPrismaClient()

const EXAM_FIXTURE = "exam-other-teachers.score"

describe("アーカイブが指す利用者", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  it("users.json が増えても、人に判断を求める採点者は増えない", async () => {
    const extracted = await extractLegacyExamArchive(EXAM_FIXTURE)
    const archivedUserByName = new Map(
      extracted.usersData.users.map((user) => [user.username, user])
    )
    const exporter = archivedUserByName.get(LEGACY_EXAM_EXPORTER_USERNAME)!
    const decider = archivedUserByName.get("decider")!
    // 採点行が書き出しの絞り込みで落ちた教員は、どこからも指されないので載っていない
    expect(archivedUserByName.has("unreferenced")).toBe(false)

    // 書き出したパソコンへ戻す場合を模す（利用者の id まで一致する）
    await createUsersFromArchive(extracted.usersData)

    // 判断の対象は「採点層から参照されている採点者」だけ。
    // 参加者・返却の記録者・採点担当しか持たない人は入らない
    const graderUserIds = collectGraderUserIds(extracted)
    expect(graderUserIds.has(exporter.id)).toBe(true)
    expect(graderUserIds.has(decider.id)).toBe(true)

    const preMatch = await performPreMatching(extracted)
    const askedUserIds = [
      ...(preMatch.user!.byName ?? []),
      ...preMatch.user!.noMatch,
    ].map((item) => item.importId)
    // 書き出したパソコンで読むので、全員が id 一致（＝画面には何も出ない）
    expect(askedUserIds).toEqual([])
    expect(preMatch.user!.byId.length).toBe(graderUserIds.size)

    cleanupTempDir(extracted.tempDir)
  })

  it("確定を下した人は、別のパソコンへ持って行っても取り込んだ人へ倒れない", async () => {
    // 別のパソコンを模す: 取り込む人だけが居る
    const importer = await createTestUser({ username: "importer" })

    const extracted = await extractLegacyExamArchive(EXAM_FIXTURE)
    const decider = extracted.usersData.users.find(
      (user) => user.username === "decider"
    )!
    expect(extracted.scoresData.scoreDecisions?.length).toBe(1)

    const preMatch = await performPreMatching(extracted)
    const importResult = await executeIdIntegrationImport(
      extracted,
      preMatch,
      createIdIntegrationConfig(),
      importer.id
    )
    expect(importResult.examId).toBe(extracted.examData.exam.id)

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

    cleanupTempDir(extracted.tempDir)
  })
})
