/**
 * 採点対象と受験者が別々の試験に属する書き込みを弾くことの検証（#962）。
 *
 * 採点層は「採点対象（採点領域・複合回答・ページ）」と「受験者（ExamStudent）」の
 * 2つを参照する。FK が保証するのはそれぞれが実在することだけで、両者が同じ試験に
 * 属することは強制されない。どちらの id も string なので取り違えてもコンパイルは通り、
 * 書けてしまうと「試験Aの受験者一覧に居ない生徒の得点」が成績算出に算入される
 * — Phase B で Coursework に対して塞いだのと同じ穴が試験側にも残っていた。
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

import { upsertCompoundAnswerScore } from "@/electron-src/lib/prisma/compoundAnswer"
import {
  batchUpdateQuestionScores,
  setQuestionScore,
} from "@/electron-src/lib/prisma/questionScore"
import { upsertScoreDecision } from "@/electron-src/lib/prisma/scoreDecision"

import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

/** 別々の試験を2つ作り、Aの採点領域とBの受験者を取り出す */
async function buildTwoExams() {
  const examA = await createFullTestExam(testPrisma, {
    studentCount: 1,
    pageCount: 1,
    cropRegionsPerPage: 1,
    examName: "試験A",
    className: "学級A",
    includeScores: false,
  })
  const examB = await createFullTestExam(testPrisma, {
    studentCount: 1,
    pageCount: 1,
    cropRegionsPerPage: 1,
    examName: "試験B",
    className: "学級B",
    includeScores: false,
  })

  const cropRegionA = await testPrisma.cropRegion.findFirstOrThrow({
    where: { examPage: { examId: examA.exam.id } },
  })
  const examStudentA = await testPrisma.examStudent.findFirstOrThrow({
    where: { examId: examA.exam.id },
  })
  const examStudentB = await testPrisma.examStudent.findFirstOrThrow({
    where: { examId: examB.exam.id },
  })

  return { examA, examB, cropRegionA, examStudentA, examStudentB }
}

describe("採点対象と受験者の試験スコープ", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  it("同じ試験の採点領域と受験者なら採点できる", async () => {
    const { examA, cropRegionA, examStudentA } = await buildTwoExams()

    const result = await setQuestionScore({
      cropRegionId: cropRegionA.id,
      examStudentId: examStudentA.id,
      status: "correct",
      partialScore: null,
      userId: examA.user.id,
    })

    expect(result.id).toBeDefined()
    expect(await testPrisma.questionScore.count()).toBe(1)
  })

  it("別の試験の受験者への採点は拒否され、行も残らない", async () => {
    const { examA, cropRegionA, examStudentB } = await buildTwoExams()

    await expect(
      setQuestionScore({
        cropRegionId: cropRegionA.id,
        examStudentId: examStudentB.id,
        status: "correct",
        partialScore: null,
        userId: examA.user.id,
      })
    ).rejects.toThrow()

    expect(await testPrisma.questionScore.count()).toBe(0)
  })

  it("一括採点（OMR反映）でも別の試験の受験者は拒否される", async () => {
    const { examA, cropRegionA, examStudentA, examStudentB } =
      await buildTwoExams()

    await expect(
      batchUpdateQuestionScores([
        {
          cropRegionId: cropRegionA.id,
          examStudentId: examStudentA.id,
          status: "correct",
          partialScore: null,
          userId: examA.user.id,
        },
        {
          cropRegionId: cropRegionA.id,
          examStudentId: examStudentB.id,
          status: "correct",
          partialScore: null,
          userId: examA.user.id,
        },
      ])
    ).rejects.toThrow()

    // 正しい1件も書かれない（検査は書き込み前に全件分を見る）
    expect(await testPrisma.questionScore.count()).toBe(0)
  })

  it("確定（ScoreDecision）でも別の試験の受験者は拒否される", async () => {
    const { examA, cropRegionA, examStudentB } = await buildTwoExams()

    await expect(
      upsertScoreDecision({
        cropRegionId: cropRegionA.id,
        examStudentId: examStudentB.id,
        verdict: "correct",
        score: null,
        comment: null,
        decidedByUserId: examA.user.id,
        sourceQuestionScoreId: null,
      })
    ).rejects.toThrow()

    expect(await testPrisma.scoreDecision.count()).toBe(0)
  })

  it("複合回答の採点でも別の試験の受験者は拒否される", async () => {
    const { examA, examStudentB } = await buildTwoExams()

    const examPageA = await testPrisma.examPage.findFirstOrThrow({
      where: { examId: examA.exam.id },
    })
    const compoundAnswerA = await testPrisma.compoundAnswer.create({
      data: {
        examPageId: examPageA.id,
        label: "アイ",
        answerFormat: "multi-digit",
        correctAnswer: "42",
        points: 5,
      },
    })

    await expect(
      upsertCompoundAnswerScore({
        compoundAnswerId: compoundAnswerA.id,
        examStudentId: examStudentB.id,
        userId: examA.user.id,
        status: "correct",
      })
    ).rejects.toThrow(/別の試験/)
    expect(await testPrisma.compoundAnswerScore.count()).toBe(0)
  })
})
