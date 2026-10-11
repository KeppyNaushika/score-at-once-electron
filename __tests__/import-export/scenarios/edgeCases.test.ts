/**
 * エッジケーステスト
 *
 * 境界条件や特殊なシナリオでのインポート動作を検証する
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import {
  createArchiveClassesData,
  createArchiveExamData,
  createArchiveScoresData,
  createArchiveStudentsData,
  createArchiveSubtotalsData,
  createArchiveUsersData,
  createExtractedArchiveData,
  createFileOverviewData,
  createIdIntegrationConfig,
  createMatchedItem,
  createPreMatchingResult,
  createScoringConflict,
  generateId,
} from "../../helpers/testDataFactory"
import {
  cleanupTestDatabase,
  createTestUser,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../../helpers/testPrismaClient"

// Prismaクライアントのモック
vi.mock("../../../electron-src/lib/prisma/client", () => {
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

vi.mock("../../../electron-src/lib/dataManager", () => ({
  getSharedFilesDirectory: () => "/tmp/test-data",
}))

vi.mock("../../../electron-src/lib/import/merge/imageImporter", () => ({
  copyImportImages: vi.fn().mockResolvedValue(undefined),
  createImportImageRecords: vi.fn().mockResolvedValue(undefined),
}))

import { executeIdIntegrationImport } from "../../../electron-src/lib/import/merge/idIntegrationImporter"

const prisma = getTestPrismaClient()

describe("edgeCases", () => {
  let currentUser: { id: string; username: string; name: string }

  beforeEach(async () => {
    await cleanupTestDatabase()
    currentUser = await createTestUser()
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  // EC-1: 空試験（生徒・スコアなし）のインポート
  it("EC-1: 空試験（生徒・スコアなし）が正常にインポートされる", async () => {
    const examId = generateId()
    const data = createExtractedArchiveData({
      examData: createArchiveExamData({
        examId,
        pageCount: 1,
        cropRegionsPerPage: 0,
      }),
      studentsData: createArchiveStudentsData(),
      classesData: createArchiveClassesData(),
      usersData: createArchiveUsersData([{ id: generateId() }]),
      subtotalsData: createArchiveSubtotalsData(),
      scoresData: createArchiveScoresData(),
    })

    const preMatch = createFileOverviewData({
      exam: {
        isIdMatch: false,
        importExamId: examId,
        importData: {},
        displayLabel: "空試験",
      },
    })

    const result = await executeIdIntegrationImport(
      data,
      preMatch,
      createIdIntegrationConfig(),
      currentUser.id
    )

    expect(result.examId).toBeDefined()

    const exam = await prisma.exam.findUnique({
      where: { id: result.examId! },
    })
    expect(exam).not.toBeNull()
  })

  // EC-2: 100人以上の生徒のインポート
  it("EC-2: 100人以上の生徒が正常にインポートされる", async () => {
    const examId = generateId()
    const studentCount = 110
    const students = Array.from({ length: studentCount }, (_, i) => ({
      id: generateId(),
      studentNumber: `BULK_${i}_${Date.now()}`,
      lastName: `姓${i}`,
      firstName: `名${i}`,
    }))

    const data = createExtractedArchiveData({
      examData: createArchiveExamData({
        examId,
        pageCount: 1,
        cropRegionsPerPage: 1,
      }),
      studentsData: createArchiveStudentsData(students),
      classesData: createArchiveClassesData(),
      usersData: createArchiveUsersData([{ id: generateId() }]),
      subtotalsData: createArchiveSubtotalsData(),
      scoresData: createArchiveScoresData(),
    })

    // ExamStudentを追加
    data.examData.examStudents = students.map((student) => ({
      id: generateId(),
      examId,
      studentId: student.id!,
      status: "PARTICIPATING",
      customOrder: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: students.map((student) => ({
          importId: student.id!,
          importData: { ...student },
          displayLabel: `${student.lastName}${student.firstName}`,
        })),
      }),
      exam: {
        isIdMatch: false,
        importExamId: examId,
        importData: {},
        displayLabel: "大規模テスト",
      },
    })

    const result = await executeIdIntegrationImport(
      data,
      preMatch,
      createIdIntegrationConfig(),
      currentUser.id
    )

    const dbStudentCount = await prisma.examStudent.count({
      where: { examId: result.examId! },
    })
    expect(dbStudentCount).toBe(studentCount)
  })

  // EC-3: partialScore=nullのスコアインポート
  it("EC-3: partialScore=nullのスコアが正常にインポートされる", async () => {
    const examId = generateId()
    const studentId = generateId()
    const studentNumber = `NULL_SCORE_${Date.now()}`

    const examData = createArchiveExamData({
      examId,
      pageCount: 1,
      cropRegionsPerPage: 1,
    })

    const examStudentId = generateId()
    examData.examStudents = [
      {
        id: examStudentId,
        examId,
        studentId,
        status: "PARTICIPATING",
        customOrder: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    const regionId = examData.cropRegions[0].id

    const data = createExtractedArchiveData({
      examData,
      studentsData: createArchiveStudentsData([
        { id: studentId, studentNumber },
      ]),
      scoresData: createArchiveScoresData([
        {
          cropRegionId: regionId,
          examStudentId,
          status: "unscored",
          partialScore: null,
          userId: currentUser.id,
        },
      ]),
    })

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: [
          {
            importId: studentId,
            importData: {},
            displayLabel: "nullスコア生徒",
          },
        ],
      }),
      exam: {
        isIdMatch: false,
        importExamId: examId,
        importData: {},
        displayLabel: "テスト",
      },
    })

    const result = await executeIdIntegrationImport(
      data,
      preMatch,
      createIdIntegrationConfig(),
      currentUser.id
    )

    const scores = await prisma.questionScore.findMany({
      where: {
        cropRegion: { examPage: { examId: result.examId! } },
      },
    })
    expect(scores.length).toBe(1)
    expect(scores[0].partialScore).toBeNull()
  })

  // EC-4（注釈の取り込み）は idIntegrationImporter.test.ts の II-26 へ統合したので欠番

  // EC-5: CropSubtotalsの正しいリンク
  it("EC-5: CropSubtotalsが正しくリンクされる", async () => {
    const examId = generateId()
    const groupId = generateId()
    const groupName = `CST_${Date.now()}`

    const subtotalsData = createArchiveSubtotalsData([
      {
        id: groupId,
        name: groupName,
        subtotals: [{ name: "前半" }, { name: "後半" }],
      },
    ])

    const examData = createArchiveExamData({
      examId,
      pageCount: 1,
      cropRegionsPerPage: 2,
    })

    examData.examSubtotalGroups = [
      {
        id: generateId(),
        examId,
        subtotalGroupId: groupId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    // CropSubtotalsを追加
    subtotalsData.cropSubtotals = examData.cropRegions.map((cropRegion, i) => ({
      id: generateId(),
      cropRegionId: cropRegion.id,
      subtotalId:
        subtotalsData.subtotals[i % subtotalsData.subtotals.length].id,
      assignmentType: "QUESTION_ASSIGNMENT",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))

    const data = createExtractedArchiveData({
      examData,
      subtotalsData,
    })

    const preMatch = createFileOverviewData({
      subtotalGroup: createPreMatchingResult({
        noMatch: [
          { importId: groupId, importData: {}, displayLabel: groupName },
        ],
      }),
      exam: {
        isIdMatch: false,
        importExamId: examId,
        importData: {},
        displayLabel: "テスト",
      },
    })

    const result = await executeIdIntegrationImport(
      data,
      preMatch,
      createIdIntegrationConfig(),
      currentUser.id
    )

    const cropSubtotals = await prisma.cropSubtotal.findMany({
      where: { cropRegion: { examPage: { examId: result.examId! } } },
    })
    expect(cropSubtotals.length).toBe(2)
  })

  // EC-6（2回目の取り込みの冪等）は idIntegrationImporter.test.ts の II-16 / II-17 へ統合、
  // EC-7（展開後に manifest.version を書き換えても変換は走らず、何も検査していなかった）は削除したので欠番

  // EC-8: 上書きは採点の時刻を見ない
  it("EC-8: 上書きを選ぶと、ファイルの採点が古くてもファイルの採点になる", async () => {
    const examId = generateId()
    const studentId = generateId()
    const studentNumber = `MANUAL_${Date.now()}`
    const scoreId = generateId()

    // まず既存データを作成
    await prisma.student.create({
      data: {
        id: studentId,
        studentNumber,
        lastName: "手動",
        firstName: "解決",
        lastNameKana: "シュドウ",
        firstNameKana: "カイケツ",
      },
    })

    await prisma.exam.create({
      data: { id: examId, examName: "手動解決テスト" },
    })

    await prisma.userExam.create({
      data: {
        id: generateId(),
        userId: currentUser.id,
        examId,
        role: "OWNER",
      },
    })

    const page = await prisma.examPage.create({
      data: {
        id: generateId(),
        examId,
        pageNumber: 1,
        imagePath: "",
      },
    })

    const region = await prisma.cropRegion.create({
      data: {
        id: generateId(),
        examPageId: page.id,
        label: "問1",
        type: "QUESTION_ANSWER",
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        points: 10,
        orderIndex: 0,
      },
    })

    await prisma.examStudent.create({
      data: {
        id: generateId(),
        examId,
        studentId,
        status: "PARTICIPATING",
      },
    })

    const existingExamStudent = await prisma.examStudent.findUniqueOrThrow({
      where: { examId_studentId: { examId, studentId } },
      select: { id: true },
    })
    const existingScore = await prisma.questionScore.create({
      data: {
        id: generateId(),
        cropRegionId: region.id,
        examStudentId: existingExamStudent.id,
        userId: currentUser.id,
        status: "correct",
        partialScore: 10,
      },
    })

    // インポートデータを準備
    const examData = createArchiveExamData({
      examId,
      pageCount: 1,
      cropRegionsPerPage: 1,
    })
    // 既存のpage/regionのIDを使う
    examData.examPages[0].id = page.id
    examData.cropRegions[0].id = region.id
    examData.cropRegions[0].examPageId = page.id

    const examStudentId = generateId()
    examData.examStudents = [
      {
        id: examStudentId,
        examId,
        studentId,
        status: "PARTICIPATING",
        customOrder: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    const data = createExtractedArchiveData({
      examData,
      studentsData: createArchiveStudentsData([
        { id: studentId, studentNumber },
      ]),
      scoresData: createArchiveScoresData([
        {
          id: scoreId,
          cropRegionId: region.id,
          examStudentId,
          status: "incorrect",
          partialScore: "0",
          userId: currentUser.id,
        },
      ]),
    })

    // ファイルの採点を、このPCの採点より前に書かれたものにする。
    // 統合なら負ける側なので、置き換わるのは「上書きする」が時刻を見ないときだけ
    data.scoresData.questionScores[0].updatedAt = new Date(
      "2000-01-01T00:00:00.000Z"
    ).toISOString()

    // 事前照合の競合一覧は確認画面に件数を見せるためのもので、取り込みの判断には使われない
    const conflict = createScoringConflict({
      importScoreId: scoreId,
      existingScoreId: existingScore.id,
      cropRegionId: region.id,
      studentId,
      importScore: {
        status: "incorrect",
        partialScore: 0,
        updatedAt: new Date("2000-01-01").toISOString(),
      },
      existingScore: {
        status: "correct",
        partialScore: 10,
        updatedAt: new Date("2025-07-01").toISOString(),
      },
    })

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        byId: [
          createMatchedItem({
            importId: studentId,
            existingId: studentId,
          }),
        ],
      }),
      exam: {
        isIdMatch: true,
        importExamId: examId,
        existingExamId: examId,
        importData: {},
        existingData: {},
        displayLabel: "テスト",
      },
      scoringConflicts: {
        conflicts: [conflict],
        conflictCount: 1,
        newCount: 0,
        unchangedCount: 0,
      },
    })

    await executeIdIntegrationImport(
      data,
      preMatch,
      createIdIntegrationConfig({ exam: "overwrite" }),
      currentUser.id
    )

    // ファイルの採点で置き換わっている
    const score = await prisma.questionScore.findUnique({
      where: { id: existingScore.id },
    })
    expect(score!.status).toBe("incorrect")
    expect(Number(score!.partialScore)).toBe(0)
    // 置き換えた行の updatedAt は取り込み時刻（アーカイブの古い時刻ではない）
    expect(score!.updatedAt.getTime()).toBeGreaterThan(
      new Date("2000-01-01T00:00:00.000Z").getTime()
    )
  })
})
