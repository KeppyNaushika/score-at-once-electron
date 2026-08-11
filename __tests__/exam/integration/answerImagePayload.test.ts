/**
 * 答案画像の供給形の統合テスト
 *
 * `_count` を撤去して行を渡し切る形へ変えたため、05 の答案枚数列は
 * `examStudent.studentAnswerImages.length` を読む。行が来なければ列が黙って 0 になる。
 *
 * 一方 06 のデータセットでは、同じ答案が行（examStudents）と列（examPages）の両方に
 * 載ると1つの応答に同じ集合が二重に入る。列側だけが持つことを固定する。
 */

import * as path from "path"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const TEST_DB_PATH = path.resolve(__dirname, "../../../data/test-database.db")

vi.mock("../../../electron-src/lib/prisma/client", async () => {
  const { getTestPrismaClient } = await import("../../helpers/testPrismaClient")
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

import { getStudentsForExam } from "@/electron-src/lib/prisma/examStudent"
import { getStudentAnswersDataset } from "@/electron-src/lib/prisma/studentAnswer/crud"

import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

describe("答案画像の供給形", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  it("05 の枚数列が読む answerImages は行として供給される", async () => {
    const fixture = await createFullTestExam(testPrisma, {
      includeStudentAnswerImages: true,
    })

    const result = await getStudentsForExam(fixture.exam.id)

    for (const examStudent of result) {
      const expected = fixture.studentAnswerImages.filter(
        (studentAnswerImage) =>
          studentAnswerImage.examStudentId === examStudent.id
      ).length
      // 枚数を数えるのは renderer。main は行を渡すだけ（`_count` を作らない）
      expect(examStudent.studentAnswerImages.length).toBe(expected)
    }
  })

  it("答案が無い受験者には空配列が来る（undefined ではない）", async () => {
    const fixture = await createFullTestExam(testPrisma, {
      includeStudentAnswerImages: false,
    })

    const result = await getStudentsForExam(fixture.exam.id)

    for (const examStudent of result) {
      expect(examStudent.studentAnswerImages).toEqual([])
    }
  })

  it("06 のデータセットでは答案が列（examPages）にだけ載る", async () => {
    const fixture = await createFullTestExam(testPrisma, {
      includeStudentAnswerImages: true,
    })

    const result = await getStudentAnswersDataset(fixture.exam.id)
    const columnImages = result.examPages!.flatMap(
      (examPage) => examPage.studentAnswerImages
    )
    expect(columnImages.length).toBe(fixture.studentAnswerImages.length)

    // 行にも同梱すると同じ集合が1つの応答に二重に入る。行は答案を読まない
    for (const examStudent of result.examStudents!) {
      expect(
        (examStudent as unknown as Record<string, unknown>).studentAnswerImages
      ).toBeUndefined()
    }
  })
})
