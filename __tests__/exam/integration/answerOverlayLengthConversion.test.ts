/**
 * 答案に重ねる要素の長さを、答案画像の画素から mm へ変換する（migration の続き）
 *
 * テスト対象: electron-src/lib/prisma/answerOverlayLengthConversion.ts
 * - 代表の答案画像（画素幅の最頻値）で描画の式のちょうど逆に変換する
 * - 冪等（"px" の行だけを対象にする）・updatedAt を変えない
 * - 答案画像が読めない試験は "px" のまま残し、次の機会に変換する
 * - 答案の無い試験は 144dpi 相当で代用する
 * - 開いた統合アーカイブの DB でも同じに変換する
 */

import Database from "better-sqlite3"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import sharp from "sharp"
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  convertArchiveAnswerOverlayLengths,
  convertPendingAnswerOverlayLengths,
  readRepresentativeAnswerImage,
} from "../../../electron-src/lib/prisma/answerOverlayLengthConversion"
import {
  convertPixelLengthsToMm,
  FALLBACK_PIXELS_PER_MM,
  overlayPixelsPerMm,
} from "../../../src/lib/answerOverlayPlacement"
import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../../helpers/testPrismaClient"

const prisma = getTestPrismaClient()
const TEST_DB_PATH = path.resolve(__dirname, "../../../data/test-database.db")

let filesDirectory: string

const resolveImagePath = (imagePath: string): string =>
  path.join(filesDirectory, imagePath)

async function writePng(
  imagePath: string,
  width: number,
  height: number
): Promise<void> {
  const absolutePath = resolveImagePath(imagePath)
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
  await sharp({
    create: { width, height, channels: 3, background: "#ffffff" },
  })
    .png()
    .toFile(absolutePath)
}

const PIXEL_ROWS = [
  {
    overlayKind: "mark",
    position: "top-left",
    offsetX: 3,
    offsetY: -4,
    size: 50,
  },
  {
    overlayKind: "partial",
    position: "bottom-right",
    offsetX: -2,
    offsetY: 6,
    size: 14,
  },
] as const

/** 試験を作り、"px" のスタイル行を足す。答案画像のファイルは書かない */
async function createExamWithPixelStyles(options: {
  studentCount: number
  pageSize: string
  withAnswerImages: boolean
}) {
  const fullExam = await createFullTestExam(prisma, {
    pageCount: 1,
    studentCount: options.studentCount,
    includeMasterImages: true,
    includeStudentAnswerImages: options.withAnswerImages,
    includeScores: false,
  })
  await prisma.examPage.updateMany({
    where: { examId: fullExam.exam.id },
    data: { pageSize: options.pageSize },
  })
  const updatedAt = new Date("2026-01-02T03:04:05.000Z")
  for (const row of PIXEL_ROWS) {
    await prisma.examAnswerOverlayStyle.create({
      data: {
        examId: fullExam.exam.id,
        ...row,
        anchor: row.position,
        lengthUnit: "px",
        color: "#ef4444",
        opacity: 100,
        updatedAt,
      },
    })
  }
  return { ...fullExam, updatedAt }
}

const stylesOf = (examId: string) =>
  prisma.examAnswerOverlayStyle.findMany({
    where: { examId },
    orderBy: { overlayKind: "asc" },
  })

/** 期待する mm の値（描画の式の逆） */
function expectConvertedRows(
  styles: Awaited<ReturnType<typeof stylesOf>>,
  pixelsPerMm: number,
  updatedAt: Date
): void {
  expect(styles).toHaveLength(PIXEL_ROWS.length)
  for (const style of styles) {
    const source = PIXEL_ROWS.find(
      (row) => row.overlayKind === style.overlayKind
    )!
    const expected = convertPixelLengthsToMm(source, pixelsPerMm)
    expect(style.lengthUnit).toBe("mm")
    expect(style.size).toBeCloseTo(expected.size, 9)
    expect(style.offsetX).toBeCloseTo(expected.offsetX, 9)
    expect(style.offsetY).toBeCloseTo(expected.offsetY, 9)
    // 描くときは元の画素へ戻る
    expect(style.size * pixelsPerMm).toBeCloseTo(source.size, 9)
    // 時刻は変えない
    expect(style.updatedAt.toISOString()).toBe(updatedAt.toISOString())
  }
}

describe("answerOverlayLengthConversion", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
    filesDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "overlay-mm-"))
  })

  afterEach(() => {
    fs.rmSync(filesDirectory, { recursive: true, force: true })
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  it("代表の答案画像（画素幅の最頻値）で変換し、ラベルが誤っていても描く画素が一致する", async () => {
    // ラベルは A4 だが、答案の多くは A3 を 144dpi で読んだ画像
    const fullExam = await createExamWithPixelStyles({
      studentCount: 3,
      pageSize: "A4",
      withAnswerImages: true,
    })
    const [first, second, third] = fullExam.studentAnswerImages
    await writePng(first.imagePath, 1684, 2381)
    await writePng(second.imagePath, 1191, 1684)
    await writePng(third.imagePath, 1684, 2381)
    // 模範解答は代表にしない（高解像度でも効かない）
    await writePng(fullExam.pages[0].imagePath!, 4000, 5000)

    const result = await convertPendingAnswerOverlayLengths(
      prisma,
      resolveImagePath
    )

    expect(result).toEqual({
      convertedExamIds: [fullExam.exam.id],
      pendingExamIds: [],
    })
    expectConvertedRows(
      await stylesOf(fullExam.exam.id),
      overlayPixelsPerMm("A4", 1684, 2381),
      fullExam.updatedAt
    )
  })

  it("冪等: 2回目は何も変えない", async () => {
    const fullExam = await createExamWithPixelStyles({
      studentCount: 1,
      pageSize: "B4",
      withAnswerImages: true,
    })
    await writePng(fullExam.studentAnswerImages[0].imagePath, 2480, 3508)

    await convertPendingAnswerOverlayLengths(prisma, resolveImagePath)
    const afterFirst = await stylesOf(fullExam.exam.id)
    const second = await convertPendingAnswerOverlayLengths(
      prisma,
      resolveImagePath
    )

    expect(second).toEqual({ convertedExamIds: [], pendingExamIds: [] })
    expect(await stylesOf(fullExam.exam.id)).toEqual(afterFirst)
    expectConvertedRows(
      afterFirst,
      overlayPixelsPerMm("B4", 2480, 3508),
      fullExam.updatedAt
    )
  })

  it("読めない答案画像がある試験は px のまま残し、読めるようになったら変換する", async () => {
    const fullExam = await createExamWithPixelStyles({
      studentCount: 2,
      pageSize: "A4",
      withAnswerImages: true,
    })
    const [first, second] = fullExam.studentAnswerImages
    await writePng(first.imagePath, 1191, 1684)
    // second はファイルが無い（NAS が切れている等）

    const pending = await convertPendingAnswerOverlayLengths(
      prisma,
      resolveImagePath
    )
    expect(pending).toEqual({
      convertedExamIds: [],
      pendingExamIds: [fullExam.exam.id],
    })
    const untouched = await stylesOf(fullExam.exam.id)
    expect(untouched.map((style) => style.lengthUnit)).toEqual(["px", "px"])
    expect(untouched.map((style) => style.size).sort()).toEqual([14, 50])

    // 壊れた画像も読めない扱い
    fs.mkdirSync(path.dirname(resolveImagePath(second.imagePath)), {
      recursive: true,
    })
    fs.writeFileSync(resolveImagePath(second.imagePath), "not an image")
    expect(
      (await convertPendingAnswerOverlayLengths(prisma, resolveImagePath))
        .pendingExamIds
    ).toEqual([fullExam.exam.id])

    await writePng(second.imagePath, 1191, 1684)
    const retried = await convertPendingAnswerOverlayLengths(
      prisma,
      resolveImagePath
    )
    expect(retried.convertedExamIds).toEqual([fullExam.exam.id])
    expectConvertedRows(
      await stylesOf(fullExam.exam.id),
      overlayPixelsPerMm("A4", 1191, 1684),
      fullExam.updatedAt
    )
  })

  it("答案の画像が1枚も無い試験は 144dpi 相当で代用する", async () => {
    const fullExam = await createExamWithPixelStyles({
      studentCount: 2,
      pageSize: "A4",
      withAnswerImages: false,
    })

    const result = await convertPendingAnswerOverlayLengths(
      prisma,
      resolveImagePath
    )

    expect(result.convertedExamIds).toEqual([fullExam.exam.id])
    expectConvertedRows(
      await stylesOf(fullExam.exam.id),
      FALLBACK_PIXELS_PER_MM,
      fullExam.updatedAt
    )
  })

  it("代表の画像: 幅は最頻値、同数なら小さい幅。向きはその幅の画像の高さで決まる", async () => {
    await writePng("a.png", 2000, 1400)
    await writePng("b.png", 1000, 1400)
    await writePng("c.png", 2000, 1400)
    await writePng("d.png", 1000, 1400)
    expect(
      await readRepresentativeAnswerImage(
        ["a.png", "b.png", "c.png", "d.png"].map(resolveImagePath)
      )
    ).toEqual({ kind: "image", width: 1000, height: 1400 })
    expect(await readRepresentativeAnswerImage([])).toEqual({
      kind: "noAnswerImages",
    })
    expect(
      await readRepresentativeAnswerImage([resolveImagePath("missing.png")])
    ).toEqual({
      kind: "unreadable",
      failedPaths: [resolveImagePath("missing.png")],
    })
  })

  it("開いた統合アーカイブの DB でも、同梱の答案画像で同じに変換する", async () => {
    const fullExam = await createExamWithPixelStyles({
      studentCount: 2,
      pageSize: "A4",
      withAnswerImages: true,
    })
    for (const studentAnswerImage of fullExam.studentAnswerImages) {
      await writePng(studentAnswerImage.imagePath, 1684, 1191)
    }

    // アーカイブの DB の代わりに、テスト用 DB の写しを使う
    const archiveDatabasePath = path.join(filesDirectory, "archive.db")
    const source = new Database(TEST_DB_PATH, { readonly: true })
    source.exec(`VACUUM INTO '${archiveDatabasePath.replaceAll("'", "''")}'`)
    source.close()

    const archiveDb = new Database(archiveDatabasePath)
    try {
      const result = await convertArchiveAnswerOverlayLengths(
        archiveDb,
        filesDirectory
      )
      expect(result.convertedExamIds).toEqual([fullExam.exam.id])
      const pixelsPerMm = overlayPixelsPerMm("A4", 1684, 1191)
      const archiveRows = archiveDb
        .prepare<
          [string],
          {
            overlayKind: string
            lengthUnit: string
            size: number
            offsetX: number
            offsetY: number
            updatedAt: string
          }
        >(
          `SELECT "overlayKind", "lengthUnit", "size", "offsetX", "offsetY", "updatedAt" FROM "ExamAnswerOverlayStyle" WHERE "examId" = ?`
        )
        .all(fullExam.exam.id)
      expect(archiveRows).toHaveLength(PIXEL_ROWS.length)
      for (const archiveRow of archiveRows) {
        const source = PIXEL_ROWS.find(
          (row) => row.overlayKind === archiveRow.overlayKind
        )!
        const expected = convertPixelLengthsToMm(source, pixelsPerMm)
        expect(archiveRow.lengthUnit).toBe("mm")
        expect(archiveRow.size).toBeCloseTo(expected.size, 9)
        expect(archiveRow.offsetX).toBeCloseTo(expected.offsetX, 9)
        expect(archiveRow.offsetY).toBeCloseTo(expected.offsetY, 9)
        // 時刻は変えない（保存されている文字列のまま）
        expect(new Date(archiveRow.updatedAt).toISOString()).toBe(
          fullExam.updatedAt.toISOString()
        )
      }

      // 2回目は何もしない
      expect(
        await convertArchiveAnswerOverlayLengths(archiveDb, filesDirectory)
      ).toEqual({ convertedExamIds: [], pendingExamIds: [] })
    } finally {
      archiveDb.close()
    }

    // アプリの DB は触っていない
    expect(
      (await stylesOf(fullExam.exam.id)).map((style) => style.lengthUnit)
    ).toEqual(["px", "px"])
  })

  it("アーカイブの外を指すパスは読めない扱い（px のまま残す）", async () => {
    const fullExam = await createExamWithPixelStyles({
      studentCount: 1,
      pageSize: "A4",
      withAnswerImages: true,
    })
    await prisma.studentAnswerImage.updateMany({
      where: { id: fullExam.studentAnswerImages[0].id },
      data: { imagePath: "../outside.png" },
    })
    const archiveDatabasePath = path.join(filesDirectory, "archive.db")
    const source = new Database(TEST_DB_PATH, { readonly: true })
    source.exec(`VACUUM INTO '${archiveDatabasePath.replaceAll("'", "''")}'`)
    source.close()

    const archiveDb = new Database(archiveDatabasePath)
    try {
      expect(
        await convertArchiveAnswerOverlayLengths(archiveDb, filesDirectory)
      ).toEqual({ convertedExamIds: [], pendingExamIds: [fullExam.exam.id] })
    } finally {
      archiveDb.close()
    }
  })
})
