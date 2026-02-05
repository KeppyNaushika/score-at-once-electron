/**
 * collectProjectData の統合テスト
 *
 * テスト対象: electron-src/lib/export/project-archive/dataCollector.ts
 * 実際のSQLiteテスト用DBを使用し、エクスポートデータ収集を検証する
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import { generateId } from "../../helpers/testDataFactory"
import {
  cleanupTestDatabase,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../../helpers/testPrismaClient"
import {
  createFullTestProject,
  type FullTestProject,
} from "../../helpers/testProjectBuilder"

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

import { collectProjectData } from "../../../electron-src/lib/export/project-archive/dataCollector"

const prisma = getTestPrismaClient()

describe("collectProjectData", () => {
  let testProject: FullTestProject

  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  // DC-1: 全エンティティ型を含むプロジェクトのデータ収集
  it("DC-1: 全エンティティ型を含むプロジェクトのデータが収集される", async () => {
    testProject = await createFullTestProject(prisma, {
      pageCount: 2,
      cropRegionsPerPage: 2,
      studentCount: 3,
      includeV140Data: true,
      includeScores: true,
      includeMasterImages: true,
      includeStudentAnswerImages: true,
    })

    const result = await collectProjectData(
      testProject.project.id,
      testProject.user.id
    )

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()

    const data = result.data!
    expect(data.projectData.project.id).toBe(testProject.project.id)
    expect(data.projectData.projectPages.length).toBe(2)
    expect(data.projectData.cropRegions.length).toBe(4)
    expect(data.studentsData.students.length).toBe(3)
    expect(data.classesData.classes.length).toBeGreaterThanOrEqual(1)
    expect(data.classesData.memberships.length).toBe(3)
    expect(data.usersData.users.length).toBe(1)
    expect(data.subtotalsData.subtotalGroups.length).toBe(1)
    expect(data.subtotalsData.subtotals.length).toBe(2)
    expect(data.scoresData.questionScores.length).toBe(12) // 4 regions × 3 students
    expect(data.masterImagePaths.length).toBe(2)
    expect(data.answerSheetPaths.length).toBe(6) // 3 students × 2 pages
  })

  // DC-2: 現在ユーザーのスコアのみ収集される
  it("DC-2: 現在ユーザーの採点データのみ収集される", async () => {
    testProject = await createFullTestProject(prisma, {
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
        cropRegionId: testProject.cropRegions[0].id,
        studentId: testProject.students[0].id,
        userId: otherUser.id,
        status: "incorrect",
        partialScore: 0,
      },
    })

    const result = await collectProjectData(
      testProject.project.id,
      testProject.user.id
    )

    expect(result.success).toBe(true)
    // テストユーザーのスコアのみ（1つ）
    expect(result.data!.scoresData.questionScores.length).toBe(1)
    expect(result.data!.scoresData.questionScores[0].userId).toBe(
      testProject.user.id
    )
  })

  // DC-3: 現在ユーザーのアノテーションのみ収集される
  it("DC-3: 現在ユーザーのアノテーションのみ収集される", async () => {
    testProject = await createFullTestProject(prisma, {
      studentCount: 1,
      pageCount: 1,
      cropRegionsPerPage: 1,
      includeAnnotations: true,
    })

    const result = await collectProjectData(
      testProject.project.id,
      testProject.user.id
    )

    expect(result.success).toBe(true)
    // アノテーションは全てテストユーザーのもの
    for (const ann of result.data!.scoresData.drawingAnnotations) {
      expect(ann.userId).toBe(testProject.user.id)
    }
  })

  // DC-4: 存在しないプロジェクトIDでエラー
  it("DC-4: 存在しないプロジェクトIDでエラーが返る", async () => {
    testProject = await createFullTestProject(prisma)
    const result = await collectProjectData(
      "non-existent-project-id",
      testProject.user.id
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain("プロジェクトが見つかりません")
  })

  // DC-5: 存在しないユーザーIDでエラー
  it("DC-5: 存在しないユーザーIDでエラーが返る", async () => {
    testProject = await createFullTestProject(prisma)
    const result = await collectProjectData(
      testProject.project.id,
      "non-existent-user-id"
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain("ユーザーが見つかりません")
  })

  // DC-6: countsが実データ長と一致
  it("DC-6: countsが実データの件数と一致する", async () => {
    testProject = await createFullTestProject(prisma, {
      pageCount: 2,
      cropRegionsPerPage: 2,
      studentCount: 2,
      includeMasterImages: true,
      includeStudentAnswerImages: true,
    })

    const result = await collectProjectData(
      testProject.project.id,
      testProject.user.id
    )

    expect(result.success).toBe(true)
    const { data } = result

    expect(data!.counts.students).toBe(data!.studentsData.students.length)
    expect(data!.counts.classes).toBe(data!.classesData.classes.length)
    expect(data!.counts.users).toBe(data!.usersData.users.length)
    expect(data!.counts.pages).toBe(data!.projectData.projectPages.length)
    expect(data!.counts.regions).toBe(data!.projectData.cropRegions.length)
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
    testProject = await createFullTestProject(prisma, {
      studentCount: 1,
      pageCount: 1,
      cropRegionsPerPage: 1,
    })

    const result = await collectProjectData(
      testProject.project.id,
      testProject.user.id
    )

    expect(result.success).toBe(true)
    const data = result.data!

    // ISO8601形式の検証
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
    expect(data.projectData.project.createdAt).toMatch(iso8601Regex)
    expect(data.projectData.project.updatedAt).toMatch(iso8601Regex)
    expect(data.studentsData.students[0].createdAt).toMatch(iso8601Regex)
    expect(data.scoresData.questionScores[0].createdAt).toMatch(iso8601Regex)
  })

  // DC-8: partialScoreが文字列でシリアライズ
  it("DC-8: partialScoreが文字列でシリアライズされる", async () => {
    testProject = await createFullTestProject(prisma, {
      studentCount: 1,
      pageCount: 1,
      cropRegionsPerPage: 1,
    })

    const result = await collectProjectData(
      testProject.project.id,
      testProject.user.id
    )

    expect(result.success).toBe(true)
    const score = result.data!.scoresData.questionScores[0]

    // Decimal → stringでシリアライズ
    if (score.partialScore !== null) {
      expect(typeof score.partialScore).toBe("string")
    }
  })

  // DC-9: v1.4.0データ (ProjectMarkingFormat等) が収集される
  it("DC-9: v1.4.0データが収集される", async () => {
    testProject = await createFullTestProject(prisma, {
      includeV140Data: true,
    })

    const result = await collectProjectData(
      testProject.project.id,
      testProject.user.id
    )

    expect(result.success).toBe(true)
    const data = result.data!

    expect(data.projectData.projectMarkingFormats).toBeDefined()
    expect(data.projectData.projectMarkingFormats!.length).toBeGreaterThan(0)

    expect(data.projectData.projectExportSettings).toBeDefined()
    expect(data.projectData.projectExportSettings!.settingsJson).toContain(
      "includeImages"
    )

    expect(data.projectData.cropRegionMarkingOverrides).toBeDefined()
    expect(data.projectData.cropRegionMarkingOverrides!.length).toBeGreaterThan(
      0
    )
  })

  // DC-10: Subject/SubjectSubtotalGroupデータの収集
  it("DC-10: Subject/SubjectSubtotalGroupデータが収集される", async () => {
    testProject = await createFullTestProject(prisma, {
      includeV140Data: true,
    })

    const result = await collectProjectData(
      testProject.project.id,
      testProject.user.id
    )

    expect(result.success).toBe(true)
    const data = result.data!

    expect(data.subjectsData.subjects.length).toBeGreaterThan(0)
    expect(data.subjectsData.subjectSubtotalGroups.length).toBeGreaterThan(0)
  })

  // DC-11: 画像パスが相対パスで取得される
  it("DC-11: 画像パスが相対パスで取得される", async () => {
    testProject = await createFullTestProject(prisma, {
      includeMasterImages: true,
      includeStudentAnswerImages: true,
    })

    const result = await collectProjectData(
      testProject.project.id,
      testProject.user.id
    )

    expect(result.success).toBe(true)
    const data = result.data!

    for (const p of data.masterImagePaths) {
      expect(p).toContain("projects/")
      expect(p).not.toMatch(/^\//) // 絶対パスではない
    }
    for (const p of data.answerSheetPaths) {
      expect(p).toContain("projects/")
      expect(p).not.toMatch(/^\//)
    }
  })

  // DC-12: Classがメンバーシップ経由で収集される
  it("DC-12: Classがメンバーシップ経由で収集される", async () => {
    testProject = await createFullTestProject(prisma, {
      studentCount: 2,
    })

    const result = await collectProjectData(
      testProject.project.id,
      testProject.user.id
    )

    expect(result.success).toBe(true)
    const data = result.data!

    // 学級が含まれている
    expect(data.classesData.classes.length).toBeGreaterThanOrEqual(1)

    // メンバーシップが学級と生徒を結びつけている
    expect(data.classesData.memberships.length).toBe(2)
    for (const m of data.classesData.memberships) {
      const classMatch = data.classesData.classes.find(
        (c) => c.id === m.classId
      )
      expect(classMatch).toBeDefined()
    }
  })
})
