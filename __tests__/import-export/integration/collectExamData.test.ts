/**
 * collectExamData の統合テスト
 *
 * テスト対象: electron-src/lib/export/exam-archive/dataCollector.ts
 * 実際のSQLiteテスト用DBを使用し、エクスポートデータ収集を検証する
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import { generateId } from "../../helpers/testDataFactory"
import {
  createFullTestExam,
  type FullTestExam,
} from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../../helpers/testPrismaClient"

// Prismaクライアントのモック: Electron依存を回避
vi.mock("../../../electron-src/lib/prisma/client", () => {
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

// dataManagerのモック
vi.mock("../../../electron-src/lib/dataManager", () => {
  return {
    getDataDirectory: () => "/tmp/test-data",
  }
})

import { collectExamData } from "../../../electron-src/lib/export/exam-archive/dataCollector"

const prisma = getTestPrismaClient()

describe("collectExamData", () => {
  let testExam: FullTestExam

  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  // DC-1: 全エンティティ型を含む試験のデータ収集
  it("DC-1: 全エンティティ型を含む試験のデータが収集される", async () => {
    testExam = await createFullTestExam(prisma, {
      pageCount: 2,
      cropRegionsPerPage: 2,
      studentCount: 3,
      includeV140Data: true,
      includeScores: true,
      includeMasterImages: true,
      includeStudentAnswerImages: true,
    })

    const result = await collectExamData(testExam.exam.id, testExam.user.id)

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()

    const data = result.data!
    expect(data.examData.exam.id).toBe(testExam.exam.id)
    expect(data.examData.examPages.length).toBe(2)
    expect(data.examData.cropRegions.length).toBe(4)
    expect(data.studentsData.students.length).toBe(3)
    expect(data.classesData.classrooms.length).toBeGreaterThanOrEqual(1)
    expect(data.classesData.memberships.length).toBe(3)
    expect(data.usersData.users.length).toBe(1)
    expect(data.subtotalsData.subtotalGroups.length).toBe(1)
    expect(data.subtotalsData.subtotals.length).toBe(2)
    expect(data.scoresData.questionScores.length).toBe(12) // 4 regions × 3 students
    expect(data.masterImagePaths.length).toBe(2)
    expect(data.answerSheetPaths.length).toBe(6) // 3 students × 2 pages

    // 模範解答画像はページが持つ（v1.23.0 で masterImages セクションを畳んだ）
    expect(data.examData.examPages[0]).toMatchObject({
      pageNumber: 1,
      imagePath: `exams/${testExam.exam.id}/master-images/page1.png`,
      pageSize: "A4",
    })
    expect(data.examData).not.toHaveProperty("masterImages")
  })

  // DC-2: 現在ユーザーのスコアのみ収集される
  it("DC-2: 現在ユーザーの採点データのみ収集される", async () => {
    testExam = await createFullTestExam(prisma, {
      studentCount: 1,
      pageCount: 1,
      cropRegionsPerPage: 1,
    })

    // 別のユーザーを作成してスコアを追加
    const otherUser = await prisma.user.create({
      data: {
        id: generateId(),
        username: `other_${Date.now()}`,
        name: "他ユーザー",
        role: "teacher",
      },
    })

    await prisma.questionScore.create({
      data: {
        id: generateId(),
        cropRegionId: testExam.cropRegions[0].id,
        examStudentId: testExam.examStudents[0].id,
        userId: otherUser.id,
        status: "incorrect",
        partialScore: 0,
      },
    })

    const result = await collectExamData(testExam.exam.id, testExam.user.id)

    expect(result.success).toBe(true)
    // テストユーザーのスコアのみ（1つ）
    expect(result.data!.scoresData.questionScores.length).toBe(1)
    expect(result.data!.scoresData.questionScores[0].userId).toBe(
      testExam.user.id
    )
  })

  // DC-3: 現在ユーザーのアノテーションのみ収集される
  it("DC-3: 現在ユーザーのアノテーションのみ収集される", async () => {
    testExam = await createFullTestExam(prisma, {
      studentCount: 1,
      pageCount: 1,
      cropRegionsPerPage: 1,
      includeAnnotations: true,
    })

    const result = await collectExamData(testExam.exam.id, testExam.user.id)

    expect(result.success).toBe(true)
    // アノテーションは全てテストユーザーのもの
    for (const annotation of result.data!.scoresData.drawingAnnotations) {
      expect(annotation.userId).toBe(testExam.user.id)
    }
  })

  // DC-4: 存在しない試験IDでエラー
  it("DC-4: 存在しない試験IDでエラーが返る", async () => {
    testExam = await createFullTestExam(prisma)
    const result = await collectExamData(
      "non-existent-exam-id",
      testExam.user.id
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain("試験が見つかりません")
  })

  // DC-5: 存在しないユーザーIDでエラー
  it("DC-5: 存在しないユーザーIDでエラーが返る", async () => {
    testExam = await createFullTestExam(prisma)
    const result = await collectExamData(
      testExam.exam.id,
      "non-existent-user-id"
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain("ユーザーが見つかりません")
  })

  // DC-6: countsが実データ長と一致
  it("DC-6: countsが実データの件数と一致する", async () => {
    testExam = await createFullTestExam(prisma, {
      pageCount: 2,
      cropRegionsPerPage: 2,
      studentCount: 2,
      includeMasterImages: true,
      includeStudentAnswerImages: true,
    })

    const result = await collectExamData(testExam.exam.id, testExam.user.id)

    expect(result.success).toBe(true)
    const { data } = result

    expect(data!.counts.students).toBe(data!.studentsData.students.length)
    expect(data!.counts.classrooms).toBe(data!.classesData.classrooms.length)
    expect(data!.counts.users).toBe(data!.usersData.users.length)
    expect(data!.counts.pages).toBe(data!.examData.examPages.length)
    expect(data!.counts.regions).toBe(data!.examData.cropRegions.length)
    expect(data!.counts.scores).toBe(data!.scoresData.questionScores.length)
    expect(data!.counts.annotations).toBe(
      data!.scoresData.drawingAnnotations.length
    )
    expect(data!.counts.subtotalGroups).toBe(
      data!.subtotalsData.subtotalGroups.length
    )
    expect(data!.counts.masterImages).toBe(data!.masterImagePaths.length)
    expect(data!.counts.answerSheetImages).toBe(data!.answerSheetPaths.length)
  })

  // DC-7: 日時がISO8601文字列でシリアライズ
  it("DC-7: 日時がISO8601文字列でシリアライズされる", async () => {
    testExam = await createFullTestExam(prisma, {
      studentCount: 1,
      pageCount: 1,
      cropRegionsPerPage: 1,
    })

    const result = await collectExamData(testExam.exam.id, testExam.user.id)

    expect(result.success).toBe(true)
    const data = result.data!

    // ISO8601形式の検証
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
    expect(data.examData.exam.createdAt).toMatch(iso8601Regex)
    expect(data.examData.exam.updatedAt).toMatch(iso8601Regex)
    expect(data.studentsData.students[0].createdAt).toMatch(iso8601Regex)
    expect(data.scoresData.questionScores[0].createdAt).toMatch(iso8601Regex)
  })

  // DC-8: partialScoreが文字列でシリアライズ
  it("DC-8: partialScoreが文字列でシリアライズされる", async () => {
    testExam = await createFullTestExam(prisma, {
      studentCount: 1,
      pageCount: 1,
      cropRegionsPerPage: 1,
    })

    const result = await collectExamData(testExam.exam.id, testExam.user.id)

    expect(result.success).toBe(true)
    const score = result.data!.scoresData.questionScores[0]

    // Decimal → stringでシリアライズ
    if (score.partialScore !== null) {
      expect(typeof score.partialScore).toBe("string")
    }
  })

  // DC-9: v1.4.0データ (ExamMarkingFormat等) が収集される
  it("DC-9: v1.4.0データが収集される", async () => {
    testExam = await createFullTestExam(prisma, {
      includeV140Data: true,
    })

    const result = await collectExamData(testExam.exam.id, testExam.user.id)

    expect(result.success).toBe(true)
    const data = result.data!

    expect(data.examData.answerOverlayStyles!.length).toBeGreaterThan(0)
  })

  // DC-10: Tag/TagSubtotalGroupデータの収集
  it("DC-10: Tag/TagSubtotalGroupデータが収集される", async () => {
    testExam = await createFullTestExam(prisma, {
      includeV140Data: true,
    })

    const result = await collectExamData(testExam.exam.id, testExam.user.id)

    expect(result.success).toBe(true)
    const data = result.data!

    expect(data.tagsData.tags.length).toBeGreaterThan(0)
    expect(data.tagsData.tagSubtotalGroups.length).toBeGreaterThan(0)
  })

  // DC-11: 画像パスが相対パスで取得される
  it("DC-11: 画像パスが相対パスで取得される", async () => {
    testExam = await createFullTestExam(prisma, {
      includeMasterImages: true,
      includeStudentAnswerImages: true,
    })

    const result = await collectExamData(testExam.exam.id, testExam.user.id)

    expect(result.success).toBe(true)
    const data = result.data!

    for (const masterImagePath of data.masterImagePaths) {
      expect(masterImagePath).toContain("exams/")
      expect(masterImagePath).not.toMatch(/^\//) // 絶対パスではない
    }
    for (const answerSheetPath of data.answerSheetPaths) {
      expect(answerSheetPath).toContain("exams/")
      expect(answerSheetPath).not.toMatch(/^\//)
    }
  })

  // DC-12: Classがメンバーシップ経由で収集される
  it("DC-12: Classがメンバーシップ経由で収集される", async () => {
    testExam = await createFullTestExam(prisma, {
      studentCount: 2,
    })

    const result = await collectExamData(testExam.exam.id, testExam.user.id)

    expect(result.success).toBe(true)
    const data = result.data!

    // 学級が含まれている
    expect(data.classesData.classrooms.length).toBeGreaterThanOrEqual(1)

    // メンバーシップが学級と生徒を結びつけている
    expect(data.classesData.memberships.length).toBe(2)
    for (const membership of data.classesData.memberships) {
      const classroomMatch = data.classesData.classrooms.find(
        (classroom) => classroom.id === membership.classroomId
      )
      expect(classroomMatch).toBeDefined()
    }
  })
})
