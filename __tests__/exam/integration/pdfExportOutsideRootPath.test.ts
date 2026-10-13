/**
 * PDF 出力のデータ組み立て（`getPdfExportData`）が、データフォルダの外を指す答案画像のパスを
 * 1件含んでいても止まらず、そのページだけを飛ばして残りのページを出すことを縛る。
 *
 * 以前は `getAbsolutePathFromSharedFiles` が投げる `PathOutsideRootError` を捕まえておらず、
 * 1件で PDF 出力全体が例外になっていた。
 */
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import { fixLocalStorageRootsForTest } from "../../helpers/localStorageRoots"

const TEST_DATA_DIR = path.join(
  os.tmpdir(),
  `score-at-once-pdf-export-outside-root-${process.pid}`
)
fixLocalStorageRootsForTest(TEST_DATA_DIR)

const TEST_DB_PATH = path.resolve(__dirname, "../../../data/test-database.db")

vi.mock("../../../electron-src/lib/prisma/client", async () => {
  const { getTestPrismaClient } = await import("../../helpers/testPrismaClient")
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

import { getPdfExportData } from "@/electron-src/lib/prisma/pdfExport"

import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

/** 1x1 の透過 PNG。中身は読めれば何でもよい（data URL にするだけで描かない） */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
)

/** 答案画像の DB 上の相対パスに、実際にファイルを置く */
function writeAnswerImageFile(relativeImagePath: string) {
  const absolutePath = path.join(TEST_DATA_DIR, relativeImagePath)
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
  fs.writeFileSync(absolutePath, TINY_PNG)
}

describe("getPdfExportData とデータフォルダの外を指す答案画像", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true })
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true })
  })

  it("外を指すパスが1件あっても例外にせず、そのページだけ飛ばして残りを出す", async () => {
    const exam = await createFullTestExam(testPrisma, {
      studentCount: 2,
      pageCount: 2,
      cropRegionsPerPage: 1,
      includeScores: true,
      includeStudentAnswerImages: true,
    })
    for (const studentAnswerImage of exam.studentAnswerImages) {
      writeAnswerImageFile(studentAnswerImage.imagePath)
    }

    // 1件だけ、データフォルダの外を指すパスに書き換える（外に本物のファイルも置いておく。
    // 置いてあっても読みに行かないことまで見る）
    const [outsideAnswerImage] = exam.studentAnswerImages
    const outsideRelativePath = "../outside-answer.png"
    fs.writeFileSync(
      path.join(TEST_DATA_DIR, "..", "outside-answer.png"),
      TINY_PNG
    )
    await testPrisma.studentAnswerImage.update({
      where: { id: outsideAnswerImage.id },
      data: { imagePath: outsideRelativePath },
    })

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    try {
      const pdfExportData = await getPdfExportData({
        examId: exam.exam.id,
        selectedExamStudentIds: exam.examStudents.map(
          (examStudent) => examStudent.id
        ),
      })

      // 2人 × 2ページ のうち、外を指す1件だけが抜ける
      expect(pdfExportData.pages).toHaveLength(3)
      const outsidePage = pdfExportData.pages.find(
        (page) =>
          page.examStudentId === outsideAnswerImage.examStudentId &&
          page.imagePath.endsWith("outside-answer.png")
      )
      expect(outsidePage).toBeUndefined()
      for (const page of pdfExportData.pages) {
        expect(page.imagePath.startsWith(TEST_DATA_DIR)).toBe(true)
        expect(page.imageUrl.startsWith("data:image/png;base64,")).toBe(true)
      }
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(outsideRelativePath),
        expect.anything()
      )
    } finally {
      warnSpy.mockRestore()
      fs.rmSync(path.join(TEST_DATA_DIR, "..", "outside-answer.png"), {
        force: true,
      })
    }
  })
})
