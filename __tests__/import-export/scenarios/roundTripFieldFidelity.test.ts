/**
 * 旧形式の試験アーカイブを取り込むとき「アーカイブには載っているのにコードが落としていた」
 * 行と列の回帰テスト
 *
 * 中身の入った試験を書き出して空DBへ取り込み、行ごと・列ごとに突き合わせて見つかった
 * 3件（ReturnSnapshot が丸ごと消える／Exam.markerCorrectionEnabled が書かれない／
 * ExamTag と Tag が消える）を守る。
 *
 * どれも警告すら出ずに消えていた。**テストが無かったことが原因なので、
 * ここは「行数が一致する」ではなく「値まで一致する」まで見る。**
 *
 * 取り込むのは旧書き出しで作った固定ファイル `exam-full.score`。元データは
 * createFullTestExam（2ページ×2設問・3名・採点ほか）に、次を足して書き出したもの:
 * - Exam.markerCorrectionEnabled = true
 * - 試験だけに付いたタグ（名前は EXAM_ONLY_TAG_NAME・表示順3・色 #3b82f6。小計グループには付けない）
 * - 返却版2件（1件目は書き出した本人が記録・合計8点、2件目は記録者なし・合計なし）
 * - 採点1件の覚え書き（2行）
 * - 学級を非表示に
 * 書き出しがあった頃は書き出す前の DB と比べていたが、今は固定ファイルの JSON と比べる。
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
  getSharedFilesDirectory: () => tmpDir || "/tmp/test-data",
}))

vi.mock("../../../electron-src/lib/import/merge/imageImporter", () => ({
  copyImportImages: vi.fn().mockResolvedValue(undefined),
  createImportImageRecords: vi.fn().mockResolvedValue(undefined),
}))

import {
  cleanupTempDir,
  type ExtractedArchiveData,
} from "../../../electron-src/lib/import/exam-archive/archiveExtractor"
import { executeIdIntegrationImport } from "../../../electron-src/lib/import/merge/idIntegrationImporter"
import { performPreMatching } from "../../../electron-src/lib/import/merge/matcher"
import {
  extractLegacyExamArchive,
  LEGACY_EXAM_EXPORTER_USERNAME,
} from "../../helpers/legacyArchiveFixtures"
import { createIdIntegrationConfig } from "../../helpers/testDataFactory"

const prisma = getTestPrismaClient()

const EXAM_FIXTURE = "exam-full.score"

/** 固定ファイルの中身（期待値を組むために読むだけ。展開した一時ディレクトリは捨てる） */
async function readFixtureContents(): Promise<ExtractedArchiveData> {
  const extracted = await extractLegacyExamArchive(EXAM_FIXTURE)
  cleanupTempDir(extracted.tempDir)
  return extracted
}

/**
 * 固定ファイルを取り込み、警告を返す。
 * `prepare` は取り込む前にアーカイブの中身を書き換えたいときに使う。
 */
async function importArchive(
  currentUserId: string,
  prepare?: (extracted: ExtractedArchiveData) => void
): Promise<{ examId: string; warnings: string[] }> {
  const extracted = await extractLegacyExamArchive(EXAM_FIXTURE)
  prepare?.(extracted)
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

/** 試験だけに付いたタグ（固定ファイルを作るときに付けた） */
const EXAM_ONLY_TAG_NAME = "数学　定期テスト"

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

  it("Exam.markerCorrectionEnabled が取り込みで保たれる", async () => {
    const archive = await readFixtureContents()
    expect(archive.examData.exam.markerCorrectionEnabled).toBe(true)

    const importUser = await createTestUser()
    const { examId } = await importArchive(importUser.id)

    const imported = await prisma.exam.findUnique({ where: { id: examId } })
    expect(imported!.markerCorrectionEnabled).toBe(true)
  })

  it("ExamTag と Tag が取り込みで保たれる（TagSubtotalGroup が指さないタグでも）", async () => {
    // 実際に起きていた形。小計グループに付いていないタグは、タグ本体を小計グループ
    // 経由でしか集めていなかった頃は常に空になり、タグ付けが警告なしに全部消えていた
    const archive = await readFixtureContents()
    const examOnlyTag = archive.tagsData.tags.find(
      (tag) => tag.name === EXAM_ONLY_TAG_NAME
    )!
    expect(
      archive.tagsData.tagSubtotalGroups.some(
        (tagSubtotalGroup) => tagSubtotalGroup.tagId === examOnlyTag.id
      )
    ).toBe(false)

    const importUser = await createTestUser()
    const { examId, warnings } = await importArchive(importUser.id)

    const importedExamTags = await prisma.examTag.findMany({
      where: { examId },
      include: { tag: true },
    })
    expect(importedExamTags.length).toBe(archive.tagsData.examTags.length)
    const importedExamOnlyTag = importedExamTags.find(
      (examTag) => examTag.tag.name === EXAM_ONLY_TAG_NAME
    )
    expect(importedExamOnlyTag).toBeDefined()
    // 表示順と色もタグの持ち物なので落とさない
    expect(importedExamOnlyTag!.tag.order).toBe(3)
    expect(importedExamOnlyTag!.tag.color).toBe("#3b82f6")
    expect(warnings.some((warning) => warning.includes("タグ付け"))).toBe(false)
  })

  it("タグ本体を欠くアーカイブは、タグ付けを黙って捨てず警告を出す", async () => {
    const importUser = await createTestUser()
    // 書き出し側がタグ本体を集め損ねていた頃のアーカイブを模す
    const { examId, warnings } = await importArchive(
      importUser.id,
      (extracted) => {
        extracted.tagsData.tags = []
      }
    )

    expect(await prisma.examTag.count({ where: { examId } })).toBe(0)
    expect(warnings.some((warning) => warning.includes("タグ付け"))).toBe(true)
  })

  it("ReturnSnapshot が取り込みで保たれ、記録者は取り込む人へ倒さない", async () => {
    const archive = await readFixtureContents()
    const archivedSnapshots = archive.scoresData.returnSnapshots ?? []
    const exporter = archive.usersData.users.find(
      (user) => user.username === LEGACY_EXAM_EXPORTER_USERNAME
    )!
    // 前提: 書き出した本人が記録したものと、記録者なしのものが両方ある
    expect(
      archivedSnapshots.map((snapshot) => snapshot.capturedByUserId).sort()
    ).toEqual([exporter.id, null].sort())

    const importUser = await createTestUser()
    const { examId, warnings } = await importArchive(importUser.id)

    const imported = await prisma.returnSnapshot.findMany({
      where: { examStudent: { examId } },
    })
    expect(imported.length).toBe(archivedSnapshots.length)
    for (const archivedSnapshot of archivedSnapshots) {
      const snapshot = imported.find(
        (importedSnapshot) =>
          importedSnapshot.examStudentId === archivedSnapshot.examStudentId
      )
      expect(snapshot).toBeDefined()
      expect(snapshot!.scoresJson).toBe(archivedSnapshot.scoresJson)
      expect(snapshot!.capturedAt.toISOString()).toBe(
        new Date(archivedSnapshot.capturedAt).toISOString()
      )
      // 返却したのは取り込んだ人ではない
      expect(snapshot!.capturedByUserId).not.toBe(importUser.id)
      // 書き出し元の利用者は「採点者」としてこのDBに作られる（採点行が親を失わないため）ので、
      // 返却の記録者もその人のまま残る。元から記録者なしだったものは、なしのまま
      expect(snapshot!.capturedByUserId).toBe(archivedSnapshot.capturedByUserId)
      expect(snapshot!.totalScore?.toNumber() ?? null).toBe(
        archivedSnapshot.totalScore === null
          ? null
          : Number(archivedSnapshot.totalScore)
      )
    }
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
    const archive = await readFixtureContents()
    const exporter = archive.usersData.users.find(
      (user) => user.username === LEGACY_EXAM_EXPORTER_USERNAME
    )!

    // 同じパソコンへ戻す場合を模す（利用者の id まで一致する）
    const importUser = await createTestUser({ id: exporter.id })
    const { examId, warnings } = await importArchive(importUser.id)

    const imported = await prisma.returnSnapshot.findMany({
      where: { examStudent: { examId }, capturedByUserId: { not: null } },
    })
    expect(imported.length).toBe(1)
    expect(imported[0].capturedByUserId).toBe(exporter.id)
    expect(warnings.some((warning) => warning.includes("記録者なし"))).toBe(
      false
    )
  })

  it("同じアーカイブを二度取り込んでも ReturnSnapshot と ExamTag は増えない", async () => {
    const archive = await readFixtureContents()

    const importUser = await createTestUser()
    await importArchive(importUser.id)
    const { examId } = await importArchive(importUser.id)

    expect(
      await prisma.returnSnapshot.count({ where: { examStudent: { examId } } })
    ).toBe((archive.scoresData.returnSnapshots ?? []).length)
    expect(await prisma.examTag.count({ where: { examId } })).toBe(
      archive.tagsData.examTags.length
    )
    expect(await prisma.tag.count()).toBe(archive.tagsData.tags.length)
  })

  it("採点の覚え書き（QuestionScore.comment）が取り込みで保たれる", async () => {
    // 1件だけ覚え書きがある。他は空のまま（＝書いていない側も壊れない）
    const archive = await readFixtureContents()
    const archivedScores = archive.scoresData.questionScores
    const commentedScore = archivedScores.find(
      (questionScore) => questionScore.comment !== ""
    )!
    const uncommentedScore = archivedScores.find(
      (questionScore) => questionScore.comment === ""
    )!
    expect(commentedScore.comment).toBe(
      "誤字は減点しない方針なので3点\n（2行目も保つ）"
    )

    const importUser = await createTestUser()
    await importArchive(importUser.id)

    const imported = await prisma.questionScore.findMany()
    expect(imported).toHaveLength(archivedScores.length)
    expect(
      imported.find((questionScore) => questionScore.id === commentedScore.id)!
        .comment
    ).toBe("誤字は減点しない方針なので3点\n（2行目も保つ）")
    expect(
      imported.find(
        (questionScore) => questionScore.id === uncommentedScore.id
      )!.comment
    ).toBe("")
  })

  it("非表示の学級は取り込んでも非表示のまま", async () => {
    const archive = await readFixtureContents()
    expect(
      archive.classesData.classrooms.every((classroom) => !classroom.isVisible)
    ).toBe(true)

    const importUser = await createTestUser()
    await importArchive(importUser.id)

    const imported = await prisma.classroom.findMany()
    expect(imported.length).toBe(archive.classesData.classrooms.length)
    expect(imported.every((classroom) => !classroom.isVisible)).toBe(true)
  })
})
