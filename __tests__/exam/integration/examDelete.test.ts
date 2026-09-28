/**
 * 試験削除の統合テスト
 *
 * deleteExam が DB レコードを cascade 削除するだけでなく、
 * 試験ディレクトリ配下の画像ファイルも削除することを検証する。
 * 成績算出から使われている試験（試験そのもの・その設問）は消さずに断ることも検証する。
 */
import * as fsPromises from "fs/promises"
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

import { SAW_ALL_DELETION_COUNTS } from "../../helpers/deletionCounts"
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
    await fsPromises.rm(TEST_DATA_DIR, { recursive: true, force: true })
    await disconnectTestPrisma()
  })

  it("試験ディレクトリの画像ファイルごと削除する", async () => {
    const exam = await createExam({ examName: "削除対象の試験" }, userId)

    const masterAnswersDir = path.join(
      getExamDirectory(exam.id),
      "master-answers"
    )
    await fsPromises.mkdir(masterAnswersDir, { recursive: true })
    const imagePath = path.join(masterAnswersDir, "page-1.png")
    await fsPromises.writeFile(imagePath, "dummy-image")
    const examPage = await prisma.examPage.create({
      data: {
        examId: exam.id,
        pageNumber: 1,
        imagePath: path.relative(TEST_DATA_DIR, imagePath),
      },
    })

    await deleteExam(exam.id, SAW_ALL_DELETION_COUNTS)

    expect(await prisma.exam.findUnique({ where: { id: exam.id } })).toBeNull()
    // cascade で子レコードも消えていること
    expect(
      await prisma.examPage.findUnique({ where: { id: examPage.id } })
    ).toBeNull()
    // 画像ファイルとディレクトリが残っていないこと
    await expect(fsPromises.stat(getExamDirectory(exam.id))).rejects.toThrow()
  })

  it("試験ディレクトリが存在しない場合も削除に失敗しない", async () => {
    const exam = await createExam({ examName: "ファイル無しの試験" }, userId)

    await expect(
      deleteExam(exam.id, SAW_ALL_DELETION_COUNTS)
    ).resolves.toBeTruthy()
    expect(await prisma.exam.findUnique({ where: { id: exam.id } })).toBeNull()
  })

  it("成績算出が設問を使っている試験は削除を断り、試験もデータソースも残る", async () => {
    const exam = await createExam({ examName: "成績で使う試験" }, userId)
    const examPage = await prisma.examPage.create({
      data: { examId: exam.id, pageNumber: 1 },
    })
    const cropRegion = await prisma.cropRegion.create({
      data: {
        examPageId: examPage.id,
        label: "問1",
        type: "QUESTION_ANSWER",
        x: 0,
        y: 0,
        width: 0.1,
        height: 0.1,
        points: 5,
      },
    })
    const grade = await prisma.grade.create({ data: { name: "1学期成績" } })
    const gradeItem = await prisma.gradeItem.create({
      data: { gradeId: grade.id, name: "知識・技能" },
    })
    // examId を持たない旧来の行でも、設問から辿って拾う
    const dataSource = await prisma.gradeDataSource.create({
      data: {
        gradeItemId: gradeItem.id,
        type: "crop_region",
        cropRegionId: cropRegion.id,
        name: "問1",
        weight: 100,
      },
    })

    await expect(deleteExam(exam.id, SAW_ALL_DELETION_COUNTS)).rejects.toThrow(
      /削除できません[\s\S]*成績算出「1学期成績」/
    )

    expect(
      await prisma.exam.findUnique({ where: { id: exam.id } })
    ).not.toBeNull()
    expect(
      await prisma.gradeDataSource.findUnique({ where: { id: dataSource.id } })
    ).not.toBeNull()

    await prisma.grade.delete({ where: { id: grade.id } })
    await deleteExam(exam.id, SAW_ALL_DELETION_COUNTS)
  })
})
