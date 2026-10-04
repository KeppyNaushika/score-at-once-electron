/**
 * 旧形式の試験アーカイブ（.score）の取り込み E2E テスト
 *
 * 旧書き出しで作った固定ファイル `exam-full.score` を、実際の DB へ取り込んで確かめる。
 * 固定ファイルの元データは createFullTestExam（2ページ×2設問・3名・採点・注釈・
 * 模範解答と答案の画像・出力設定・タグと小計グループのタグ）に、返却版・採点の覚え書き・
 * 非表示の学級・試験だけに付いたタグを足したもの。書き出した本人の利用者名は "exporter"。
 *
 * 書き出しがあった頃は「書き出す前の DB」と比べていたが、今は固定ファイルの JSON と
 * 取り込み後の DB を比べる。
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
  getSharedFilesDirectory: () => tmpDir || "/tmp/test-data",
}))

// 画像コピーのモック
vi.mock("../../../electron-src/lib/import/merge/imageImporter", () => ({
  copyImportImages: vi.fn().mockResolvedValue(undefined),
  createImportImageRecords: vi.fn().mockResolvedValue(undefined),
}))

import { cleanupTempDir } from "../../../electron-src/lib/import/exam-archive/archiveExtractor"
import { executeIdIntegrationImport } from "../../../electron-src/lib/import/merge/idIntegrationImporter"
import { performPreMatching } from "../../../electron-src/lib/import/merge/matcher"
import {
  extractLegacyExamArchive,
  seedExamFromLegacyArchive,
} from "../../helpers/legacyArchiveFixtures"
import { createIdIntegrationConfig } from "../../helpers/testDataFactory"

const prisma = getTestPrismaClient()

const EXAM_FIXTURE = "exam-full.score"

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

  // E2E-1: クリーンDBへの取り込みで、固定ファイルの行がそのまま入る
  it("E2E-1: クリーンDBに取り込むと、アーカイブの行が id のまま全て入る", async () => {
    const importUser = await createTestUser()
    const extracted = await extractLegacyExamArchive(EXAM_FIXTURE)

    // クリーンDBなので全てnoMatch
    const preMatch = await performPreMatching(extracted)
    const importResult = await executeIdIntegrationImport(
      extracted,
      preMatch,
      createIdIntegrationConfig(),
      importUser.id
    )

    expect(importResult.examId).toBe(extracted.examData.exam.id)

    const importedExam = await prisma.exam.findUnique({
      where: { id: importResult.examId },
      include: {
        examPages: { include: { cropRegions: true } },
        examStudents: true,
      },
    })
    expect(importedExam).not.toBeNull()

    const sortedIds = (rows: { id: string }[]) =>
      rows.map((row) => row.id).sort()
    expect(sortedIds(importedExam!.examPages)).toEqual(
      sortedIds(extracted.examData.examPages)
    )
    expect(
      sortedIds(
        importedExam!.examPages.flatMap((examPage) => examPage.cropRegions)
      )
    ).toEqual(sortedIds(extracted.examData.cropRegions))
    expect(sortedIds(importedExam!.examStudents)).toEqual(
      sortedIds(extracted.examData.examStudents)
    )

    // 採点は id・判定・得点まで一致する
    const importedScores = await prisma.questionScore.findMany({
      orderBy: { id: "asc" },
    })
    const archivedScores = [...extracted.scoresData.questionScores].sort(
      (left, right) => left.id.localeCompare(right.id)
    )
    expect(
      importedScores.map((questionScore) => ({
        id: questionScore.id,
        status: questionScore.status,
        partialScore: questionScore.partialScore?.toNumber() ?? null,
      }))
    ).toEqual(
      archivedScores.map((questionScore) => ({
        id: questionScore.id,
        status: questionScore.status,
        partialScore:
          questionScore.partialScore === null
            ? null
            : Number(questionScore.partialScore),
      }))
    )

    cleanupTempDir(extracted.tempDir)
  })

  // E2E-2: 同一試験が存在するDBへの取り込み: マージ動作
  it("E2E-2: 同一試験が存在する場合にマージされる", async () => {
    const exporterId = await seedExamFromLegacyArchive(EXAM_FIXTURE)
    const extracted = await extractLegacyExamArchive(EXAM_FIXTURE)
    const examId = extracted.examData.exam.id

    // プレマッチング（同じ固定ファイルから作ったDBなので全てID一致）
    const preMatch = await performPreMatching(extracted)
    expect(preMatch.exam!.isIdMatch).toBe(true)

    // インポート（マージ）
    const importResult = await executeIdIntegrationImport(
      extracted,
      preMatch,
      createIdIntegrationConfig(),
      exporterId
    )

    expect(importResult.examId).toBe(examId)

    // 試験が重複していないことを確認
    expect(await prisma.exam.count()).toBe(1)

    cleanupTempDir(extracted.tempDir)
  })

  it("E2E-2b: 模範解答を失ったページはマージ取り込みで復旧する", async () => {
    // 模範解答画像はページが持つようになったが、ページ作成時にしか書かないと
    // 「既にあるページの画像を取り込みで補う」経路が消える。画像ファイルだけが
    // コピーされて参照されないまま残り、教員には復旧手段が無くなる
    const exporterId = await seedExamFromLegacyArchive(EXAM_FIXTURE)
    const extracted = await extractLegacyExamArchive(EXAM_FIXTURE)
    const pageId = extracted.examData.examPages[0].id
    expect(extracted.examData.examPages[0].imagePath).toBeTruthy()

    // 模範解答だけを失った状態を作る（旧バージョンで作れた幽霊ページ）
    await prisma.examPage.update({
      where: { id: pageId },
      data: { imagePath: null },
    })

    const preMatch = await performPreMatching(extracted)
    await executeIdIntegrationImport(
      extracted,
      preMatch,
      createIdIntegrationConfig(),
      exporterId
    )

    const restored = await prisma.examPage.findUnique({
      where: { id: pageId },
    })
    expect(restored?.imagePath).toBeTruthy()

    cleanupTempDir(extracted.tempDir)
  })

  // E2E-3: 別ユーザーによる取り込み: UserExam の作成
  it("E2E-3: 別ユーザーのインポートでUserExamが適切に作成される", async () => {
    await seedExamFromLegacyArchive(EXAM_FIXTURE)
    const extracted = await extractLegacyExamArchive(EXAM_FIXTURE)

    // 別ユーザー作成
    const otherUser = await createTestUser({
      username: `other_${Date.now()}`,
    })

    const preMatch = await performPreMatching(extracted)

    // 別ユーザーでインポート
    const importResult = await executeIdIntegrationImport(
      extracted,
      preMatch,
      createIdIntegrationConfig(),
      otherUser.id
    )

    // 新ユーザーのUserExamが作成されている
    const userExam = await prisma.userExam.findFirst({
      where: {
        userId: otherUser.id,
        examId: importResult.examId,
      },
    })
    expect(userExam).not.toBeNull()

    cleanupTempDir(extracted.tempDir)
  })

  // E2E-5: v1.4.0 で加わった出力設定・タグが取り込まれる
  it("E2E-5: v1.4.0の全新規フィールドが保持される", async () => {
    const importUser = await createTestUser()
    const extracted = await extractLegacyExamArchive(EXAM_FIXTURE)

    // 固定ファイルが v1.4.0 のデータを持っていること（前提）
    const archivedStyles = extracted.examData.answerOverlayStyles ?? []
    expect(archivedStyles.length).toBeGreaterThan(0)
    expect(extracted.tagsData.tags.length).toBeGreaterThan(0)
    expect(extracted.tagsData.tagSubtotalGroups.length).toBeGreaterThan(0)

    const preMatch = await performPreMatching(extracted)
    const importResult = await executeIdIntegrationImport(
      extracted,
      preMatch,
      createIdIntegrationConfig(),
      importUser.id
    )

    const styles = await prisma.examAnswerOverlayStyle.findMany({
      where: { examId: importResult.examId },
    })
    expect(styles.length).toBe(archivedStyles.length)

    const tags = await prisma.tag.findMany()
    expect(tags.map((tag) => tag.name).sort()).toEqual(
      extracted.tagsData.tags.map((tag) => tag.name).sort()
    )
    expect(await prisma.tagSubtotalGroup.count()).toBe(
      extracted.tagsData.tagSubtotalGroups.length
    )

    cleanupTempDir(extracted.tempDir)
  })
})
