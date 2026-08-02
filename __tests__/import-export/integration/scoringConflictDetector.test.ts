/**
 * scoringConflictDetector の統合テスト
 *
 * テスト対象: electron-src/lib/import/merge/scoringConflictDetector.ts
 * 実際のSQLiteテスト用DBを使用し、採点結果の競合検出を検証する
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import {
  createArchiveExamData,
  createArchiveScoresData,
  createArchiveStudentsData,
  createExtractedArchiveData,
  createFileOverviewData,
  createIdIntegrationConfig,
  createMatchedItem,
  createPreMatchingResult,
  generateId,
} from "../../helpers/testDataFactory"
import {
  cleanupTestDatabase,
  createTestUser,
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

import {
  detectScoringConflicts,
  detectScoringConflictsWithUserDecisions,
} from "../../../electron-src/lib/import/merge/scoringConflictDetector"

const prisma = getTestPrismaClient()

/**
 * DB に受験者（ExamStudent）を作成し、その id を返す。
 * 採点行は受験者の子なので、採点を作る前に必ず必要になる。
 */
async function createExamStudentRow(
  examId: string,
  studentId: string
): Promise<string> {
  const examStudent = await prisma.examStudent.create({
    data: { id: generateId(), examId, studentId, status: "participating" },
  })
  return examStudent.id
}

/** アーカイブ側の受験者行（インポートする採点行の親） */
function archiveExamStudent(
  importExamStudentId: string,
  examId: string,
  studentId: string
) {
  return {
    id: importExamStudentId,
    examId,
    studentId,
    status: "participating",
    customOrder: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * テスト用の試験・ページ・CropRegionをDBに作成するヘルパー
 */
async function createExamWithCropRegions(options: {
  examId: string
  cropRegionIds: string[]
  userId: string
}): Promise<{ pageId: string }> {
  const { examId, cropRegionIds, userId } = options

  await prisma.exam.create({
    data: { id: examId, examName: "テスト試験" },
  })

  await prisma.userExam.create({
    data: {
      id: generateId(),
      userId,
      examId,
      role: "owner",
    },
  })

  const pageId = generateId()
  await prisma.examPage.create({
    data: { id: pageId, examId, pageNumber: 1, imagePath: "" },
  })

  for (let i = 0; i < cropRegionIds.length; i++) {
    await prisma.cropRegion.create({
      data: {
        id: cropRegionIds[i],
        examPageId: pageId,
        label: `問${i + 1}`,
        type: "QUESTION_ANSWER",
        x: 0,
        y: i * 100,
        width: 200,
        height: 80,
        points: 10,
        orderIndex: i,
      },
    })
  }

  return { pageId }
}

describe("detectScoringConflicts", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  // =========================================================================
  // 競合なし: 全て新規スコア
  // =========================================================================
  describe("競合なし（全て新規）", () => {
    it("既存のスコアがない場合、全てnewCountとして扱う", async () => {
      const user = await createTestUser()
      const examId = generateId()
      const cropRegionId = generateId()
      const studentId = generateId()

      await createExamWithCropRegions({
        examId,
        cropRegionIds: [cropRegionId],
        userId: user.id,
      })

      await prisma.student.create({
        data: {
          id: studentId,
          studentNumber: "S001",
          lastName: "田中",
          firstName: "太郎",
          lastNameKana: "タナカ",
          firstNameKana: "タロウ",
          enrollmentYear: 2024,
        },
      })
      await createExamStudentRow(examId, studentId)
      const importExamStudentId = generateId()

      // 既存のQuestionScoreはなし

      const importExamData = createArchiveExamData({ examId })
      importExamData.examStudents = [
        archiveExamStudent(importExamStudentId, examId, studentId),
      ]
      const importData = createExtractedArchiveData({
        examData: importExamData,
        scoresData: createArchiveScoresData([
          {
            cropRegionId: cropRegionId,
            examStudentId: importExamStudentId,
            status: "correct",
            partialScore: "10",
            userId: user.id,
          },
        ]),
      })

      const studentIdMapping: Record<string, string> = {
        [studentId]: studentId,
      }
      const cropRegionIdMapping: Record<string, string> = {
        [cropRegionId]: cropRegionId,
      }

      const result = await detectScoringConflicts(
        importData,
        studentIdMapping,
        cropRegionIdMapping
      )

      expect(result.conflictCount).toBe(0)
      expect(result.newCount).toBe(1)
      expect(result.unchangedCount).toBe(0)
      expect(result.conflicts).toHaveLength(0)
    })
  })

  // =========================================================================
  // 競合検出: 同じ生徒×CropRegionで異なるスコア
  // =========================================================================
  describe("競合検出", () => {
    it("同じ生徒×CropRegionで異なるstatusのスコアがある場合、競合として検出する", async () => {
      const user = await createTestUser()
      const examId = generateId()
      const cropRegionId = generateId()
      const studentId = generateId()

      await createExamWithCropRegions({
        examId,
        cropRegionIds: [cropRegionId],
        userId: user.id,
      })

      await prisma.student.create({
        data: {
          id: studentId,
          studentNumber: "S001",
          lastName: "田中",
          firstName: "太郎",
          lastNameKana: "タナカ",
          firstNameKana: "タロウ",
          enrollmentYear: 2024,
        },
      })
      const examStudentId = await createExamStudentRow(examId, studentId)
      const importExamStudentId = generateId()

      // 既存のQuestionScore（incorrect）
      await prisma.questionScore.create({
        data: {
          id: generateId(),
          cropRegionId,
          examStudentId,
          status: "incorrect",
          partialScore: 0,
          userId: user.id,
        },
      })

      // インポートデータ（correct）
      const importExamData = createArchiveExamData({ examId })
      importExamData.examStudents = [
        archiveExamStudent(importExamStudentId, examId, studentId),
      ]
      const importData = createExtractedArchiveData({
        examData: importExamData,
        scoresData: createArchiveScoresData([
          {
            cropRegionId,
            examStudentId: importExamStudentId,
            status: "correct",
            partialScore: "10",
            userId: user.id,
          },
        ]),
      })

      const studentIdMapping: Record<string, string> = {
        [studentId]: studentId,
      }
      const cropRegionIdMapping: Record<string, string> = {
        [cropRegionId]: cropRegionId,
      }

      const result = await detectScoringConflicts(
        importData,
        studentIdMapping,
        cropRegionIdMapping
      )

      expect(result.conflictCount).toBe(1)
      expect(result.newCount).toBe(0)
      expect(result.unchangedCount).toBe(0)
      expect(result.conflicts).toHaveLength(1)

      const conflict = result.conflicts[0]
      expect(conflict.studentId).toBe(studentId)
      expect(conflict.cropRegionId).toBe(cropRegionId)
      expect(conflict.importScore.status).toBe("correct")
      expect(conflict.importScore.partialScore).toBe(10)
      expect(conflict.existingScore.status).toBe("incorrect")
      expect(conflict.existingScore.partialScore).toBe(0)
      expect(conflict.studentName).toBe("田中太郎")
      expect(conflict.questionLabel).toBe("問1")
      expect(conflict.maxPoints).toBe(10)
    })

    it("partialScoreのみ異なる場合も競合として検出する", async () => {
      const user = await createTestUser()
      const examId = generateId()
      const cropRegionId = generateId()
      const studentId = generateId()

      await createExamWithCropRegions({
        examId,
        cropRegionIds: [cropRegionId],
        userId: user.id,
      })

      await prisma.student.create({
        data: {
          id: studentId,
          studentNumber: "S002",
          lastName: "佐藤",
          firstName: "花子",
          lastNameKana: "サトウ",
          firstNameKana: "ハナコ",
          enrollmentYear: 2024,
        },
      })
      const examStudentId = await createExamStudentRow(examId, studentId)
      const importExamStudentId = generateId()

      // 既存: partial=5
      await prisma.questionScore.create({
        data: {
          id: generateId(),
          cropRegionId,
          examStudentId,
          status: "partial",
          partialScore: 5,
          userId: user.id,
        },
      })

      // インポート: partial=8
      const importExamData = createArchiveExamData({ examId })
      importExamData.examStudents = [
        archiveExamStudent(importExamStudentId, examId, studentId),
      ]
      const importData = createExtractedArchiveData({
        examData: importExamData,
        scoresData: createArchiveScoresData([
          {
            cropRegionId,
            examStudentId: importExamStudentId,
            status: "partial",
            partialScore: "8",
            userId: user.id,
          },
        ]),
      })

      const result = await detectScoringConflicts(
        importData,
        { [studentId]: studentId },
        { [cropRegionId]: cropRegionId }
      )

      expect(result.conflictCount).toBe(1)
      expect(result.conflicts[0].importScore.partialScore).toBe(8)
      expect(result.conflicts[0].existingScore.partialScore).toBe(5)
    })
  })

  // =========================================================================
  // 同一スコア: unchangedとしてカウント
  // =========================================================================
  describe("同一スコア（unchanged）", () => {
    it("statusとpartialScoreが同一の場合、unchangedとしてカウントする", async () => {
      const user = await createTestUser()
      const examId = generateId()
      const cropRegionId = generateId()
      const studentId = generateId()

      await createExamWithCropRegions({
        examId,
        cropRegionIds: [cropRegionId],
        userId: user.id,
      })

      await prisma.student.create({
        data: {
          id: studentId,
          studentNumber: "S001",
          lastName: "鈴木",
          firstName: "一郎",
          lastNameKana: "スズキ",
          firstNameKana: "イチロウ",
          enrollmentYear: 2024,
        },
      })
      const examStudentId = await createExamStudentRow(examId, studentId)
      const importExamStudentId = generateId()

      // 既存と同じスコア
      await prisma.questionScore.create({
        data: {
          id: generateId(),
          cropRegionId,
          examStudentId,
          status: "correct",
          partialScore: 10,
          userId: user.id,
        },
      })

      const importExamData = createArchiveExamData({ examId })
      importExamData.examStudents = [
        archiveExamStudent(importExamStudentId, examId, studentId),
      ]
      const importData = createExtractedArchiveData({
        examData: importExamData,
        scoresData: createArchiveScoresData([
          {
            cropRegionId,
            examStudentId: importExamStudentId,
            status: "correct",
            partialScore: "10",
            userId: user.id,
          },
        ]),
      })

      const result = await detectScoringConflicts(
        importData,
        { [studentId]: studentId },
        { [cropRegionId]: cropRegionId }
      )

      expect(result.conflictCount).toBe(0)
      expect(result.unchangedCount).toBe(1)
      expect(result.newCount).toBe(0)
    })
  })

  // =========================================================================
  // マッピングがない場合は新規扱い
  // =========================================================================
  describe("マッピングなし", () => {
    it("cropRegionIdMappingが空の場合、全て新規として扱う", async () => {
      const importData = createExtractedArchiveData({
        scoresData: createArchiveScoresData([
          {
            cropRegionId: generateId(),
            examStudentId: generateId(),
            status: "correct",
            partialScore: "10",
          },
        ]),
      })

      const result = await detectScoringConflicts(importData, {}, {})

      expect(result.conflictCount).toBe(0)
      expect(result.newCount).toBe(1)
      expect(result.unchangedCount).toBe(0)
    })

    it("studentIdMappingにないスコアは新規として扱う", async () => {
      const user = await createTestUser()
      const examId = generateId()
      const cropRegionId = generateId()
      const unmappedExamStudentId = generateId()

      await createExamWithCropRegions({
        examId,
        cropRegionIds: [cropRegionId],
        userId: user.id,
      })

      const importData = createExtractedArchiveData({
        scoresData: createArchiveScoresData([
          {
            cropRegionId,
            examStudentId: unmappedExamStudentId,
            status: "correct",
            partialScore: "10",
          },
        ]),
      })

      const result = await detectScoringConflicts(
        importData,
        {}, // マッピングなし
        { [cropRegionId]: cropRegionId }
      )

      expect(result.conflictCount).toBe(0)
      expect(result.newCount).toBe(1)
    })
  })

  // =========================================================================
  // 複数スコアの混合テスト
  // =========================================================================
  describe("複数スコアの混合", () => {
    it("新規・同一・競合が混在する場合、それぞれ正しくカウントされる", async () => {
      const user = await createTestUser()
      const examId = generateId()
      const cropRegion1 = generateId()
      const cropRegion2 = generateId()
      const cropRegion3 = generateId()
      const student1 = generateId()
      const student2 = generateId()

      await createExamWithCropRegions({
        examId,
        cropRegionIds: [cropRegion1, cropRegion2, cropRegion3],
        userId: user.id,
      })

      for (const student of [
        { id: student1, num: "S001", last: "田中", first: "太郎" },
        { id: student2, num: "S002", last: "佐藤", first: "花子" },
      ]) {
        await prisma.student.create({
          data: {
            id: student.id,
            studentNumber: student.num,
            lastName: student.last,
            firstName: student.first,
            lastNameKana: "カナ",
            firstNameKana: "カナ",
            enrollmentYear: 2024,
          },
        })
      }
      const examStudent1 = await createExamStudentRow(examId, student1)
      await createExamStudentRow(examId, student2)
      const importExamStudent1 = generateId()
      const importExamStudent2 = generateId()

      // 既存スコア: student1+cropRegion1=correct, student1+cropRegion2=incorrect
      await prisma.questionScore.create({
        data: {
          id: generateId(),
          cropRegionId: cropRegion1,
          examStudentId: examStudent1,
          status: "correct",
          partialScore: 10,
          userId: user.id,
        },
      })
      await prisma.questionScore.create({
        data: {
          id: generateId(),
          cropRegionId: cropRegion2,
          examStudentId: examStudent1,
          status: "incorrect",
          partialScore: 0,
          userId: user.id,
        },
      })

      // インポートデータ:
      // student1+cropRegion1=correct (同一 -> unchanged)
      // student1+cropRegion2=correct (異なる -> conflict)
      // student2+cropRegion3=correct (新規 -> new)
      const importExamData = createArchiveExamData({ examId })
      importExamData.examStudents = [
        archiveExamStudent(importExamStudent1, examId, student1),
        archiveExamStudent(importExamStudent2, examId, student2),
      ]
      const importData = createExtractedArchiveData({
        examData: importExamData,
        scoresData: createArchiveScoresData([
          {
            cropRegionId: cropRegion1,
            examStudentId: importExamStudent1,
            status: "correct",
            partialScore: "10",
          },
          {
            cropRegionId: cropRegion2,
            examStudentId: importExamStudent1,
            status: "correct",
            partialScore: "10",
          },
          {
            cropRegionId: cropRegion3,
            examStudentId: importExamStudent2,
            status: "correct",
            partialScore: "10",
          },
        ]),
      })

      const studentMapping = { [student1]: student1, [student2]: student2 }
      const cropRegionMapping = {
        [cropRegion1]: cropRegion1,
        [cropRegion2]: cropRegion2,
        [cropRegion3]: cropRegion3,
      }

      const result = await detectScoringConflicts(
        importData,
        studentMapping,
        cropRegionMapping
      )

      expect(result.unchangedCount).toBe(1)
      expect(result.conflictCount).toBe(1)
      expect(result.newCount).toBe(1)
    })
  })
})

// ===========================================================================
// detectScoringConflictsWithUserDecisions のテスト
// ===========================================================================
describe("detectScoringConflictsWithUserDecisions", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  // =========================================================================
  // 試験IDが不一致の場合
  // =========================================================================
  describe("試験ID不一致", () => {
    it("試験IDが一致しない場合、全て新規として扱い競合なし", async () => {
      const importData = createExtractedArchiveData({
        scoresData: createArchiveScoresData([
          {
            cropRegionId: generateId(),
            examStudentId: generateId(),
            status: "correct",
            partialScore: "10",
          },
        ]),
      })

      // isIdMatch = false
      const preMatchResult = createFileOverviewData({
        exam: {
          isIdMatch: false,
          importExamId: generateId(),
          importData: {},
          displayLabel: "テスト",
        },
      })

      const config = createIdIntegrationConfig()

      const result = await detectScoringConflictsWithUserDecisions(
        importData,
        preMatchResult,
        config
      )

      expect(result.conflictCount).toBe(0)
      expect(result.newCount).toBe(1)
      expect(result.unchangedCount).toBe(0)
    })
  })

  // =========================================================================
  // 試験IDが一致する場合の競合検出
  // =========================================================================
  describe("試験ID一致時の競合検出", () => {
    it("ID一致の生徒と既存CropRegionで異なるスコアがある場合、競合を検出する", async () => {
      const user = await createTestUser()
      const examId = generateId()
      const cropRegionId = generateId()
      const studentId = generateId()

      await createExamWithCropRegions({
        examId,
        cropRegionIds: [cropRegionId],
        userId: user.id,
      })

      await prisma.student.create({
        data: {
          id: studentId,
          studentNumber: "S001",
          lastName: "高橋",
          firstName: "三郎",
          lastNameKana: "タカハシ",
          firstNameKana: "サブロウ",
          enrollmentYear: 2024,
        },
      })
      const examStudentId = await createExamStudentRow(examId, studentId)
      const importExamStudentId = generateId()

      // 既存スコア
      await prisma.questionScore.create({
        data: {
          id: generateId(),
          cropRegionId,
          examStudentId,
          status: "incorrect",
          partialScore: 0,
          userId: user.id,
        },
      })

      // インポートデータ（異なるスコア）
      const examData = createArchiveExamData({
        examId,
        cropRegionsPerPage: 0,
      })
      examData.cropRegions = [
        {
          id: cropRegionId,
          examPageId: examData.examPages[0]?.id ?? generateId(),
          label: "問1",
          type: "QUESTION_ANSWER",
          x: 0,
          y: 0,
          width: 200,
          height: 80,
          points: 10,
          orderIndex: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]

      examData.examStudents = [
        archiveExamStudent(importExamStudentId, examId, studentId),
      ]
      const importData = createExtractedArchiveData({
        examData,
        studentsData: createArchiveStudentsData([
          {
            id: studentId,
            studentNumber: "S001",
            lastName: "高橋",
            firstName: "三郎",
          },
        ]),
        scoresData: createArchiveScoresData([
          {
            cropRegionId,
            examStudentId: importExamStudentId,
            status: "correct",
            partialScore: "10",
            userId: user.id,
          },
        ]),
      })

      const preMatchResult = createFileOverviewData({
        student: createPreMatchingResult({
          byId: [
            createMatchedItem({ importId: studentId, existingId: studentId }),
          ],
          noMatch: [],
        }),
        exam: {
          isIdMatch: true,
          importExamId: examId,
          existingExamId: examId,
          importData: {},
          existingData: {},
          displayLabel: "テスト試験",
        },
      })

      const config = createIdIntegrationConfig({
        student: { strategy: "by_student_number", decisions: [] },
      })

      const result = await detectScoringConflictsWithUserDecisions(
        importData,
        preMatchResult,
        config
      )

      expect(result.conflictCount).toBe(1)
      expect(result.conflicts[0].importScore.status).toBe("correct")
      expect(result.conflicts[0].existingScore.status).toBe("incorrect")
    })
  })

  // =========================================================================
  // by_student_number戦略でのマッピング構築
  // =========================================================================
  describe("by_student_number戦略", () => {
    it("学籍番号一致の生徒もマッピングに含めて競合検出する", async () => {
      const user = await createTestUser()
      const examId = generateId()
      const cropRegionId = generateId()
      const existingStudentId = generateId()
      const importStudentId = generateId()

      await createExamWithCropRegions({
        examId,
        cropRegionIds: [cropRegionId],
        userId: user.id,
      })

      await prisma.student.create({
        data: {
          id: existingStudentId,
          studentNumber: "S001",
          lastName: "田中",
          firstName: "太郎",
          lastNameKana: "タナカ",
          firstNameKana: "タロウ",
          enrollmentYear: 2024,
        },
      })
      const examStudentId = await createExamStudentRow(
        examId,
        existingStudentId
      )
      const importExamStudentId = generateId()

      // 既存スコア
      await prisma.questionScore.create({
        data: {
          id: generateId(),
          cropRegionId,
          examStudentId,
          status: "incorrect",
          partialScore: 0,
          userId: user.id,
        },
      })

      const examData = createArchiveExamData({
        examId,
        cropRegionsPerPage: 0,
      })
      examData.cropRegions = [
        {
          id: cropRegionId,
          examPageId: examData.examPages[0]?.id ?? generateId(),
          label: "問1",
          type: "QUESTION_ANSWER",
          x: 0,
          y: 0,
          width: 200,
          height: 80,
          points: 10,
          orderIndex: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]

      examData.examStudents = [
        archiveExamStudent(importExamStudentId, examId, importStudentId),
      ]
      const importData = createExtractedArchiveData({
        examData,
        studentsData: createArchiveStudentsData([
          {
            id: importStudentId,
            studentNumber: "S001",
            lastName: "田中",
            firstName: "太郎",
          },
        ]),
        scoresData: createArchiveScoresData([
          {
            cropRegionId,
            examStudentId: importExamStudentId,
            status: "correct",
            partialScore: "10",
            userId: user.id,
          },
        ]),
      })

      const preMatchResult = createFileOverviewData({
        student: createPreMatchingResult({
          byId: [],
          byStudentNumber: [
            createMatchedItem({
              importId: importStudentId,
              existingId: existingStudentId,
            }),
          ],
          noMatch: [],
        }),
        exam: {
          isIdMatch: true,
          importExamId: examId,
          existingExamId: examId,
          importData: {},
          existingData: {},
          displayLabel: "テスト試験",
        },
      })

      const config = createIdIntegrationConfig({
        student: { strategy: "by_student_number", decisions: [] },
      })

      const result = await detectScoringConflictsWithUserDecisions(
        importData,
        preMatchResult,
        config
      )

      // 学籍番号一致の生徒がマッピングに含まれるため、競合が検出される
      expect(result.conflictCount).toBe(1)
    })
  })

  // =========================================================================
  // create_new/skip決定でマッピングから除外
  // =========================================================================
  describe("決定によるマッピング除外", () => {
    it("create_new決定の生徒はマッピングから除外され、新規として扱われる", async () => {
      const user = await createTestUser()
      const examId = generateId()
      const cropRegionId = generateId()
      const existingStudentId = generateId()
      const importStudentId = generateId()

      await createExamWithCropRegions({
        examId,
        cropRegionIds: [cropRegionId],
        userId: user.id,
      })

      await prisma.student.create({
        data: {
          id: existingStudentId,
          studentNumber: "S001",
          lastName: "田中",
          firstName: "太郎",
          lastNameKana: "タナカ",
          firstNameKana: "タロウ",
          enrollmentYear: 2024,
        },
      })
      const examStudentId = await createExamStudentRow(
        examId,
        existingStudentId
      )
      const importExamStudentId = generateId()

      await prisma.questionScore.create({
        data: {
          id: generateId(),
          cropRegionId,
          examStudentId,
          status: "incorrect",
          partialScore: 0,
          userId: user.id,
        },
      })

      const examData = createArchiveExamData({
        examId,
        cropRegionsPerPage: 0,
      })
      examData.cropRegions = [
        {
          id: cropRegionId,
          examPageId: examData.examPages[0]?.id ?? generateId(),
          label: "問1",
          type: "QUESTION_ANSWER",
          x: 0,
          y: 0,
          width: 200,
          height: 80,
          points: 10,
          orderIndex: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]

      examData.examStudents = [
        archiveExamStudent(importExamStudentId, examId, importStudentId),
      ]
      const importData = createExtractedArchiveData({
        examData,
        studentsData: createArchiveStudentsData([
          {
            id: importStudentId,
            studentNumber: "S001",
            lastName: "田中",
            firstName: "太郎",
          },
        ]),
        scoresData: createArchiveScoresData([
          {
            cropRegionId,
            examStudentId: importExamStudentId,
            status: "correct",
            partialScore: "10",
            userId: user.id,
          },
        ]),
      })

      const preMatchResult = createFileOverviewData({
        student: createPreMatchingResult({
          byId: [],
          byStudentNumber: [
            createMatchedItem({
              importId: importStudentId,
              existingId: existingStudentId,
            }),
          ],
          noMatch: [],
        }),
        exam: {
          isIdMatch: true,
          importExamId: examId,
          existingExamId: examId,
          importData: {},
          existingData: {},
          displayLabel: "テスト試験",
        },
      })

      // create_new決定でマッピングから除外
      const config = createIdIntegrationConfig({
        student: {
          strategy: "by_student_number",
          decisions: [
            {
              importId: importStudentId,
              decisionType: "create_new",
            },
          ],
        },
      })

      const result = await detectScoringConflictsWithUserDecisions(
        importData,
        preMatchResult,
        config
      )

      // create_newのため、マッピングから除外され競合ではなく新規として扱われる
      expect(result.conflictCount).toBe(0)
      expect(result.newCount).toBe(1)
    })
  })
})
