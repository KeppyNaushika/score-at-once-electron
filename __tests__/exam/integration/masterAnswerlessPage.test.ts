/**
 * 模範解答画像を持たないページ（imagePath IS NULL）の回帰テスト
 *
 * 旧バージョンは「答案画像が残っているページから模範解答だけを削除する」ことを許しており、
 * その状態のページが移行やアーカイブ取り込みで入ってくる。畳み込み当初は imagePath を
 * NOT NULL にして空文字を番兵にしたため、画像を読む側が欠落の分岐を書き忘れても
 * コンパイルが通り、`path.join(dataDir, "")` がデータディレクトリを指して sharp に渡り、
 * 答案アップロードと OMR マーカー検出が丸ごと落ちていた。
 *
 * ここでは「画像の無いページが混ざっていても、画像のあるページの処理は完走する」ことを
 * 実データ経路で確かめる。
 */
import * as fsPromises from "fs/promises"
import * as os from "os"
import * as path from "path"
import sharp from "sharp"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const TEST_DATA_DIR = path.join(
  os.tmpdir(),
  "score-at-once-imageless-page-test"
)
process.env.SCORE_AT_ONCE_DATA_DIR = TEST_DATA_DIR

vi.mock("../../../electron-src/lib/prisma/client", async () => {
  const { getTestPrismaClient } = await import("../../helpers/testPrismaClient")
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

import { getAbsolutePathFromData } from "@/electron-src/lib/dataManager"
import { getMasterAnswersByExamId } from "@/electron-src/lib/prisma/masterAnswer"
import { uploadStudentAnswers } from "@/electron-src/lib/prisma/studentAnswer/crud"

import {
  cleanupTestDatabase,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../../helpers/testPrismaClient"

const prisma = getTestPrismaClient()

/** 白紙PNGを実ファイルとして置き、data からの相対パスを返す */
async function writeBlankPng(relativePath: string): Promise<string> {
  const absolutePath = getAbsolutePathFromData(relativePath)
  await fsPromises.mkdir(path.dirname(absolutePath), { recursive: true })
  await sharp({
    create: {
      width: 200,
      height: 280,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .png()
    .toFile(absolutePath)
  return relativePath
}

/**
 * ページ1は模範解答あり、ページ2は模範解答なし（旧バージョン由来の幽霊ページ）の試験。
 */
async function seedExamWithImagelessPage() {
  const exam = await prisma.exam.create({
    data: { examName: "画像欠落テスト" },
  })

  const pageWithImage = await prisma.examPage.create({
    data: {
      examId: exam.id,
      pageNumber: 1,
      imagePath: await writeBlankPng(
        `exams/${exam.id}/master-images/page1.png`
      ),
      pageSize: "B4",
    },
  })
  const pageWithoutImage = await prisma.examPage.create({
    data: { examId: exam.id, pageNumber: 2, imagePath: null },
  })

  const student = await prisma.student.create({
    data: {
      studentNumber: `S${Date.now()}`,
      lastName: "山田",
      firstName: "花子",
      lastNameKana: "ヤマダ",
      firstNameKana: "ハナコ",
    },
  })
  const examStudent = await prisma.examStudent.create({
    data: { examId: exam.id, studentId: student.id, status: "participating" },
  })

  return { exam, pageWithImage, pageWithoutImage, examStudent }
}

/** アップロード1件分のダミー答案（実PNG） */
async function answerFileData(examPageId: string, examStudentId: string) {
  const buffer = await sharp({
    create: {
      width: 200,
      height: 280,
      channels: 3,
      background: { r: 240, g: 240, b: 240 },
    },
  })
    .png()
    .toBuffer()
  return {
    name: "answer.png",
    type: "image/png",
    buffer: buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    ) as ArrayBuffer,
    examPageId,
    examStudentId,
  }
}

beforeEach(async () => {
  await cleanupTestDatabase()
  await fsPromises.rm(TEST_DATA_DIR, { recursive: true, force: true })
})

afterAll(async () => {
  await fsPromises.rm(TEST_DATA_DIR, { recursive: true, force: true })
  await disconnectTestPrisma()
})

describe("模範解答画像を持たないページが混ざった試験", () => {
  it("そのページへ答案をアップロードできる（マーカー先読みで全体を落とさない）", async () => {
    const { exam, pageWithoutImage, examStudent } =
      await seedExamWithImagelessPage()

    const result = await uploadStudentAnswers(exam.id, [
      await answerFileData(pageWithoutImage.id, examStudent.id),
    ])

    expect(result.success).toBe(true)
    expect(await prisma.studentAnswerImage.count()).toBe(1)
  })

  it("画像のあるページへの一括アップロードを巻き添えにしない", async () => {
    const { exam, pageWithImage, pageWithoutImage, examStudent } =
      await seedExamWithImagelessPage()

    const result = await uploadStudentAnswers(exam.id, [
      await answerFileData(pageWithImage.id, examStudent.id),
      await answerFileData(pageWithoutImage.id, examStudent.id),
    ])

    expect(result.success).toBe(true)
    expect(await prisma.studentAnswerImage.count()).toBe(2)
  })

  it("模範解答一覧には画像を持つページだけが出る", async () => {
    const { exam, pageWithImage } = await seedExamWithImagelessPage()

    const masterAnswers = await getMasterAnswersByExamId(exam.id)

    expect(masterAnswers.map((page) => page.id)).toEqual([pageWithImage.id])
  })
})
