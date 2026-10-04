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
 *
 * 取り込むのは旧書き出しで作った固定ファイル `exam-full.score`。元データは
 * createFullTestExam（2ページ×2設問・3名・採点ほか）で、試験の列は既定と違う値
 * （試験名「書き出した側の試験名」・試験日 2026-03-01・説明「書き出した側の説明」・
 * 赤ペン補正あり）にしてから書き出した。「このパソコンに同じ試験がある」状態は、
 * 同じ固定ファイルを空の DB へ一度取り込んで作る（seedExamFromLegacyArchive）。
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

import {
  cleanupTempDir,
  type ExtractedArchiveData,
} from "../../../electron-src/lib/import/exam-archive/archiveExtractor"
import { executeIdIntegrationImport } from "../../../electron-src/lib/import/merge/idIntegrationImporter"
import { performPreMatching } from "../../../electron-src/lib/import/merge/matcher"
import {
  extractLegacyExamArchive,
  seedExamFromLegacyArchive,
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
 * 固定ファイルを、同じ試験が既にある DB へ取り込む（＝試験IDが一致する状況）。
 *
 * 生徒・学級・小計グループは既定の戦略のまま（同じ固定ファイルから作った DB なので
 * ID一致で自動的に紐づく）。分かれ道は試験の扱いだけ。
 * `prepare` は取り込む前にアーカイブの中身を書き換えたいときに使う。
 */
async function importIntoSameDatabase(
  currentUserId: string,
  exam: ImportAction,
  prepare?: (extracted: ExtractedArchiveData) => void
): Promise<{ examId: string; warnings: string[] }> {
  const extracted = await extractLegacyExamArchive(EXAM_FIXTURE)
  prepare?.(extracted)
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

/** この DB の試験の列を、アーカイブと違う値・指定の更新時刻にする */
async function rewriteLocalExam(examId: string, updatedAt: Date) {
  return prisma.exam.update({
    where: { id: examId },
    data: {
      examName: "このPCの試験名",
      referenceDate: new Date("2020-05-05T00:00:00.000Z"),
      description: null,
      markerCorrectionEnabled: false,
      updatedAt,
    },
  })
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
    const exporterId = await seedExamFromLegacyArchive(EXAM_FIXTURE)
    const archive = await readFixtureContents()
    const archivedExam = archive.examData.exam

    const { examId } = await importIntoSameDatabase(exporterId, "separate")

    // 既存の試験は残り、取り込んだ方は別の試験になる
    expect(examId).not.toBe(archivedExam.id)
    const exams = await prisma.exam.findMany()
    expect(exams.length).toBe(2)
    expect(exams.find((exam) => exam.id === archivedExam.id)!.examName).toBe(
      archivedExam.examName
    )
    // 一覧で見分けられるよう名前をずらす
    const importedExam = exams.find((exam) => exam.id === examId)!
    expect(importedExam.examName).toBe(`${archivedExam.examName} (2)`)
    // 新しい行なので誰とも競合しない。時刻はアーカイブの値をそのまま持つ
    expect(importedExam.createdAt.toISOString()).toBe(
      new Date(archivedExam.createdAt).toISOString()
    )
    expect(importedExam.updatedAt.toISOString()).toBe(
      new Date(archivedExam.updatedAt).toISOString()
    )

    // ページ・設問は取り込んだ試験に別の行として付く（既存の行にぶら下がらない）
    const archivedPageIds = new Set(
      archive.examData.examPages.map((examPage) => examPage.id)
    )
    const importedPages = await prisma.examPage.findMany({ where: { examId } })
    expect(importedPages.length).toBe(archivedPageIds.size)
    expect(
      await prisma.examPage.count({ where: { examId: archivedExam.id } })
    ).toBe(archivedPageIds.size)
    expect(importedPages.some((page) => archivedPageIds.has(page.id))).toBe(
      false
    )

    const archivedRegionIds = new Set(
      archive.examData.cropRegions.map((cropRegion) => cropRegion.id)
    )
    const importedRegions = await prisma.cropRegion.findMany({
      where: { examPage: { examId } },
    })
    expect(importedRegions.length).toBe(archivedRegionIds.size)
    expect(
      importedRegions.some((cropRegion) => archivedRegionIds.has(cropRegion.id))
    ).toBe(false)

    // 受験者・採点も試験ごとに別々
    const archivedExamStudentCount = archive.examData.examStudents.length
    expect(await prisma.examStudent.count({ where: { examId } })).toBe(
      archivedExamStudentCount
    )
    expect(
      await prisma.examStudent.count({ where: { examId: archivedExam.id } })
    ).toBe(archivedExamStudentCount)
    const archivedScoreCount = archive.scoresData.questionScores.length
    expect(
      await prisma.questionScore.count({
        where: { cropRegion: { examPage: { examId } } },
      })
    ).toBe(archivedScoreCount)
    expect(
      await prisma.questionScore.count({
        where: { cropRegion: { examPage: { examId: archivedExam.id } } },
      })
    ).toBe(archivedScoreCount)

    // 生徒・学級・小計グループは試験をまたいで共有される実体なので増えない
    expect(await prisma.student.count()).toBe(
      archive.studentsData.students.length
    )
    expect(await prisma.classroom.count()).toBe(
      archive.classesData.classrooms.length
    )
    expect(await prisma.subtotalGroup.count()).toBe(
      archive.subtotalsData.subtotalGroups.length
    )
  })

  it("統合を選ぶと、アーカイブが新しければ試験自身の列が更新される", async () => {
    const exporterId = await seedExamFromLegacyArchive(EXAM_FIXTURE)
    const archivedExam = (await readFixtureContents()).examData.exam

    // 取り込む側は別の値で、しかも更新が古い
    await rewriteLocalExam(
      archivedExam.id,
      new Date("2020-01-01T00:00:00.000Z")
    )

    const { examId, warnings } = await importIntoSameDatabase(
      exporterId,
      "merge"
    )
    expect(examId).toBe(archivedExam.id)

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
    const secondImport = await importIntoSameDatabase(exporterId, "merge")
    expect(
      secondImport.warnings.some((warning) =>
        warning.includes("読み込んだデータの方が新しい")
      )
    ).toBe(false)
    expect(await prisma.exam.count()).toBe(1)
  })

  it("統合を選んでも、アーカイブが古ければ試験自身の列は更新されない", async () => {
    const exporterId = await seedExamFromLegacyArchive(EXAM_FIXTURE)
    const archivedExam = (await readFixtureContents()).examData.exam

    // 取り込む側の方が新しく書かれている
    const localUpdatedAt = new Date("2999-01-01T00:00:00.000Z")
    await rewriteLocalExam(archivedExam.id, localUpdatedAt)

    const { examId, warnings } = await importIntoSameDatabase(
      exporterId,
      "merge"
    )
    expect(examId).toBe(archivedExam.id)

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
    const exporterId = await seedExamFromLegacyArchive(EXAM_FIXTURE)
    const archivedExam = (await readFixtureContents()).examData.exam

    // 取り込む側の方が後に書かれている（統合なら勝つ側）
    const localUpdatedAt = new Date("2999-01-01T00:00:00.000Z")
    const beforeImport = await rewriteLocalExam(archivedExam.id, localUpdatedAt)

    const importStartedAt = new Date()
    const { examId, warnings } = await importIntoSameDatabase(
      exporterId,
      "overwrite"
    )
    expect(examId).toBe(archivedExam.id)

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
    const exporterId = await seedExamFromLegacyArchive(EXAM_FIXTURE)
    const archive = await readFixtureContents()
    const student = archive.studentsData.students[0]

    // 書き出したあとに、このパソコンで氏名を直した（＝アーカイブより新しい）
    await prisma.student.update({
      where: { id: student.id },
      data: { lastName: "このPCで直した姓" },
    })

    await importIntoSameDatabase(exporterId, "separate")

    const afterImport = await prisma.student.findUniqueOrThrow({
      where: { id: student.id },
    })
    expect(afterImport.lastName).toBe("このPCで直した姓")
    // 生徒は増えない（試験だけが2つになる）
    expect(await prisma.student.count()).toBe(
      archive.studentsData.students.length
    )
    expect(await prisma.exam.count()).toBe(2)
  })

  it("統合すると、このパソコンの生徒の情報もアーカイブが新しければ書き換わる", async () => {
    const exporterId = await seedExamFromLegacyArchive(EXAM_FIXTURE)
    const student = (await readFixtureContents()).studentsData.students[0]

    // このパソコンの側を古い時刻のまま別の値にしておく
    await prisma.student.update({
      where: { id: student.id },
      data: {
        lastName: "このPCの姓",
        updatedAt: new Date("2020-01-01T00:00:00.000Z"),
      },
    })

    await importIntoSameDatabase(exporterId, "merge")

    const afterImport = await prisma.student.findUniqueOrThrow({
      where: { id: student.id },
    })
    expect(afterImport.lastName).toBe(student.lastName)
  })

  it("別で追加した試験の受験者名簿は、1..n の連番になる", async () => {
    const exporterId = await seedExamFromLegacyArchive(EXAM_FIXTURE)
    const archive = await readFixtureContents()
    const archivedExamId = archive.examData.exam.id

    // 取り込み元（このパソコン）の名簿の並びを、重複と穴のある状態にしておく
    await prisma.examStudent.updateMany({
      where: { examId: archivedExamId },
      data: { customOrder: 7 },
    })

    // アーカイブ側も同じ並び（その状態で書き出したもの）として取り込む
    const { examId } = await importIntoSameDatabase(
      exporterId,
      "separate",
      (extracted) => {
        for (const examStudent of extracted.examData.examStudents) {
          examStudent.customOrder = 7
        }
      }
    )

    const importedRoster = await prisma.examStudent.findMany({
      where: { examId },
    })
    const rosterSize = archive.examData.examStudents.length
    expect(importedRoster).toHaveLength(rosterSize)
    expect(
      importedRoster
        .map((examStudent) => examStudent.customOrder)
        .sort((left, right) => (left ?? 0) - (right ?? 0))
    ).toEqual(Array.from({ length: rosterSize }, (_, index) => index + 1))

    // 取り込み元の名簿は触らない（行が増えていないので詰め直しも走らない）
    const originalRoster = await prisma.examStudent.findMany({
      where: { examId: archivedExamId },
    })
    expect(
      originalRoster.every((examStudent) => examStudent.customOrder === 7)
    ).toBe(true)
  })

  it("上書きすると、新しく作られる行の時刻も取り込み時刻になる", async () => {
    // 空のDBへ「上書きする」で取り込む（＝全部が新しく作る行になる）
    const importUser = await createTestUser()
    const extracted = await extractLegacyExamArchive(EXAM_FIXTURE)
    const archivedExam = extracted.examData.exam
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
