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
  createScoringConflictConfig,
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
  getDataDirectory: () => "/tmp/test-data",
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

    expect(result.success).toBe(true)
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
    data.examData.examStudents = students.map((s) => ({
      id: generateId(),
      examId,
      studentId: s.id!,
      status: "PARTICIPATING",
      customOrder: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: students.map((s) => ({
          importId: s.id!,
          importData: { ...s },
          displayLabel: `${s.lastName}${s.firstName}`,
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

    expect(result.success).toBe(true)

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

    examData.examStudents = [
      {
        id: generateId(),
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
          studentId,
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

    expect(result.success).toBe(true)

    const scores = await prisma.questionScore.findMany({
      where: {
        cropRegion: { examPage: { examId: result.examId! } },
      },
    })
    expect(scores.length).toBe(1)
    expect(scores[0].partialScore).toBeNull()
  })

  // EC-4: DrawingAnnotation付きインポート
  it("EC-4: DrawingAnnotation付きスコアが正常にインポートされる", async () => {
    const examId = generateId()
    const studentId = generateId()
    const studentNumber = `DA_${Date.now()}`
    const scoreId = generateId()

    const examData = createArchiveExamData({
      examId,
      pageCount: 1,
      cropRegionsPerPage: 1,
    })

    examData.examStudents = [
      {
        id: generateId(),
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
      scoresData: {
        questionScores: [
          {
            id: scoreId,
            cropRegionId: regionId,
            studentId,
            status: "correct",
            partialScore: "10",
            userId: currentUser.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        drawingAnnotations: [
          {
            id: generateId(),
            questionScoreId: scoreId,
            type: "circle",
            x: 10,
            y: 20,
            color: "#ff0000",
            strokeWidth: 3,
            width: 30,
            height: 30,
            endX: 0,
            endY: 0,
            lineStyle: "solid",
            text: "",
            fontSize: 16,
            textBoxWidth: 0,
            textBoxHeight: 0,
            horizontalAlign: "left",
            verticalAlign: "top",
            anchorDirection: "top-left",
            displayX: 0,
            displayY: 0,
            isFavorite: false,
            userId: currentUser.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    })

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: [
          { importId: studentId, importData: {}, displayLabel: "DA生徒" },
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

    expect(result.success).toBe(true)

    const annotations = await prisma.drawingAnnotation.findMany({
      where: {
        questionScore: {
          cropRegion: { examPage: { examId: result.examId! } },
        },
      },
    })
    expect(annotations.length).toBe(1)
    expect(annotations[0].type).toBe("circle")
  })

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
    subtotalsData.cropSubtotals = examData.cropRegions.map((r, i) => ({
      id: generateId(),
      cropRegionId: r.id,
      subtotalId:
        subtotalsData.subtotals[i % subtotalsData.subtotals.length].id,
      assignmentType: "auto",
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

    expect(result.success).toBe(true)

    const cropSubtotals = await prisma.cropSubtotal.findMany({
      where: { cropRegion: { examPage: { examId: result.examId! } } },
    })
    expect(cropSubtotals.length).toBe(2)
  })

  // EC-6: 同一アーカイブの2回インポート（冪等性）
  it("EC-6: 同一アーカイブの2回インポートが冪等に動作する", async () => {
    const examId = generateId()
    const studentId = generateId()
    const studentNumber = `IDEMP_${Date.now()}`
    const classId = generateId()
    const className = `Idemp_${Date.now()}`
    const groupId = generateId()
    const groupName = `IdempG_${Date.now()}`

    const examData = createArchiveExamData({
      examId,
      pageCount: 1,
      cropRegionsPerPage: 1,
    })

    examData.examStudents = [
      {
        id: generateId(),
        examId,
        studentId,
        status: "PARTICIPATING",
        customOrder: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    examData.examClasses = [
      {
        id: generateId(),
        examId,
        classId,
        administered: true,
        statistics: true,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    examData.examSubtotalGroups = [
      {
        id: generateId(),
        examId,
        subtotalGroupId: groupId,
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
      classesData: createArchiveClassesData(
        [{ id: classId, name: className }],
        [{ studentId, classId, attendanceNumber: 1 }]
      ),
      subtotalsData: createArchiveSubtotalsData([
        { id: groupId, name: groupName },
      ]),
      scoresData: createArchiveScoresData([
        {
          cropRegionId: regionId,
          studentId,
          status: "correct",
          partialScore: "10",
          userId: currentUser.id,
        },
      ]),
    })

    // 1回目インポート
    const preMatch1 = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: [
          { importId: studentId, importData: {}, displayLabel: "テスト" },
        ],
      }),
      class: createPreMatchingResult({
        noMatch: [
          { importId: classId, importData: {}, displayLabel: className },
        ],
      }),
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

    const result1 = await executeIdIntegrationImport(
      data,
      preMatch1,
      createIdIntegrationConfig(),
      currentUser.id
    )
    expect(result1.success).toBe(true)

    // 2回目インポート（同一データ）
    const preMatch2 = createFileOverviewData({
      student: createPreMatchingResult({
        byId: [
          createMatchedItem({ importId: studentId, existingId: studentId }),
        ],
      }),
      class: createPreMatchingResult({
        byId: [createMatchedItem({ importId: classId, existingId: classId })],
      }),
      subtotalGroup: createPreMatchingResult({
        byId: [createMatchedItem({ importId: groupId, existingId: groupId })],
      }),
      exam: {
        isIdMatch: true,
        importExamId: examId,
        existingExamId: examId,
        importData: {},
        existingData: {},
        displayLabel: "テスト",
      },
    })

    const result2 = await executeIdIntegrationImport(
      data,
      preMatch2,
      createIdIntegrationConfig(),
      currentUser.id
    )

    expect(result2.success).toBe(true)

    // データが重複していないことを確認
    const studentCount = await prisma.student.count({
      where: { id: studentId },
    })
    expect(studentCount).toBe(1)

    const examCount = await prisma.exam.count({
      where: { id: examId },
    })
    expect(examCount).toBe(1)

    const scoreCount = await prisma.questionScore.count({
      where: { cropRegionId: regionId, studentId },
    })
    expect(scoreCount).toBe(1)
  })

  // EC-7: 古いバージョン(1.0.0)アーカイブ変換確認
  it("EC-7: マニフェストの互換バージョンが正しく処理される", async () => {
    // このテストは manifestValidator で検証済みだが、
    // インポートパイプライン全体での互換性を確認
    const examId = generateId()

    const data = createExtractedArchiveData({
      examData: createArchiveExamData({ examId }),
    })
    // 古いバージョンのマニフェストに変更
    data.manifest.version = "1.0.0"

    const preMatch = createFileOverviewData({
      exam: {
        isIdMatch: false,
        importExamId: examId,
        importData: {},
        displayLabel: "旧バージョン",
      },
    })

    // 古いバージョンでもインポート自体は成功する
    // (バージョン変換はarchiveExtractorの後、importerの前で行われる)
    const result = await executeIdIntegrationImport(
      data,
      preMatch,
      createIdIntegrationConfig(),
      currentUser.id
    )

    expect(result.success).toBe(true)
  })

  // EC-8: 手動解決(manual)の採点競合
  it("EC-8: manual戦略で手動解決が正しく適用される", async () => {
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
      },
    })

    const region = await prisma.cropRegion.create({
      data: {
        id: generateId(),
        examPageId: page.id,
        label: "問1",
        type: "QUESTION",
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

    const existingScore = await prisma.questionScore.create({
      data: {
        id: generateId(),
        cropRegionId: region.id,
        studentId,
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

    examData.examStudents = [
      {
        id: generateId(),
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
          studentId,
          status: "incorrect",
          partialScore: "0",
          userId: currentUser.id,
        },
      ]),
    })

    const conflict = createScoringConflict({
      importScoreId: scoreId,
      existingScoreId: existingScore.id,
      cropRegionId: region.id,
      studentId,
      importScore: {
        status: "incorrect",
        partialScore: 0,
        updatedAt: new Date().toISOString(),
      },
      existingScore: {
        status: "correct",
        partialScore: 10,
        updatedAt: new Date().toISOString(),
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

    // manual戦略で "existing" を選択
    const conflictConfig = createScoringConflictConfig({
      strategy: "manual",
      manualResolutions: {
        [scoreId]: "existing",
      },
    })

    const result = await executeIdIntegrationImport(
      data,
      preMatch,
      createIdIntegrationConfig(),
      currentUser.id,
      conflictConfig
    )

    expect(result.success).toBe(true)

    // 既存スコアが保持されている
    const score = await prisma.questionScore.findUnique({
      where: { id: existingScore.id },
    })
    expect(score!.status).toBe("correct")
    expect(Number(score!.partialScore)).toBe(10)
  })
})
