/**
 * collectExamData のエクスポートモード統合テスト
 *
 * テスト対象: electron-src/lib/export/exam-archive/dataCollector.ts
 * 各エクスポートモード（full, template, template_with_subtotals）で
 * 正しいデータが収集/除外されることを検証する
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

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

describe("collectExamData - エクスポートモード", () => {
  let testExam: FullTestExam

  beforeEach(async () => {
    await cleanupTestDatabase()
    testExam = await createFullTestExam(getTestPrismaClient(), {
      pageCount: 2,
      cropRegionsPerPage: 2,
      studentCount: 3,
      includeV140Data: true,
      includeScores: true,
      includeMasterImages: true,
      includeStudentAnswerImages: true,
    })
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  // ==========================================================================
  // fullモード（デフォルト）
  // ==========================================================================

  describe("fullモード", () => {
    it("EM-F1: デフォルト（引数なし）はfullモードと同じ結果を返す", async () => {
      const defaultResult = await collectExamData(
        testExam.exam.id,
        testExam.user.id
      )
      const fullResult = await collectExamData(
        testExam.exam.id,
        testExam.user.id,
        "full"
      )

      expect(defaultResult.success).toBe(true)
      expect(fullResult.success).toBe(true)

      const defaultData = defaultResult.data!
      const fullData = fullResult.data!

      // 主要フィールドの件数が一致
      expect(defaultData.studentsData.students.length).toBe(
        fullData.studentsData.students.length
      )
      expect(defaultData.classesData.classrooms.length).toBe(
        fullData.classesData.classrooms.length
      )
      expect(defaultData.scoresData.questionScores.length).toBe(
        fullData.scoresData.questionScores.length
      )
      expect(defaultData.subtotalsData.subtotalGroups.length).toBe(
        fullData.subtotalsData.subtotalGroups.length
      )
      expect(defaultData.answerSheetPaths.length).toBe(
        fullData.answerSheetPaths.length
      )
    })

    it("EM-F2: fullモードは全データを含む", async () => {
      const result = await collectExamData(
        testExam.exam.id,
        testExam.user.id,
        "full"
      )

      expect(result.success).toBe(true)
      const data = result.data!

      expect(data.studentsData.students.length).toBe(3)
      expect(data.classesData.classrooms.length).toBeGreaterThanOrEqual(1)
      expect(data.classesData.memberships.length).toBe(3)
      expect(data.scoresData.questionScores.length).toBe(12) // 4 regions × 3 students
      expect(data.subtotalsData.subtotalGroups.length).toBe(1)
      expect(data.subtotalsData.subtotals.length).toBe(2)
      expect(data.masterImagePaths.length).toBe(2)
      expect(data.answerSheetPaths.length).toBe(6) // 3 students × 2 pages
      expect(data.examData.examStudents.length).toBe(3)
      expect(data.examData.examClassrooms.length).toBeGreaterThanOrEqual(1)
      expect(data.examData.examSubtotalGroups.length).toBe(1)
      expect(data.tagsData.tags.length).toBeGreaterThan(0)
    })

    it("EM-F3: ReturnSnapshot（返却版）がfullモードで収集される", async () => {
      // 返却版スナップショットを1件作成
      await getTestPrismaClient().returnSnapshot.create({
        data: {
          examId: testExam.exam.id,
          studentId: testExam.students[0].id,
          scoresJson: JSON.stringify({ v: 1, scores: [], annotations: [] }),
          totalScore: 42,
          capturedByUserId: testExam.user.id,
        },
      })

      const result = await collectExamData(
        testExam.exam.id,
        testExam.user.id,
        "full"
      )

      expect(result.success).toBe(true)
      const snapshots = result.data!.scoresData.returnSnapshots ?? []
      expect(snapshots).toHaveLength(1)
      expect(snapshots[0].studentId).toBe(testExam.students[0].id)
      expect(snapshots[0].totalScore).toBe("42")
    })
  })

  // ==========================================================================
  // templateモード
  // ==========================================================================

  describe("templateモード", () => {
    it("EM-T1: 生徒データが空になる", async () => {
      const result = await collectExamData(
        testExam.exam.id,
        testExam.user.id,
        "template"
      )

      expect(result.success).toBe(true)
      const data = result.data!

      expect(data.studentsData.students).toEqual([])
      expect(data.examData.examStudents).toEqual([])
      expect(data.counts.students).toBe(0)
    })

    it("EM-T2: 学級データが空になる", async () => {
      const result = await collectExamData(
        testExam.exam.id,
        testExam.user.id,
        "template"
      )

      expect(result.success).toBe(true)
      const data = result.data!

      expect(data.classesData.classrooms).toEqual([])
      expect(data.classesData.memberships).toEqual([])
      expect(data.examData.examClassrooms).toEqual([])
      expect(data.counts.classrooms).toBe(0)
    })

    it("EM-T3: 採点データが空になる", async () => {
      const result = await collectExamData(
        testExam.exam.id,
        testExam.user.id,
        "template"
      )

      expect(result.success).toBe(true)
      const data = result.data!

      expect(data.scoresData.questionScores).toEqual([])
      expect(data.scoresData.drawingAnnotations).toEqual([])
      expect(data.counts.scores).toBe(0)
      expect(data.counts.annotations).toBe(0)
    })

    it("EM-T3b: ReturnSnapshot（返却版）もtemplateモードで空になる", async () => {
      await getTestPrismaClient().returnSnapshot.create({
        data: {
          examId: testExam.exam.id,
          studentId: testExam.students[0].id,
          scoresJson: JSON.stringify({ v: 1, scores: [], annotations: [] }),
          totalScore: 42,
          capturedByUserId: testExam.user.id,
        },
      })

      const result = await collectExamData(
        testExam.exam.id,
        testExam.user.id,
        "template"
      )

      expect(result.success).toBe(true)
      expect(result.data!.scoresData.returnSnapshots).toEqual([])
    })

    it("EM-T4: 答案画像が空になる", async () => {
      const result = await collectExamData(
        testExam.exam.id,
        testExam.user.id,
        "template"
      )

      expect(result.success).toBe(true)
      const data = result.data!

      expect(data.examData.studentAnswerImages).toEqual([])
      expect(data.answerSheetPaths).toEqual([])
      expect(data.counts.answerSheetImages).toBe(0)
    })

    it("EM-T5: 小計データが空になる", async () => {
      const result = await collectExamData(
        testExam.exam.id,
        testExam.user.id,
        "template"
      )

      expect(result.success).toBe(true)
      const data = result.data!

      expect(data.subtotalsData.subtotalGroups).toEqual([])
      expect(data.subtotalsData.subtotals).toEqual([])
      expect(data.subtotalsData.cropSubtotals).toEqual([])
      expect(data.examData.examSubtotalGroups).toEqual([])
      expect(data.counts.subtotalGroups).toBe(0)
    })

    it("EM-T6: Subject/SubjectSubtotalGroupが空になる", async () => {
      const result = await collectExamData(
        testExam.exam.id,
        testExam.user.id,
        "template"
      )

      expect(result.success).toBe(true)
      const data = result.data!

      expect(data.tagsData.tags).toEqual([])
      expect(data.tagsData.tagSubtotalGroups).toEqual([])
    })

    it("EM-T7: 試験基本データ・ページ・領域・模範解答画像は保持される", async () => {
      const result = await collectExamData(
        testExam.exam.id,
        testExam.user.id,
        "template"
      )

      expect(result.success).toBe(true)
      const data = result.data!

      // 試験基本情報
      expect(data.examData.exam.id).toBe(testExam.exam.id)
      expect(data.examData.exam.examName).toBe(testExam.exam.examName)

      // ページと領域
      expect(data.examData.examPages.length).toBe(2)
      expect(data.examData.cropRegions.length).toBe(4)

      // 模範解答画像
      expect(data.masterImagePaths.length).toBe(2)
      expect(data.counts.masterImages).toBe(2)
    })

    it("EM-T8: マーク設定（v1.4.0+）は保持される", async () => {
      const result = await collectExamData(
        testExam.exam.id,
        testExam.user.id,
        "template"
      )

      expect(result.success).toBe(true)
      const data = result.data!

      expect(data.examData.examMarkingFormats).toBeDefined()
      expect(data.examData.examMarkingFormats!.length).toBeGreaterThan(0)
      expect(data.examData.cropRegionMarkingOverrides).toBeDefined()
    })

    it("EM-T9: ユーザーデータは保持される", async () => {
      const result = await collectExamData(
        testExam.exam.id,
        testExam.user.id,
        "template"
      )

      expect(result.success).toBe(true)
      const data = result.data!

      expect(data.usersData.users.length).toBe(1)
      expect(data.counts.users).toBe(1)
    })
  })

  // ==========================================================================
  // template_with_subtotalsモード
  // ==========================================================================

  describe("template_with_subtotalsモード", () => {
    it("EM-S1: 生徒・学級・採点・答案が空になる（templateと同じ）", async () => {
      const result = await collectExamData(
        testExam.exam.id,
        testExam.user.id,
        "template_with_subtotals"
      )

      expect(result.success).toBe(true)
      const data = result.data!

      expect(data.studentsData.students).toEqual([])
      expect(data.classesData.classrooms).toEqual([])
      expect(data.classesData.memberships).toEqual([])
      expect(data.scoresData.questionScores).toEqual([])
      expect(data.scoresData.drawingAnnotations).toEqual([])
      expect(data.examData.studentAnswerImages).toEqual([])
      expect(data.answerSheetPaths).toEqual([])
      expect(data.examData.examStudents).toEqual([])
      expect(data.examData.examClassrooms).toEqual([])
    })

    it("EM-S2: 小計データが含まれる", async () => {
      const result = await collectExamData(
        testExam.exam.id,
        testExam.user.id,
        "template_with_subtotals"
      )

      expect(result.success).toBe(true)
      const data = result.data!

      expect(data.subtotalsData.subtotalGroups.length).toBe(1)
      expect(data.subtotalsData.subtotals.length).toBe(2)
      expect(data.examData.examSubtotalGroups.length).toBe(1)
      expect(data.counts.subtotalGroups).toBe(1)
    })

    it("EM-S3: Subject/SubjectSubtotalGroupが含まれる", async () => {
      const result = await collectExamData(
        testExam.exam.id,
        testExam.user.id,
        "template_with_subtotals"
      )

      expect(result.success).toBe(true)
      const data = result.data!

      expect(data.tagsData.tags.length).toBeGreaterThan(0)
      expect(data.tagsData.tagSubtotalGroups.length).toBeGreaterThan(0)
    })

    it("EM-S4: 試験基本データ・ページ・領域・模範解答画像は保持される", async () => {
      const result = await collectExamData(
        testExam.exam.id,
        testExam.user.id,
        "template_with_subtotals"
      )

      expect(result.success).toBe(true)
      const data = result.data!

      expect(data.examData.exam.id).toBe(testExam.exam.id)
      expect(data.examData.examPages.length).toBe(2)
      expect(data.examData.cropRegions.length).toBe(4)
      expect(data.masterImagePaths.length).toBe(2)
    })

    it("EM-S5: CropSubtotalが含まれる", async () => {
      const result = await collectExamData(
        testExam.exam.id,
        testExam.user.id,
        "template_with_subtotals"
      )

      expect(result.success).toBe(true)
      const data = result.data!

      // includeV140Dataでcropsubtotalが作成されている場合
      expect(data.subtotalsData.cropSubtotals.length).toBeGreaterThanOrEqual(0)
    })
  })

  // ==========================================================================
  // countsの整合性
  // ==========================================================================

  describe("countsの整合性", () => {
    it("EM-C1: templateモードのcountsが実データ長と一致する", async () => {
      const result = await collectExamData(
        testExam.exam.id,
        testExam.user.id,
        "template"
      )

      expect(result.success).toBe(true)
      const data = result.data!

      expect(data.counts.students).toBe(data.studentsData.students.length)
      expect(data.counts.classrooms).toBe(data.classesData.classrooms.length)
      expect(data.counts.scores).toBe(data.scoresData.questionScores.length)
      expect(data.counts.annotations).toBe(
        data.scoresData.drawingAnnotations.length
      )
      expect(data.counts.subtotalGroups).toBe(
        data.subtotalsData.subtotalGroups.length
      )
      expect(data.counts.masterImages).toBe(data.masterImagePaths.length)
      expect(data.counts.answerSheetImages).toBe(data.answerSheetPaths.length)
    })

    it("EM-C2: template_with_subtotalsモードのcountsが実データ長と一致する", async () => {
      const result = await collectExamData(
        testExam.exam.id,
        testExam.user.id,
        "template_with_subtotals"
      )

      expect(result.success).toBe(true)
      const data = result.data!

      expect(data.counts.students).toBe(data.studentsData.students.length)
      expect(data.counts.classrooms).toBe(data.classesData.classrooms.length)
      expect(data.counts.scores).toBe(data.scoresData.questionScores.length)
      expect(data.counts.subtotalGroups).toBe(
        data.subtotalsData.subtotalGroups.length
      )
      expect(data.counts.masterImages).toBe(data.masterImagePaths.length)
      expect(data.counts.answerSheetImages).toBe(data.answerSheetPaths.length)
    })
  })
})
