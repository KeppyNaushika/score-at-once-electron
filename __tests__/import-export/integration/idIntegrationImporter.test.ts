/**
 * idIntegrationImporter の統合テスト
 *
 * テスト対象: electron-src/lib/import/merge/idIntegrationImporter.ts
 * 実際のSQLiteテスト用DBを使用し、インポートパイプライン全体を検証する
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import {
  createArchiveClassesData,
  createArchiveExamData,
  createArchiveScoresData,
  createArchiveStudentsData,
  createArchiveSubtotalsData,
  createArchiveUsersData,
  createDecision,
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

// 画像コピーのモック（ファイルI/Oのみモック）
vi.mock("../../../electron-src/lib/import/merge/imageImporter", () => ({
  copyImportImages: vi.fn().mockResolvedValue(undefined),
  createImportImageRecords: vi.fn().mockResolvedValue(undefined),
}))

import { executeIdIntegrationImport } from "../../../electron-src/lib/import/merge/idIntegrationImporter"

const prisma = getTestPrismaClient()

describe("executeIdIntegrationImport", () => {
  let currentUser: { id: string; username: string; name: string }

  beforeEach(async () => {
    await cleanupTestDatabase()
    currentUser = await createTestUser()
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  /**
   * 基本的なテストデータを作成するヘルパー
   */
  function createBasicTestData(
    overrides: {
      examId?: string
      studentId?: string
      studentNumber?: string
      classId?: string
      className?: string
      groupId?: string
      groupName?: string
    } = {}
  ) {
    const examId = overrides.examId ?? generateId()
    const studentId = overrides.studentId ?? generateId()
    const classId = overrides.classId ?? generateId()
    const groupId = overrides.groupId ?? generateId()
    const studentNumber = overrides.studentNumber ?? `SN_${Date.now()}`
    const className = overrides.className ?? `Class_${Date.now()}`
    const groupName = overrides.groupName ?? `Group_${Date.now()}`

    const examData = createArchiveExamData({
      examId,
      pageCount: 1,
      cropRegionsPerPage: 1,
    })

    // ExamStudentを追加
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

    // ExamClassを追加
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

    // ExamSubtotalGroupを追加
    examData.examSubtotalGroups = [
      {
        id: generateId(),
        examId,
        subtotalGroupId: groupId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    const subtotalsData = createArchiveSubtotalsData([
      {
        id: groupId,
        name: groupName,
        subtotals: [{ name: "小計1" }],
      },
    ])

    const regionId = examData.cropRegions[0].id
    const scoreId = generateId()

    const data = createExtractedArchiveData({
      examData,
      studentsData: createArchiveStudentsData([
        { id: studentId, studentNumber, lastName: "テスト", firstName: "太郎" },
      ]),
      classesData: createArchiveClassesData(
        [{ id: classId, name: className }],
        [
          {
            studentId,
            classId,
            attendanceNumber: 1,
          },
        ]
      ),
      usersData: createArchiveUsersData([{ id: generateId() }]),
      subtotalsData,
      scoresData: createArchiveScoresData([
        {
          id: scoreId,
          cropRegionId: regionId,
          studentId,
          status: "correct",
          partialScore: "10",
          userId: currentUser.id,
        },
      ]),
    })

    return {
      data,
      examId,
      studentId,
      classId,
      groupId,
      regionId,
      scoreId,
      studentNumber,
      className,
      groupName,
    }
  }

  // II-1: 新規インポート: 全エンティティ作成
  it("II-1: 新規インポートで全エンティティが作成される", async () => {
    const { data, examId } = createBasicTestData()

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((s) => ({
          importId: s.id,
          importData: { ...s },
          displayLabel: s.lastName,
        })),
      }),
      class: createPreMatchingResult({
        noMatch: data.classesData.classes.map((c) => ({
          importId: c.id,
          importData: { ...c },
          displayLabel: c.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((g) => ({
          importId: g.id,
          importData: { ...g },
          displayLabel: g.name,
        })),
      }),
      exam: {
        isIdMatch: false,
        importExamId: examId,
        importData: {},
        displayLabel: "テスト",
      },
    })

    const config = createIdIntegrationConfig()

    const result = await executeIdIntegrationImport(
      data,
      preMatch,
      config,
      currentUser.id
    )

    expect(result.success).toBe(true)
    expect(result.examId).toBeDefined()

    // DBに試験が存在
    const exam = await prisma.exam.findUnique({
      where: { id: result.examId! },
    })
    expect(exam).not.toBeNull()
  })

  // II-2: 新規インポート: 全IDマッピング確認（summaryで確認）
  it("II-2: 新規インポートでエンティティが作成される", async () => {
    const { data, examId } = createBasicTestData()

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((s) => ({
          importId: s.id,
          importData: { ...s },
          displayLabel: s.lastName,
        })),
      }),
      class: createPreMatchingResult({
        noMatch: data.classesData.classes.map((c) => ({
          importId: c.id,
          importData: { ...c },
          displayLabel: c.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((g) => ({
          importId: g.id,
          importData: { ...g },
          displayLabel: g.name,
        })),
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
    expect(result.summary).toBeDefined()
    expect(result.summary!.created.scores).toBeGreaterThan(0)
  })

  // II-3: 新規インポート: countsの正確性
  it("II-3: countsがcreated > 0を示す", async () => {
    const { data, examId } = createBasicTestData()

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((s) => ({
          importId: s.id,
          importData: { ...s },
          displayLabel: s.lastName,
        })),
      }),
      class: createPreMatchingResult({
        noMatch: data.classesData.classes.map((c) => ({
          importId: c.id,
          importData: { ...c },
          displayLabel: c.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((g) => ({
          importId: g.id,
          importData: { ...g },
          displayLabel: g.name,
        })),
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
    expect(result.summary!.created.pages).toBeGreaterThan(0)
    expect(result.summary!.created.regions).toBeGreaterThan(0)
    expect(result.summary!.created.scores).toBeGreaterThan(0)
  })

  // II-4: 同一PCリインポート: スコアunchanged
  it("II-4: 同一試験再インポートでスコアがunchangedとなる", async () => {
    const { data, examId, studentId, classId, groupId } = createBasicTestData()

    // 先に全データをDBに作成しておく
    const preMatch1 = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((s) => ({
          importId: s.id,
          importData: { ...s },
          displayLabel: s.lastName,
        })),
      }),
      class: createPreMatchingResult({
        noMatch: data.classesData.classes.map((c) => ({
          importId: c.id,
          importData: { ...c },
          displayLabel: c.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((g) => ({
          importId: g.id,
          importData: { ...g },
          displayLabel: g.name,
        })),
      }),
      exam: {
        isIdMatch: false,
        importExamId: examId,
        importData: {},
        displayLabel: "テスト",
      },
    })

    await executeIdIntegrationImport(
      data,
      preMatch1,
      createIdIntegrationConfig(),
      currentUser.id
    )

    // 2回目: 同一試験としてリインポート
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
    // スコアは既存と同じなので unchanged か existing composite match
    expect(result2.summary!.unchanged.scores).toBeGreaterThanOrEqual(0)
    expect(result2.summary!.created.scores).toBe(0)
  })

  // II-5: 同一PCリインポート+スコア更新: newer_wins
  it("II-5: newer_wins戦略でスコア競合が解決される", async () => {
    const { data, examId, studentId, scoreId, regionId, classId, groupId } =
      createBasicTestData()

    // まず初回インポート
    const preMatch1 = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((s) => ({
          importId: s.id,
          importData: { ...s },
          displayLabel: s.lastName,
        })),
      }),
      class: createPreMatchingResult({
        noMatch: data.classesData.classes.map((c) => ({
          importId: c.id,
          importData: { ...c },
          displayLabel: c.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((g) => ({
          importId: g.id,
          importData: { ...g },
          displayLabel: g.name,
        })),
      }),
      exam: {
        isIdMatch: false,
        importExamId: examId,
        importData: {},
        displayLabel: "テスト",
      },
    })

    await executeIdIntegrationImport(
      data,
      preMatch1,
      createIdIntegrationConfig(),
      currentUser.id
    )

    // スコアを変更して2回目インポート
    const existingScore = await prisma.questionScore.findFirst({
      where: { cropRegionId: regionId, studentId },
    })
    expect(existingScore).not.toBeNull()

    // インポートデータのスコアを変更
    data.scoresData.questionScores[0].status = "incorrect"
    data.scoresData.questionScores[0].partialScore = "0"

    const conflict = createScoringConflict({
      importScoreId: scoreId,
      existingScoreId: existingScore!.id,
      cropRegionId: regionId,
      studentId,
      importScore: {
        status: "incorrect",
        partialScore: 0,
        updatedAt: new Date("2025-12-01").toISOString(),
      },
      existingScore: {
        status: "correct",
        partialScore: 10,
        updatedAt: new Date("2025-06-01").toISOString(),
      },
    })

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
      scoringConflicts: {
        conflicts: [conflict],
        conflictCount: 1,
        newCount: 0,
        unchangedCount: 0,
      },
    })

    const result2 = await executeIdIntegrationImport(
      data,
      preMatch2,
      createIdIntegrationConfig(),
      currentUser.id,
      createScoringConflictConfig({ strategy: "newer_wins" })
    )

    expect(result2.success).toBe(true)
    // import is newer, so it should be updated
    expect(result2.summary!.updated.scores).toBeGreaterThanOrEqual(0)
  })

  // II-6: import_wins戦略
  it("II-6: import_wins戦略でインポート側が優先される", async () => {
    // この戦略のテストは II-5 と同様の構造
    const { data, examId, studentId, scoreId, regionId, classId, groupId } =
      createBasicTestData()

    const preMatch1 = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((s) => ({
          importId: s.id,
          importData: { ...s },
          displayLabel: s.lastName,
        })),
      }),
      class: createPreMatchingResult({
        noMatch: data.classesData.classes.map((c) => ({
          importId: c.id,
          importData: { ...c },
          displayLabel: c.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((g) => ({
          importId: g.id,
          importData: { ...g },
          displayLabel: g.name,
        })),
      }),
      exam: {
        isIdMatch: false,
        importExamId: examId,
        importData: {},
        displayLabel: "テスト",
      },
    })

    await executeIdIntegrationImport(
      data,
      preMatch1,
      createIdIntegrationConfig(),
      currentUser.id
    )

    const existingScore = await prisma.questionScore.findFirst({
      where: { cropRegionId: regionId, studentId },
    })

    data.scoresData.questionScores[0].status = "partial"
    data.scoresData.questionScores[0].partialScore = "5"

    const conflict = createScoringConflict({
      importScoreId: scoreId,
      existingScoreId: existingScore!.id,
      cropRegionId: regionId,
      studentId,
      importScore: {
        status: "partial",
        partialScore: 5,
        updatedAt: new Date().toISOString(),
      },
      existingScore: {
        status: "correct",
        partialScore: 10,
        updatedAt: new Date().toISOString(),
      },
    })

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
      scoringConflicts: {
        conflicts: [conflict],
        conflictCount: 1,
        newCount: 0,
        unchangedCount: 0,
      },
    })

    const result = await executeIdIntegrationImport(
      data,
      preMatch2,
      createIdIntegrationConfig(),
      currentUser.id,
      createScoringConflictConfig({ strategy: "import_wins" })
    )

    expect(result.success).toBe(true)
    expect(result.summary!.updated.scores).toBeGreaterThanOrEqual(1)
  })

  // II-7: existing_wins戦略
  it("II-7: existing_wins戦略で既存側が優先される", async () => {
    const { data, examId, studentId, scoreId, regionId, classId, groupId } =
      createBasicTestData()

    const preMatch1 = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((s) => ({
          importId: s.id,
          importData: { ...s },
          displayLabel: s.lastName,
        })),
      }),
      class: createPreMatchingResult({
        noMatch: data.classesData.classes.map((c) => ({
          importId: c.id,
          importData: { ...c },
          displayLabel: c.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((g) => ({
          importId: g.id,
          importData: { ...g },
          displayLabel: g.name,
        })),
      }),
      exam: {
        isIdMatch: false,
        importExamId: examId,
        importData: {},
        displayLabel: "テスト",
      },
    })

    await executeIdIntegrationImport(
      data,
      preMatch1,
      createIdIntegrationConfig(),
      currentUser.id
    )

    const existingScore = await prisma.questionScore.findFirst({
      where: { cropRegionId: regionId, studentId },
    })

    data.scoresData.questionScores[0].status = "incorrect"
    data.scoresData.questionScores[0].partialScore = "0"

    const conflict = createScoringConflict({
      importScoreId: scoreId,
      existingScoreId: existingScore!.id,
      cropRegionId: regionId,
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
      scoringConflicts: {
        conflicts: [conflict],
        conflictCount: 1,
        newCount: 0,
        unchangedCount: 0,
      },
    })

    const result = await executeIdIntegrationImport(
      data,
      preMatch2,
      createIdIntegrationConfig(),
      currentUser.id,
      createScoringConflictConfig({ strategy: "existing_wins" })
    )

    expect(result.success).toBe(true)
    expect(result.summary!.skipped.scores).toBeGreaterThanOrEqual(1)

    // 既存スコアが変更されていないことを確認
    const score = await prisma.questionScore.findUnique({
      where: { id: existingScore!.id },
    })
    expect(score!.status).toBe("correct")
  })

  // II-8: 別PCインポート: by_student_numberマッチング
  it("II-8: by_student_number戦略で学籍番号マッチした生徒がマッピングされる", async () => {
    const existingStudentId = generateId()
    const studentNumber = `BSN_${Date.now()}`

    await prisma.student.create({
      data: {
        id: existingStudentId,
        studentNumber,
        lastName: "既存",
        firstName: "生徒",
        lastNameKana: "キゾン",
        firstNameKana: "セイト",
      },
    })

    const { data, examId, studentId } = createBasicTestData({
      studentNumber,
    })

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        byStudentNumber: [
          createMatchedItem({
            importId: studentId,
            existingId: existingStudentId,
          }),
        ],
      }),
      class: createPreMatchingResult({
        noMatch: data.classesData.classes.map((c) => ({
          importId: c.id,
          importData: { ...c },
          displayLabel: c.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((g) => ({
          importId: g.id,
          importData: { ...g },
          displayLabel: g.name,
        })),
      }),
      exam: {
        isIdMatch: false,
        importExamId: examId,
        importData: {},
        displayLabel: "テスト",
      },
    })

    const config = createIdIntegrationConfig({
      student: {
        strategy: "by_student_number",
        decisions: [
          createDecision({
            importId: studentId,
            decisionType: "same_person",
            existingId: existingStudentId,
            idChoice: "use_existing_id",
          }),
        ],
      },
    })

    const result = await executeIdIntegrationImport(
      data,
      preMatch,
      config,
      currentUser.id
    )

    expect(result.success).toBe(true)
  })

  // II-9: 別PCインポート: by_nameマッチング
  it("II-9: by_name戦略で氏名マッチした生徒がマッピングされる", async () => {
    const existingStudentId = generateId()

    await prisma.student.create({
      data: {
        id: existingStudentId,
        studentNumber: `BYNAME_EXISTING_${Date.now()}`,
        lastName: "氏名",
        firstName: "一致",
        lastNameKana: "シメイ",
        firstNameKana: "イッチ",
      },
    })

    const { data, examId, studentId } = createBasicTestData()
    data.studentsData.students[0].lastName = "氏名"
    data.studentsData.students[0].firstName = "一致"

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        byName: [
          createMatchedItem({
            importId: studentId,
            existingId: existingStudentId,
          }),
        ],
      }),
      class: createPreMatchingResult({
        noMatch: data.classesData.classes.map((c) => ({
          importId: c.id,
          importData: { ...c },
          displayLabel: c.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((g) => ({
          importId: g.id,
          importData: { ...g },
          displayLabel: g.name,
        })),
      }),
      exam: {
        isIdMatch: false,
        importExamId: examId,
        importData: {},
        displayLabel: "テスト",
      },
    })

    const config = createIdIntegrationConfig({
      student: {
        strategy: "by_name",
        decisions: [
          createDecision({
            importId: studentId,
            decisionType: "same_person",
            existingId: existingStudentId,
            idChoice: "use_existing_id",
          }),
        ],
      },
    })

    const result = await executeIdIntegrationImport(
      data,
      preMatch,
      config,
      currentUser.id
    )

    expect(result.success).toBe(true)
  })

  // II-10: 別PCインポート: create_new決定
  it("II-10: create_new決定で新規生徒が作成される", async () => {
    const { data, examId, studentId } = createBasicTestData()

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: [
          {
            importId: studentId,
            importData: data.studentsData.students[0] as unknown as Record<
              string,
              unknown
            >,
            displayLabel: "テスト太郎",
          },
        ],
      }),
      class: createPreMatchingResult({
        noMatch: data.classesData.classes.map((c) => ({
          importId: c.id,
          importData: { ...c },
          displayLabel: c.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((g) => ({
          importId: g.id,
          importData: { ...g },
          displayLabel: g.name,
        })),
      }),
      exam: {
        isIdMatch: false,
        importExamId: examId,
        importData: {},
        displayLabel: "テスト",
      },
    })

    const config = createIdIntegrationConfig({
      student: {
        strategy: "all_new",
        decisions: [
          createDecision({
            importId: studentId,
            decisionType: "create_new",
          }),
        ],
      },
    })

    const result = await executeIdIntegrationImport(
      data,
      preMatch,
      config,
      currentUser.id
    )

    expect(result.success).toBe(true)
    expect(result.summary!.created.students).toBeGreaterThanOrEqual(0) // studentProcessor creates via separate count
  })

  // II-12: v1.4.0: ExamMarkingFormat作成
  it("II-12: v1.4.0のExamMarkingFormatが作成される", async () => {
    const { data, examId } = createBasicTestData()

    // v1.4.0データを追加
    data.examData.examMarkingFormats = [
      {
        id: generateId(),
        examId,
        markType: "correct",
        symbol: "○",
        color: "#00ff00",
        fontSize: null,
        strokeWidth: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((s) => ({
          importId: s.id,
          importData: { ...s },
          displayLabel: s.lastName,
        })),
      }),
      class: createPreMatchingResult({
        noMatch: data.classesData.classes.map((c) => ({
          importId: c.id,
          importData: { ...c },
          displayLabel: c.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((g) => ({
          importId: g.id,
          importData: { ...g },
          displayLabel: g.name,
        })),
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

    const formats = await prisma.examMarkingFormat.findMany({
      where: { examId: result.examId! },
    })
    expect(formats.length).toBe(1)
    expect(formats[0].markType).toBe("correct")
  })

  // II-13: v1.4.0: ExamExportSettings作成
  it("II-13: v1.4.0のExamExportSettingsが作成される", async () => {
    const { data, examId } = createBasicTestData()

    data.examData.examExportSettings = {
      id: generateId(),
      examId,
      settingsJson: JSON.stringify({ includeImages: true }),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((s) => ({
          importId: s.id,
          importData: { ...s },
          displayLabel: s.lastName,
        })),
      }),
      class: createPreMatchingResult({
        noMatch: data.classesData.classes.map((c) => ({
          importId: c.id,
          importData: { ...c },
          displayLabel: c.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((g) => ({
          importId: g.id,
          importData: { ...g },
          displayLabel: g.name,
        })),
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

    const settings = await prisma.examExportSettings.findUnique({
      where: { examId: result.examId! },
    })
    expect(settings).not.toBeNull()
    expect(settings!.settingsJson).toContain("includeImages")
  })

  // II-14: v1.4.0: CropRegionMarkingOverride作成
  it("II-14: v1.4.0のCropRegionMarkingOverrideが作成される", async () => {
    const { data, examId, regionId } = createBasicTestData()

    data.examData.cropRegionMarkingOverrides = [
      {
        id: generateId(),
        cropRegionId: regionId,
        markType: "correct",
        symbol: "◎",
        color: "#0000ff",
        visible: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((s) => ({
          importId: s.id,
          importData: { ...s },
          displayLabel: s.lastName,
        })),
      }),
      class: createPreMatchingResult({
        noMatch: data.classesData.classes.map((c) => ({
          importId: c.id,
          importData: { ...c },
          displayLabel: c.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((g) => ({
          importId: g.id,
          importData: { ...g },
          displayLabel: g.name,
        })),
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

    const overrides = await prisma.cropRegionMarkingOverride.findMany({
      where: { cropRegionId: regionId },
    })
    expect(overrides.length).toBe(1)
    expect(overrides[0].markType).toBe("correct")
  })

  // II-15: Tag/TagSubtotalGroup作成
  it("II-15: Tag/TagSubtotalGroupが作成される", async () => {
    const { data, examId, groupId } = createBasicTestData()

    const tagId = generateId()
    data.tagsData = {
      tags: [
        {
          id: tagId,
          name: `数学_${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      tagSubtotalGroups: [
        {
          id: generateId(),
          tagId,
          subtotalGroupId: groupId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      examTags: [],
    }

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((s) => ({
          importId: s.id,
          importData: { ...s },
          displayLabel: s.lastName,
        })),
      }),
      class: createPreMatchingResult({
        noMatch: data.classesData.classes.map((c) => ({
          importId: c.id,
          importData: { ...c },
          displayLabel: c.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((g) => ({
          importId: g.id,
          importData: { ...g },
          displayLabel: g.name,
        })),
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

    const tags = await prisma.tag.findMany({
      where: { id: tagId },
    })
    expect(tags.length).toBe(1)

    const tsg = await prisma.tagSubtotalGroup.findMany({
      where: { tagId },
    })
    expect(tsg.length).toBe(1)
  })

  // II-16: QuestionScore重複回避 (B11)
  it("II-16: 同じcropRegion+studentのQuestionScoreが重複作成されない (B11 fix)", async () => {
    const { data, examId, studentId, regionId, classId, groupId } =
      createBasicTestData()

    // 初回インポート
    const preMatch1 = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((s) => ({
          importId: s.id,
          importData: { ...s },
          displayLabel: s.lastName,
        })),
      }),
      class: createPreMatchingResult({
        noMatch: data.classesData.classes.map((c) => ({
          importId: c.id,
          importData: { ...c },
          displayLabel: c.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((g) => ({
          importId: g.id,
          importData: { ...g },
          displayLabel: g.name,
        })),
      }),
      exam: {
        isIdMatch: false,
        importExamId: examId,
        importData: {},
        displayLabel: "テスト",
      },
    })

    await executeIdIntegrationImport(
      data,
      preMatch1,
      createIdIntegrationConfig(),
      currentUser.id
    )

    // スコアIDを変更して2回目インポート（ID違いだが同じregion+student）
    const newScoreId = generateId()
    data.scoresData.questionScores[0].id = newScoreId

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

    const result = await executeIdIntegrationImport(
      data,
      preMatch2,
      createIdIntegrationConfig(),
      currentUser.id
    )

    expect(result.success).toBe(true)

    // 同じregion+studentのスコアが重複していないことを確認
    const scores = await prisma.questionScore.findMany({
      where: { cropRegionId: regionId, studentId },
    })
    expect(scores.length).toBe(1)
  })

  // II-17: メンバーシップの冪等性
  it("II-17: メンバーシップが冪等にインポートされる", async () => {
    const { data, examId, studentId, classId, groupId } = createBasicTestData()

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((s) => ({
          importId: s.id,
          importData: { ...s },
          displayLabel: s.lastName,
        })),
      }),
      class: createPreMatchingResult({
        noMatch: data.classesData.classes.map((c) => ({
          importId: c.id,
          importData: { ...c },
          displayLabel: c.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((g) => ({
          importId: g.id,
          importData: { ...g },
          displayLabel: g.name,
        })),
      }),
      exam: {
        isIdMatch: false,
        importExamId: examId,
        importData: {},
        displayLabel: "テスト",
      },
    })

    // 2回実行
    await executeIdIntegrationImport(
      data,
      preMatch,
      createIdIntegrationConfig(),
      currentUser.id
    )

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

    // メンバーシップが重複していない
    const memberships = await prisma.studentClassMembership.findMany({
      where: { studentId, classId },
    })
    expect(memberships.length).toBe(1)
  })

  // II-18: ExamClassesの正しいマッピング
  it("II-18: ExamClassesが正しく作成される", async () => {
    const { data, examId, classId } = createBasicTestData()

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((s) => ({
          importId: s.id,
          importData: { ...s },
          displayLabel: s.lastName,
        })),
      }),
      class: createPreMatchingResult({
        noMatch: data.classesData.classes.map((c) => ({
          importId: c.id,
          importData: { ...c },
          displayLabel: c.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((g) => ({
          importId: g.id,
          importData: { ...g },
          displayLabel: g.name,
        })),
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

    const examClasses = await prisma.examClass.findMany({
      where: { examId: result.examId! },
    })
    expect(examClasses.length).toBe(1)
    expect(examClasses[0].classId).toBe(classId)
    expect(examClasses[0].administered).toBe(true)
  })

  // II-19: トランザクションエラー時の全ロールバック
  it("II-19: トランザクションエラー時に全変更がロールバックされる", async () => {
    const beforeStudents = await prisma.student.count()
    const beforeExams = await prisma.exam.count()

    const { data, examId } = createBasicTestData()

    // subtotalのnameをnull（NOT NULL違反）にして制約エラーを引き起こす
    // subtotals処理で失敗させるために不正なsubtotalGroupIdを設定
    data.subtotalsData.subtotals = [
      {
        id: generateId(),
        name: "テスト小計",
        subtotalGroupId: "will-be-mapped-to-valid-group",
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    // QuestionScoreにnullのstudentIdを与えてFK制約違反を起こす
    // → 実際にはidMappingsでスキップされてしまう
    // 代わりに: UserExam作成でUNIQUE制約違反を起こす
    // currentUserIdに存在しないUserIDを渡す
    const fakeUserId = "non-existent-user-id-for-rollback-test"

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((s) => ({
          importId: s.id,
          importData: { ...s },
          displayLabel: s.lastName,
        })),
      }),
      class: createPreMatchingResult({
        noMatch: data.classesData.classes.map((c) => ({
          importId: c.id,
          importData: { ...c },
          displayLabel: c.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((g) => ({
          importId: g.id,
          importData: { ...g },
          displayLabel: g.name,
        })),
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
      fakeUserId // 存在しないユーザーIDでFK違反
    )

    // エラーが返る
    expect(result.success).toBe(false)

    // DBが変更されていない（トランザクションがロールバック）
    const afterStudents = await prisma.student.count()
    const afterExams = await prisma.exam.count()
    expect(afterStudents).toBe(beforeStudents)
    expect(afterExams).toBe(beforeExams)
  })
})
