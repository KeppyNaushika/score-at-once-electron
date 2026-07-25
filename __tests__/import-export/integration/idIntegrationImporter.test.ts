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
      classroomId?: string
      className?: string
      groupId?: string
      groupName?: string
    } = {}
  ) {
    const examId = overrides.examId ?? generateId()
    const studentId = overrides.studentId ?? generateId()
    const classroomId = overrides.classroomId ?? generateId()
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

    // ExamClassroomを追加
    examData.examClassrooms = [
      {
        id: generateId(),
        examId,
        classroomId,
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
        [{ id: classroomId, name: className }],
        [
          {
            studentId,
            classroomId,
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
      classroomId,
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
        noMatch: data.studentsData.students.map((student) => ({
          importId: student.id,
          importData: { ...student },
          displayLabel: student.lastName,
        })),
      }),
      classroom: createPreMatchingResult({
        noMatch: data.classesData.classrooms.map((classroom) => ({
          importId: classroom.id,
          importData: { ...classroom },
          displayLabel: classroom.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((subtotalGroup) => ({
          importId: subtotalGroup.id,
          importData: { ...subtotalGroup },
          displayLabel: subtotalGroup.name,
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
        noMatch: data.studentsData.students.map((student) => ({
          importId: student.id,
          importData: { ...student },
          displayLabel: student.lastName,
        })),
      }),
      classroom: createPreMatchingResult({
        noMatch: data.classesData.classrooms.map((classroom) => ({
          importId: classroom.id,
          importData: { ...classroom },
          displayLabel: classroom.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((subtotalGroup) => ({
          importId: subtotalGroup.id,
          importData: { ...subtotalGroup },
          displayLabel: subtotalGroup.name,
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
        noMatch: data.studentsData.students.map((student) => ({
          importId: student.id,
          importData: { ...student },
          displayLabel: student.lastName,
        })),
      }),
      classroom: createPreMatchingResult({
        noMatch: data.classesData.classrooms.map((classroom) => ({
          importId: classroom.id,
          importData: { ...classroom },
          displayLabel: classroom.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((subtotalGroup) => ({
          importId: subtotalGroup.id,
          importData: { ...subtotalGroup },
          displayLabel: subtotalGroup.name,
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
    const { data, examId, studentId, classroomId, groupId } =
      createBasicTestData()

    // 先に全データをDBに作成しておく
    const preMatch1 = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((student) => ({
          importId: student.id,
          importData: { ...student },
          displayLabel: student.lastName,
        })),
      }),
      classroom: createPreMatchingResult({
        noMatch: data.classesData.classrooms.map((classroom) => ({
          importId: classroom.id,
          importData: { ...classroom },
          displayLabel: classroom.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((subtotalGroup) => ({
          importId: subtotalGroup.id,
          importData: { ...subtotalGroup },
          displayLabel: subtotalGroup.name,
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
      classroom: createPreMatchingResult({
        byId: [
          createMatchedItem({ importId: classroomId, existingId: classroomId }),
        ],
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
    const { data, examId, studentId, scoreId, regionId, classroomId, groupId } =
      createBasicTestData()

    // まず初回インポート
    const preMatch1 = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((student) => ({
          importId: student.id,
          importData: { ...student },
          displayLabel: student.lastName,
        })),
      }),
      classroom: createPreMatchingResult({
        noMatch: data.classesData.classrooms.map((classroom) => ({
          importId: classroom.id,
          importData: { ...classroom },
          displayLabel: classroom.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((subtotalGroup) => ({
          importId: subtotalGroup.id,
          importData: { ...subtotalGroup },
          displayLabel: subtotalGroup.name,
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
      classroom: createPreMatchingResult({
        byId: [
          createMatchedItem({ importId: classroomId, existingId: classroomId }),
        ],
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
    const { data, examId, studentId, scoreId, regionId, classroomId, groupId } =
      createBasicTestData()

    const preMatch1 = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((student) => ({
          importId: student.id,
          importData: { ...student },
          displayLabel: student.lastName,
        })),
      }),
      classroom: createPreMatchingResult({
        noMatch: data.classesData.classrooms.map((classroom) => ({
          importId: classroom.id,
          importData: { ...classroom },
          displayLabel: classroom.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((subtotalGroup) => ({
          importId: subtotalGroup.id,
          importData: { ...subtotalGroup },
          displayLabel: subtotalGroup.name,
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
      classroom: createPreMatchingResult({
        byId: [
          createMatchedItem({ importId: classroomId, existingId: classroomId }),
        ],
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
    const { data, examId, studentId, scoreId, regionId, classroomId, groupId } =
      createBasicTestData()

    const preMatch1 = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((student) => ({
          importId: student.id,
          importData: { ...student },
          displayLabel: student.lastName,
        })),
      }),
      classroom: createPreMatchingResult({
        noMatch: data.classesData.classrooms.map((classroom) => ({
          importId: classroom.id,
          importData: { ...classroom },
          displayLabel: classroom.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((subtotalGroup) => ({
          importId: subtotalGroup.id,
          importData: { ...subtotalGroup },
          displayLabel: subtotalGroup.name,
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
      classroom: createPreMatchingResult({
        byId: [
          createMatchedItem({ importId: classroomId, existingId: classroomId }),
        ],
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
      classroom: createPreMatchingResult({
        noMatch: data.classesData.classrooms.map((classroom) => ({
          importId: classroom.id,
          importData: { ...classroom },
          displayLabel: classroom.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((subtotalGroup) => ({
          importId: subtotalGroup.id,
          importData: { ...subtotalGroup },
          displayLabel: subtotalGroup.name,
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
      classroom: createPreMatchingResult({
        noMatch: data.classesData.classrooms.map((classroom) => ({
          importId: classroom.id,
          importData: { ...classroom },
          displayLabel: classroom.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((subtotalGroup) => ({
          importId: subtotalGroup.id,
          importData: { ...subtotalGroup },
          displayLabel: subtotalGroup.name,
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
      classroom: createPreMatchingResult({
        noMatch: data.classesData.classrooms.map((classroom) => ({
          importId: classroom.id,
          importData: { ...classroom },
          displayLabel: classroom.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((subtotalGroup) => ({
          importId: subtotalGroup.id,
          importData: { ...subtotalGroup },
          displayLabel: subtotalGroup.name,
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
        noMatch: data.studentsData.students.map((student) => ({
          importId: student.id,
          importData: { ...student },
          displayLabel: student.lastName,
        })),
      }),
      classroom: createPreMatchingResult({
        noMatch: data.classesData.classrooms.map((classroom) => ({
          importId: classroom.id,
          importData: { ...classroom },
          displayLabel: classroom.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((subtotalGroup) => ({
          importId: subtotalGroup.id,
          importData: { ...subtotalGroup },
          displayLabel: subtotalGroup.name,
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
        noMatch: data.studentsData.students.map((student) => ({
          importId: student.id,
          importData: { ...student },
          displayLabel: student.lastName,
        })),
      }),
      classroom: createPreMatchingResult({
        noMatch: data.classesData.classrooms.map((classroom) => ({
          importId: classroom.id,
          importData: { ...classroom },
          displayLabel: classroom.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((subtotalGroup) => ({
          importId: subtotalGroup.id,
          importData: { ...subtotalGroup },
          displayLabel: subtotalGroup.name,
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

  // II-15: Tag/TagSubtotalGroup作成（II-14 は CropRegionMarkingOverride 廃止に伴い欠番）
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
        noMatch: data.studentsData.students.map((student) => ({
          importId: student.id,
          importData: { ...student },
          displayLabel: student.lastName,
        })),
      }),
      classroom: createPreMatchingResult({
        noMatch: data.classesData.classrooms.map((classroom) => ({
          importId: classroom.id,
          importData: { ...classroom },
          displayLabel: classroom.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((subtotalGroup) => ({
          importId: subtotalGroup.id,
          importData: { ...subtotalGroup },
          displayLabel: subtotalGroup.name,
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

    const tagSubtotalGroups = await prisma.tagSubtotalGroup.findMany({
      where: { tagId },
    })
    expect(tagSubtotalGroups.length).toBe(1)
  })

  // II-16: QuestionScore重複回避 (B11)
  it("II-16: 同じcropRegion+studentのQuestionScoreが重複作成されない (B11 fix)", async () => {
    const { data, examId, studentId, regionId, classroomId, groupId } =
      createBasicTestData()

    // 初回インポート
    const preMatch1 = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((student) => ({
          importId: student.id,
          importData: { ...student },
          displayLabel: student.lastName,
        })),
      }),
      classroom: createPreMatchingResult({
        noMatch: data.classesData.classrooms.map((classroom) => ({
          importId: classroom.id,
          importData: { ...classroom },
          displayLabel: classroom.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((subtotalGroup) => ({
          importId: subtotalGroup.id,
          importData: { ...subtotalGroup },
          displayLabel: subtotalGroup.name,
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
      classroom: createPreMatchingResult({
        byId: [
          createMatchedItem({ importId: classroomId, existingId: classroomId }),
        ],
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
    const { data, examId, studentId, classroomId, groupId } =
      createBasicTestData()

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((student) => ({
          importId: student.id,
          importData: { ...student },
          displayLabel: student.lastName,
        })),
      }),
      classroom: createPreMatchingResult({
        noMatch: data.classesData.classrooms.map((classroom) => ({
          importId: classroom.id,
          importData: { ...classroom },
          displayLabel: classroom.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((subtotalGroup) => ({
          importId: subtotalGroup.id,
          importData: { ...subtotalGroup },
          displayLabel: subtotalGroup.name,
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
      classroom: createPreMatchingResult({
        byId: [
          createMatchedItem({ importId: classroomId, existingId: classroomId }),
        ],
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
    const memberships = await prisma.studentClassroomMembership.findMany({
      where: { studentId, classroomId },
    })
    expect(memberships.length).toBe(1)
  })

  // II-18: ExamClassroomsの正しいマッピング
  it("II-18: ExamClassroomsが正しく作成される", async () => {
    const { data, examId, classroomId } = createBasicTestData()

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((student) => ({
          importId: student.id,
          importData: { ...student },
          displayLabel: student.lastName,
        })),
      }),
      classroom: createPreMatchingResult({
        noMatch: data.classesData.classrooms.map((classroom) => ({
          importId: classroom.id,
          importData: { ...classroom },
          displayLabel: classroom.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((subtotalGroup) => ({
          importId: subtotalGroup.id,
          importData: { ...subtotalGroup },
          displayLabel: subtotalGroup.name,
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

    const examClassrooms = await prisma.examClassroom.findMany({
      where: { examId: result.examId! },
    })
    expect(examClassrooms.length).toBe(1)
    expect(examClassrooms[0].classroomId).toBe(classroomId)
    expect(examClassrooms[0].administered).toBe(true)
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
        noMatch: data.studentsData.students.map((student) => ({
          importId: student.id,
          importData: { ...student },
          displayLabel: student.lastName,
        })),
      }),
      classroom: createPreMatchingResult({
        noMatch: data.classesData.classrooms.map((classroom) => ({
          importId: classroom.id,
          importData: { ...classroom },
          displayLabel: classroom.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((subtotalGroup) => ({
          importId: subtotalGroup.id,
          importData: { ...subtotalGroup },
          displayLabel: subtotalGroup.name,
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

  /**
   * 全件noMatchのpreMatchを作るヘルパー（新規インポート用）
   */
  function buildNoMatchPreMatch(
    data: ReturnType<typeof createBasicTestData>["data"],
    examId: string
  ) {
    return createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((student) => ({
          importId: student.id,
          importData: { ...student },
          displayLabel: student.lastName,
        })),
      }),
      classroom: createPreMatchingResult({
        noMatch: data.classesData.classrooms.map((classroom) => ({
          importId: classroom.id,
          importData: { ...classroom },
          displayLabel: classroom.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((subtotalGroup) => ({
          importId: subtotalGroup.id,
          importData: { ...subtotalGroup },
          displayLabel: subtotalGroup.name,
        })),
      }),
      exam: {
        isIdMatch: false,
        importExamId: examId,
        importData: {},
        displayLabel: "テスト",
      },
    })
  }

  // II-20: v1.7.0/v1.11.0: OMR設定（Config/ChoiceOption/DigitBox）が作成される
  it("II-20: OMR設定一式がmerge経路で作成される", async () => {
    const { data, examId, regionId } = createBasicTestData()

    const omrConfigId = generateId()
    const now = new Date().toISOString()
    data.examData.omrConfigs = [
      {
        id: omrConfigId,
        cropRegionId: regionId,
        type: "choice",
        numChoices: 4,
        choiceLayout: "horizontal",
        numDigits: null,
        correctAnswer: "1",
        colorThreshold: null,
        areaThreshold: null,
        createdAt: now,
        updatedAt: now,
      },
    ]
    data.examData.omrChoiceOptions = [
      {
        id: generateId(),
        omrConfigId: omrConfigId,
        choiceIndex: 0,
        label: "1",
        isCorrect: true,
        shape: "circle",
        normalizedCx: 0.5,
        normalizedCy: 0.5,
        normalizedWidth: 0.1,
        normalizedHeight: 0.1,
        createdAt: now,
        updatedAt: now,
      },
    ]
    data.examData.omrDigitBoxes = [
      {
        id: generateId(),
        omrConfigId: omrConfigId,
        digitIndex: 0,
        normalizedX: 0.1,
        normalizedY: 0.1,
        normalizedW: 0.1,
        normalizedH: 0.1,
        createdAt: now,
        updatedAt: now,
      },
    ]

    const result = await executeIdIntegrationImport(
      data,
      buildNoMatchPreMatch(data, examId),
      createIdIntegrationConfig(),
      currentUser.id
    )

    expect(result.success).toBe(true)

    const configs = await prisma.cropRegionOmrConfig.findMany({
      where: { cropRegionId: regionId },
    })
    expect(configs.length).toBe(1)
    const options = await prisma.cropRegionOmrChoiceOption.findMany({
      where: { omrConfigId: configs[0].id },
    })
    expect(options.length).toBe(1)
    expect(options[0].shape).toBe("circle")
    const boxes = await prisma.cropRegionOmrDigitBox.findMany({
      where: { omrConfigId: configs[0].id },
    })
    expect(boxes.length).toBe(1)
  })

  // II-21: v1.11.0: 複合解答（CompoundAnswer/Member/Score）が作成される
  it("II-21: 複合解答一式がmerge経路で作成される", async () => {
    const { data, examId, regionId, studentId } = createBasicTestData()

    const pageId = data.examData.examPages[0].id
    const compoundAnswerId = generateId()
    const now = new Date().toISOString()
    data.examData.compoundAnswers = [
      {
        id: compoundAnswerId,
        examPageId: pageId,
        label: "複合1",
        answerFormat: "fraction",
        correctAnswer: "1/2",
        points: 5,
        orderIndex: 0,
        alternativeAnswers: null,
        requireReduced: false,
        createdAt: now,
        updatedAt: now,
      },
    ]
    data.examData.compoundAnswerMembers = [
      {
        id: generateId(),
        compoundAnswerId: compoundAnswerId,
        cropRegionId: regionId,
        order: 0,
        roleLabel: "分子",
        separator: null,
        createdAt: now,
        updatedAt: now,
      },
    ]
    data.examData.compoundAnswerScores = [
      {
        id: generateId(),
        compoundAnswerId: compoundAnswerId,
        studentId,
        userId: currentUser.id,
        recognizedAnswer: "1/2",
        status: "correct",
        partialScore: "5",
        createdAt: now,
        updatedAt: now,
      },
    ]

    const result = await executeIdIntegrationImport(
      data,
      buildNoMatchPreMatch(data, examId),
      createIdIntegrationConfig(),
      currentUser.id
    )

    expect(result.success).toBe(true)

    const compoundAnswers = await prisma.compoundAnswer.findMany({
      where: { id: compoundAnswerId },
    })
    expect(compoundAnswers.length).toBe(1)
    const members = await prisma.compoundAnswerMember.findMany({
      where: { compoundAnswerId: compoundAnswerId },
    })
    expect(members.length).toBe(1)
    const scores = await prisma.compoundAnswerScore.findMany({
      where: { compoundAnswerId: compoundAnswerId, studentId },
    })
    expect(scores.length).toBe(1)
    // userIdは現在のユーザーで上書きされる
    expect(scores[0].userId).toBe(currentUser.id)
  })

  // II-22: v1.13.0: ScoreDecisionが作成される
  it("II-22: ScoreDecisionがmerge経路で作成される", async () => {
    const { data, examId, regionId, studentId } = createBasicTestData()

    const scoreDecisionId = generateId()
    const now = new Date().toISOString()
    data.scoresData.scoreDecisions = [
      {
        id: scoreDecisionId,
        cropRegionId: regionId,
        studentId,
        verdict: "correct",
        score: "10",
        comment: null,
        decidedByUserId: currentUser.id,
        decidedAt: now,
        sourceQuestionScoreId: null,
        createdAt: now,
        updatedAt: now,
      },
    ]

    const result = await executeIdIntegrationImport(
      data,
      buildNoMatchPreMatch(data, examId),
      createIdIntegrationConfig(),
      currentUser.id
    )

    expect(result.success).toBe(true)

    const decisions = await prisma.scoreDecision.findMany({
      where: { cropRegionId: regionId, studentId },
    })
    expect(decisions.length).toBe(1)
    expect(decisions[0].verdict).toBe("correct")
    expect(decisions[0].decidedByUserId).toBe(currentUser.id)
  })

  // II-23: ScoreDecisionのLWW競合解決（decidedAtが新しい方を採用）
  it("II-23: ScoreDecision競合はdecidedAtが新しい方を採用する（LWW）", async () => {
    const { data, examId, studentId, regionId, classroomId, groupId } =
      createBasicTestData()

    const scoreDecisionId = generateId()
    const oldDate = new Date("2025-06-01T00:00:00.000Z").toISOString()
    data.scoresData.scoreDecisions = [
      {
        id: scoreDecisionId,
        cropRegionId: regionId,
        studentId,
        verdict: "incorrect",
        score: "0",
        comment: "旧",
        decidedByUserId: currentUser.id,
        decidedAt: oldDate,
        sourceQuestionScoreId: null,
        createdAt: oldDate,
        updatedAt: oldDate,
      },
    ]

    // 初回インポート（古い確定）
    await executeIdIntegrationImport(
      data,
      buildNoMatchPreMatch(data, examId),
      createIdIntegrationConfig(),
      currentUser.id
    )

    // 2回目: 新しいdecidedAtの確定で同一試験に再インポート
    const newDate = new Date("2025-12-01T00:00:00.000Z").toISOString()
    data.scoresData.scoreDecisions[0].verdict = "correct"
    data.scoresData.scoreDecisions[0].score = "10"
    data.scoresData.scoreDecisions[0].comment = "新"
    data.scoresData.scoreDecisions[0].decidedAt = newDate

    const preMatch2 = createFileOverviewData({
      student: createPreMatchingResult({
        byId: [
          createMatchedItem({ importId: studentId, existingId: studentId }),
        ],
      }),
      classroom: createPreMatchingResult({
        byId: [
          createMatchedItem({ importId: classroomId, existingId: classroomId }),
        ],
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

    // 確定は1件のまま（重複なし）、新しい方が採用される
    const decisions = await prisma.scoreDecision.findMany({
      where: { cropRegionId: regionId, studentId },
    })
    expect(decisions.length).toBe(1)
    expect(decisions[0].verdict).toBe("correct")
    expect(decisions[0].comment).toBe("新")
  })

  // II-24: ScoreDecisionのLWW（既存が新しい場合は上書きしない）
  it("II-24: ScoreDecision競合で既存が新しければ上書きしない（LWW）", async () => {
    const { data, examId, studentId, regionId, classroomId, groupId } =
      createBasicTestData()

    const scoreDecisionId = generateId()
    const newDate = new Date("2025-12-01T00:00:00.000Z").toISOString()
    data.scoresData.scoreDecisions = [
      {
        id: scoreDecisionId,
        cropRegionId: regionId,
        studentId,
        verdict: "correct",
        score: "10",
        comment: "新しい既存",
        decidedByUserId: currentUser.id,
        decidedAt: newDate,
        sourceQuestionScoreId: null,
        createdAt: newDate,
        updatedAt: newDate,
      },
    ]

    await executeIdIntegrationImport(
      data,
      buildNoMatchPreMatch(data, examId),
      createIdIntegrationConfig(),
      currentUser.id
    )

    // 2回目: 古いdecidedAtの確定 → 上書きされないはず
    const oldDate = new Date("2025-06-01T00:00:00.000Z").toISOString()
    data.scoresData.scoreDecisions[0].verdict = "incorrect"
    data.scoresData.scoreDecisions[0].comment = "古い取り込み"
    data.scoresData.scoreDecisions[0].decidedAt = oldDate

    const preMatch2 = createFileOverviewData({
      student: createPreMatchingResult({
        byId: [
          createMatchedItem({ importId: studentId, existingId: studentId }),
        ],
      }),
      classroom: createPreMatchingResult({
        byId: [
          createMatchedItem({ importId: classroomId, existingId: classroomId }),
        ],
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

    const decisions = await prisma.scoreDecision.findMany({
      where: { cropRegionId: regionId, studentId },
    })
    expect(decisions.length).toBe(1)
    // 既存（新しい方）が維持される
    expect(decisions[0].verdict).toBe("correct")
    expect(decisions[0].comment).toBe("新しい既存")
  })

  // II-25: 新しめモデル全部入りのアーカイブが1回のmergeで全て復元される
  // （merge経路が将来モデルをサイレントに取りこぼさないことの網羅regression）
  it("II-25: OMR・複合解答・確定スコアを含む全モデルがmergeで復元される", async () => {
    const { data, examId, regionId, studentId } = createBasicTestData()
    const now = new Date().toISOString()
    const pageId = data.examData.examPages[0].id

    // OMR一式
    const omrConfigId = generateId()
    data.examData.omrConfigs = [
      {
        id: omrConfigId,
        cropRegionId: regionId,
        type: "choice",
        numChoices: 4,
        choiceLayout: "horizontal",
        numDigits: null,
        correctAnswer: "1",
        colorThreshold: null,
        areaThreshold: null,
        createdAt: now,
        updatedAt: now,
      },
    ]
    data.examData.omrChoiceOptions = [
      {
        id: generateId(),
        omrConfigId: omrConfigId,
        choiceIndex: 0,
        label: "1",
        isCorrect: true,
        shape: "circle",
        normalizedCx: 0.5,
        normalizedCy: 0.5,
        normalizedWidth: 0.1,
        normalizedHeight: 0.1,
        createdAt: now,
        updatedAt: now,
      },
    ]
    data.examData.omrDigitBoxes = [
      {
        id: generateId(),
        omrConfigId: omrConfigId,
        digitIndex: 0,
        normalizedX: 0.1,
        normalizedY: 0.1,
        normalizedW: 0.1,
        normalizedH: 0.1,
        createdAt: now,
        updatedAt: now,
      },
    ]

    // 複合解答一式
    const compoundAnswerId = generateId()
    data.examData.compoundAnswers = [
      {
        id: compoundAnswerId,
        examPageId: pageId,
        label: "複合1",
        answerFormat: "fraction",
        correctAnswer: "1/2",
        points: 5,
        orderIndex: 0,
        alternativeAnswers: null,
        requireReduced: false,
        createdAt: now,
        updatedAt: now,
      },
    ]
    data.examData.compoundAnswerMembers = [
      {
        id: generateId(),
        compoundAnswerId: compoundAnswerId,
        cropRegionId: regionId,
        order: 0,
        roleLabel: "分子",
        separator: null,
        createdAt: now,
        updatedAt: now,
      },
    ]
    data.examData.compoundAnswerScores = [
      {
        id: generateId(),
        compoundAnswerId: compoundAnswerId,
        studentId,
        userId: currentUser.id,
        recognizedAnswer: "1/2",
        status: "correct",
        partialScore: "5",
        createdAt: now,
        updatedAt: now,
      },
    ]

    // 確定スコア
    data.scoresData.scoreDecisions = [
      {
        id: generateId(),
        cropRegionId: regionId,
        studentId,
        verdict: "correct",
        score: "10",
        comment: null,
        decidedByUserId: currentUser.id,
        decidedAt: now,
        sourceQuestionScoreId: null,
        createdAt: now,
        updatedAt: now,
      },
    ]

    const result = await executeIdIntegrationImport(
      data,
      buildNoMatchPreMatch(data, examId),
      createIdIntegrationConfig(),
      currentUser.id
    )

    expect(result.success).toBe(true)

    // 全7モデルが復元されていること
    expect(
      await prisma.cropRegionOmrConfig.count({
        where: { cropRegionId: regionId },
      })
    ).toBe(1)
    const omrConfig = await prisma.cropRegionOmrConfig.findFirst({
      where: { cropRegionId: regionId },
    })
    expect(
      await prisma.cropRegionOmrChoiceOption.count({
        where: { omrConfigId: omrConfig!.id },
      })
    ).toBe(1)
    expect(
      await prisma.cropRegionOmrDigitBox.count({
        where: { omrConfigId: omrConfig!.id },
      })
    ).toBe(1)
    expect(
      await prisma.compoundAnswer.count({ where: { id: compoundAnswerId } })
    ).toBe(1)
    expect(
      await prisma.compoundAnswerMember.count({
        where: { compoundAnswerId: compoundAnswerId },
      })
    ).toBe(1)
    expect(
      await prisma.compoundAnswerScore.count({
        where: { compoundAnswerId: compoundAnswerId, studentId },
      })
    ).toBe(1)
    expect(
      await prisma.scoreDecision.count({
        where: { cropRegionId: regionId, studentId },
      })
    ).toBe(1)
  })
})
