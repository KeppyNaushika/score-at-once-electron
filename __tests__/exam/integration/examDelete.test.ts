/**
 * 試験削除の統合テスト
 *
 * deleteExam が DB レコードを cascade 削除するだけでなく、
 * 試験ディレクトリ配下の画像ファイルも削除することを検証する。
 */
import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

// getExamDirectory がこのディレクトリを基準にするよう、import より前に設定する
const TEST_DATA_DIR = path.join(os.tmpdir(), "score-at-once-exam-delete-test")
process.env.SCORE_AT_ONCE_DATA_DIR = TEST_DATA_DIR

vi.mock("../../../electron-src/lib/prisma/client", async () => {
  const { getTestPrismaClient } = await import("../../helpers/testPrismaClient")
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

import { getExamDirectory } from "@/electron-src/lib/dataManager"
import { createExam, deleteExam } from "@/electron-src/lib/prisma/exam"

import {
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../../helpers/testPrismaClient"

const prisma = getTestPrismaClient()

describe("deleteExam", () => {
  let userId: string

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        name: "削除テスト教員",
        username: `exam-delete-${Date.now()}`,
      },
    })
    userId = user.id
  })

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } })
    await fs.rm(TEST_DATA_DIR, { recursive: true, force: true })
    await disconnectTestPrisma()
  })

  it("試験ディレクトリの画像ファイルごと削除する", async () => {
    const exam = await createExam({ examName: "削除対象の試験" }, userId)

    const examPage = await prisma.examPage.create({
      data: { examId: exam.id, pageNumber: 1 },
    })
    const masterAnswersDir = path.join(
      getExamDirectory(exam.id),
      "master-answers"
    )
    await fs.mkdir(masterAnswersDir, { recursive: true })
    const imagePath = path.join(masterAnswersDir, "page-1.png")
    await fs.writeFile(imagePath, "dummy-image")
    await prisma.masterImage.create({
      data: {
        examPageId: examPage.id,
        imagePath: path.relative(TEST_DATA_DIR, imagePath),
      },
    })

    await deleteExam(exam.id)

    expect(await prisma.exam.findUnique({ where: { id: exam.id } })).toBeNull()
    // cascade で子レコードも消えていること
    expect(
      await prisma.examPage.findUnique({ where: { id: examPage.id } })
    ).toBeNull()
    // 画像ファイルとディレクトリが残っていないこと
    await expect(fs.stat(getExamDirectory(exam.id))).rejects.toThrow()
  })

  it("試験ディレクトリが存在しない場合も削除に失敗しない", async () => {
    const exam = await createExam({ examName: "ファイル無しの試験" }, userId)

    await expect(deleteExam(exam.id)).resolves.toBeTruthy()
    expect(await prisma.exam.findUnique({ where: { id: exam.id } })).toBeNull()
  })
})
