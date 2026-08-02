/**
 * 採点レコード初期化（initializeScoringRecords）統合テスト
 *
 * この経路はテストから一度も呼ばれていなかった。作成行を丸ごと空配列に落としても
 * 全テストが通る状態で、07 採点画面が空になる不具合が素通りする。
 *
 * 既存行の突き合わせは「受験者の内側で閉じる」形（ExamStudent に子として同梱）へ
 * 変えてあるため、既存判定の取りこぼしは重複行として現れる。
 * QuestionScore には (examStudentId, cropRegionId, userId) の unique が無く、
 * DB は重複を止めてくれないので、ここで固定する。
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

import { initializeScoringRecords } from "@/electron-src/lib/prisma/scoringInitializer"

import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

/** 採点行が無い状態の試験を作る（初期化はこの状態から呼ばれる） */
async function createUnscoredExam() {
  return createFullTestExam(testPrisma, { includeScores: false })
}

describe("採点レコードの初期化", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  it("受験者×設問の全ての組み合わせに未採点行を作る", async () => {
    const fixture = await createUnscoredExam()
    const expected = fixture.examStudents.length * fixture.cropRegions.length

    const result = await initializeScoringRecords(fixture.exam.id)

    if (!result.success) throw new Error(result.error)
    expect(result.initialized).toBe(expected)

    const questionScores = await testPrisma.questionScore.findMany({
      where: { examStudent: { examId: fixture.exam.id } },
    })
    expect(questionScores).toHaveLength(expected)
    for (const questionScore of questionScores) {
      expect(questionScore.status).toBe("unscored")
      expect(questionScore.partialScore).toBeNull()
      expect(questionScore.userId).toBe(fixture.user.id)
    }

    // 受験者ごとに全設問ぶん揃っている（取りこぼした受験者が居ない）
    for (const examStudent of fixture.examStudents) {
      const forExamStudent = questionScores.filter(
        (questionScore) => questionScore.examStudentId === examStudent.id
      )
      expect(forExamStudent.map((row) => row.cropRegionId).sort()).toEqual(
        fixture.cropRegions.map((cropRegion) => cropRegion.id).sort()
      )
    }
  })

  it("二度目の実行は1行も作らない（重複行を生まない）", async () => {
    const fixture = await createUnscoredExam()
    const first = await initializeScoringRecords(fixture.exam.id)

    const second = await initializeScoringRecords(fixture.exam.id)

    if (!first.success) throw new Error(first.error)
    if (!second.success) throw new Error(second.error)
    expect(second.initialized).toBe(0)
    const count = await testPrisma.questionScore.count({
      where: { examStudent: { examId: fixture.exam.id } },
    })
    expect(count).toBe(first.initialized)
  })

  it("既に採点済みのセルは作り直さず、判定を保つ", async () => {
    const fixture = await createUnscoredExam()
    const [examStudent] = fixture.examStudents
    const [firstCropRegion] = fixture.cropRegions
    const scored = await testPrisma.questionScore.create({
      data: {
        id: crypto.randomUUID(),
        cropRegionId: firstCropRegion.id,
        examStudentId: examStudent.id,
        userId: fixture.user.id,
        status: "correct",
        partialScore: 10,
      },
    })

    const result = await initializeScoringRecords(fixture.exam.id)

    // 採点済みの1セルを除いた分だけ作られる
    if (!result.success) throw new Error(result.error)
    expect(result.initialized).toBe(
      fixture.examStudents.length * fixture.cropRegions.length - 1
    )
    const rows = await testPrisma.questionScore.findMany({
      where: {
        examStudentId: examStudent.id,
        cropRegionId: firstCropRegion.id,
      },
    })
    // unscored 行を並べて足すと、以降どちらが有効か決められなくなる
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(scored.id)
    expect(rows[0].status).toBe("correct")
  })

  it("設問以外の領域（小計点欄など）には作らない", async () => {
    const fixture = await createUnscoredExam()
    const subtotalRegion = await testPrisma.cropRegion.create({
      data: {
        id: crypto.randomUUID(),
        examPageId: fixture.pages[0].id,
        label: "小計欄",
        type: "SUBTOTAL_SCORE",
        x: 0,
        y: 500,
        width: 100,
        height: 40,
        points: null,
        orderIndex: 99,
      },
    })

    await initializeScoringRecords(fixture.exam.id)

    const rows = await testPrisma.questionScore.findMany({
      where: { cropRegionId: subtotalRegion.id },
    })
    expect(rows).toEqual([])
  })

  it("他の試験の受験者・設問は巻き込まない", async () => {
    const fixture = await createUnscoredExam()
    const other = await createUnscoredExam()

    await initializeScoringRecords(fixture.exam.id)

    const otherRows = await testPrisma.questionScore.findMany({
      where: { examStudent: { examId: other.exam.id } },
    })
    expect(otherRows).toEqual([])
  })

  it("ユーザーが1人も居なければ失敗を返す（誰の名義でも作らない）", async () => {
    const fixture = await createUnscoredExam()
    await testPrisma.userExam.deleteMany({})
    await testPrisma.user.deleteMany({})

    const result = await initializeScoringRecords(fixture.exam.id)

    if (result.success) throw new Error("失敗を返すべき経路が成功した")
    expect(result.error).toBeTruthy()
    const count = await testPrisma.questionScore.count()
    expect(count).toBe(0)
  })
})
