/**
 * idChangeExecutor の統合テスト
 *
 * テスト対象: electron-src/lib/import/merge/idChangeExecutor.ts
 * 実際のSQLiteテスト用DBを使用し、Stage 2のID変更処理を検証する
 * FK参照の連鎖的更新と古いレコードの削除を確認する
 *
 * Student.studentNumberとClass.nameのUNIQUE制約はtemp-value方式で回避される。
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import type { IdChangeTarget } from "../../../electron-src/lib/import/merge/types"
import {
  createEmptyIdMappings,
  generateId,
} from "../../helpers/testDataFactory"
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

import { executeIdChanges } from "../../../electron-src/lib/import/merge/idChangeExecutor"

const prisma = getTestPrismaClient()

describe("executeIdChanges", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  // =========================================================================
  // 小計グループID変更のテスト
  // =========================================================================
  describe("小計グループID変更", () => {
    it("新しいIDでレコードを作成し、FK参照を更新し、古いレコードを削除する", async () => {
      const existingGroupId = generateId()
      const newGroupId = generateId()
      const examId = generateId()

      // 小計グループを作成
      await prisma.subtotalGroup.create({
        data: {
          id: existingGroupId,
          name: "知識・技能",
        },
      })

      // 試験を作成
      await prisma.exam.create({
        data: { id: examId, examName: "テスト" },
      })

      // ExamSubtotalGroup
      const examSubtotalGroupId = generateId()
      await prisma.examSubtotalGroup.create({
        data: {
          id: examSubtotalGroupId,
          examId,
          subtotalGroupId: existingGroupId,
        },
      })

      // Subtotal
      const subtotalId = generateId()
      await prisma.subtotal.create({
        data: {
          id: subtotalId,
          name: "計算問題",
          subtotalGroupId: existingGroupId,
          order: 0,
        },
      })

      const targets: IdChangeTarget[] = [
        {
          category: "subtotalGroup",
          existingId: existingGroupId,
          newId: newGroupId,
        },
      ]

      const idMappings = createEmptyIdMappings()
      idMappings.subtotalGroup["import-group-1"] = existingGroupId
      const warnings: string[] = []

      await prisma.$transaction(async (tx) => {
        await executeIdChanges(targets, idMappings, warnings, tx)
      })

      // 新しいIDでレコードが存在すること
      const newGroup = await prisma.subtotalGroup.findUnique({
        where: { id: newGroupId },
      })
      expect(newGroup).not.toBeNull()
      expect(newGroup!.name).toBe("知識・技能")

      // 古いIDのレコードが削除されていること
      const oldGroup = await prisma.subtotalGroup.findUnique({
        where: { id: existingGroupId },
      })
      expect(oldGroup).toBeNull()

      // FK参照が更新されていること
      const examSubtotalGroup = await prisma.examSubtotalGroup.findUnique({
        where: { id: examSubtotalGroupId },
      })
      expect(examSubtotalGroup!.subtotalGroupId).toBe(newGroupId)

      const subtotal = await prisma.subtotal.findUnique({
        where: { id: subtotalId },
      })
      expect(subtotal!.subtotalGroupId).toBe(newGroupId)

      // マッピングが更新されていること
      expect(idMappings.subtotalGroup["import-group-1"]).toBe(newGroupId)

      // 警告なし
      expect(warnings).toHaveLength(0)
    })

    it("ID変更後にidMappingsの全エントリが更新される", async () => {
      const existingGroupId = generateId()
      const newGroupId = generateId()

      await prisma.subtotalGroup.create({
        data: { id: existingGroupId, name: "テストグループ" },
      })

      const targets: IdChangeTarget[] = [
        {
          category: "subtotalGroup",
          existingId: existingGroupId,
          newId: newGroupId,
        },
      ]

      const idMappings = createEmptyIdMappings()
      const importId1 = "import-1"
      const importId2 = "import-2"
      // 2つの異なるインポートIDが同じ既存IDにマッピングされている場合
      idMappings.subtotalGroup[importId1] = existingGroupId
      idMappings.subtotalGroup[importId2] = existingGroupId
      const warnings: string[] = []

      await prisma.$transaction(async (tx) => {
        await executeIdChanges(targets, idMappings, warnings, tx)
      })

      // 両方のマッピングが新しいIDに更新されていること
      expect(idMappings.subtotalGroup[importId1]).toBe(newGroupId)
      expect(idMappings.subtotalGroup[importId2]).toBe(newGroupId)
    })

    it("複数のFK参照（ExamSubtotalGroup + Subtotal）が全て更新される", async () => {
      const existingGroupId = generateId()
      const newGroupId = generateId()
      const exam1Id = generateId()
      const exam2Id = generateId()

      await prisma.subtotalGroup.create({
        data: { id: existingGroupId, name: "思考・判断" },
      })

      await prisma.exam.create({
        data: { id: exam1Id, examName: "テスト1" },
      })
      await prisma.exam.create({
        data: { id: exam2Id, examName: "テスト2" },
      })

      // 複数のExamSubtotalGroup
      const examSubtotalGroup1Id = generateId()
      const examSubtotalGroup2Id = generateId()
      await prisma.examSubtotalGroup.create({
        data: {
          id: examSubtotalGroup1Id,
          examId: exam1Id,
          subtotalGroupId: existingGroupId,
        },
      })
      await prisma.examSubtotalGroup.create({
        data: {
          id: examSubtotalGroup2Id,
          examId: exam2Id,
          subtotalGroupId: existingGroupId,
        },
      })

      // 複数のSubtotal
      const subtotal1Id = generateId()
      const subtotal2Id = generateId()
      await prisma.subtotal.create({
        data: {
          id: subtotal1Id,
          name: "小計A",
          subtotalGroupId: existingGroupId,
          order: 0,
        },
      })
      await prisma.subtotal.create({
        data: {
          id: subtotal2Id,
          name: "小計B",
          subtotalGroupId: existingGroupId,
          order: 1,
        },
      })

      const targets: IdChangeTarget[] = [
        {
          category: "subtotalGroup",
          existingId: existingGroupId,
          newId: newGroupId,
        },
      ]

      const idMappings = createEmptyIdMappings()
      const warnings: string[] = []

      await prisma.$transaction(async (tx) => {
        await executeIdChanges(targets, idMappings, warnings, tx)
      })

      // 全てのFK参照が更新されていること
      const examSubtotalGroup1 = await prisma.examSubtotalGroup.findUnique({
        where: { id: examSubtotalGroup1Id },
      })
      const examSubtotalGroup2 = await prisma.examSubtotalGroup.findUnique({
        where: { id: examSubtotalGroup2Id },
      })
      expect(examSubtotalGroup1!.subtotalGroupId).toBe(newGroupId)
      expect(examSubtotalGroup2!.subtotalGroupId).toBe(newGroupId)

      const subtotal1 = await prisma.subtotal.findUnique({
        where: { id: subtotal1Id },
      })
      const subtotal2 = await prisma.subtotal.findUnique({
        where: { id: subtotal2Id },
      })
      expect(subtotal1!.subtotalGroupId).toBe(newGroupId)
      expect(subtotal2!.subtotalGroupId).toBe(newGroupId)
    })
  })

  // =========================================================================
  // 生徒ID変更のテスト（temp-value方式でUNIQUE制約を回避）
  // =========================================================================
  describe("生徒ID変更", () => {
    it("temp-value方式により新しいIDでレコードを作成し、FK参照を更新し、古いレコードを削除する", async () => {
      const existingStudentId = generateId()
      const newStudentId = generateId()

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

      const targets: IdChangeTarget[] = [
        {
          category: "student",
          existingId: existingStudentId,
          newId: newStudentId,
        },
      ]

      const idMappings = createEmptyIdMappings()
      idMappings.student["import-id-1"] = existingStudentId
      const warnings: string[] = []

      await prisma.$transaction(async (tx) => {
        await executeIdChanges(targets, idMappings, warnings, tx)
      })

      // 新しいIDでレコードが存在し、元のstudentNumberを保持していること
      const newStudent = await prisma.student.findUnique({
        where: { id: newStudentId },
      })
      expect(newStudent).not.toBeNull()
      expect(newStudent!.studentNumber).toBe("S001")

      // 古いIDのレコードが削除されていること
      const oldStudent = await prisma.student.findUnique({
        where: { id: existingStudentId },
      })
      expect(oldStudent).toBeNull()

      // マッピングが更新されていること
      expect(idMappings.student["import-id-1"]).toBe(newStudentId)

      // 警告なし
      expect(warnings).toHaveLength(0)
    })

    it("ScoreDecision/CompoundAnswerScore がカスケード削除されず受験者ごと引き継がれる", async () => {
      const existingStudentId = generateId()
      const newStudentId = generateId()
      const examId = generateId()
      const examStudentId = generateId()
      const pageId = generateId()
      const regionId = generateId()
      const userId = generateId()
      const compoundId = generateId()

      await prisma.user.create({
        data: { id: userId, username: `u_${Date.now()}`, name: "採点者" },
      })
      await prisma.student.create({
        data: {
          id: existingStudentId,
          studentNumber: "SD001",
          lastName: "佐藤",
          firstName: "花子",
          lastNameKana: "サトウ",
          firstNameKana: "ハナコ",
          enrollmentYear: 2024,
        },
      })
      await prisma.exam.create({ data: { id: examId, examName: "確定テスト" } })
      await prisma.examStudent.create({
        data: {
          id: examStudentId,
          examId,
          studentId: existingStudentId,
          status: "participating",
        },
      })
      await prisma.examPage.create({
        data: { id: pageId, examId, pageNumber: 1 },
      })
      await prisma.cropRegion.create({
        data: {
          id: regionId,
          examPageId: pageId,
          label: "問1",
          type: "rectangle",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
        },
      })

      // ScoreDecision（student に onDelete:Cascade）
      const decisionId = generateId()
      await prisma.scoreDecision.create({
        data: {
          id: decisionId,
          cropRegionId: regionId,
          examStudentId,
          verdict: "correct",
          score: 10,
          decidedByUserId: userId,
        },
      })

      // CompoundAnswer + CompoundAnswerScore（student に onDelete:Cascade）
      await prisma.compoundAnswer.create({
        data: {
          id: compoundId,
          examPageId: pageId,
          label: "複合",
          answerFormat: "fraction",
          correctAnswer: "1/2",
          points: 5,
        },
      })
      const compoundAnswerScoreId = generateId()
      await prisma.compoundAnswerScore.create({
        data: {
          id: compoundAnswerScoreId,
          compoundAnswerId: compoundId,
          examStudentId,
          userId,
          status: "correct",
        },
      })

      const targets: IdChangeTarget[] = [
        {
          category: "student",
          existingId: existingStudentId,
          newId: newStudentId,
        },
      ]
      const idMappings = createEmptyIdMappings()
      const warnings: string[] = []

      await prisma.$transaction(async (tx) => {
        await executeIdChanges(targets, idMappings, warnings, tx)
      })

      // 受験者（ExamStudent）が新IDへ移し替えられている
      const examStudent = await prisma.examStudent.findUnique({
        where: { id: examStudentId },
      })
      expect(examStudent).not.toBeNull()
      expect(examStudent!.studentId).toBe(newStudentId)

      // 採点層は受験者の子なので、id を保ったまま生き残る
      const decision = await prisma.scoreDecision.findUnique({
        where: { id: decisionId },
      })
      expect(decision).not.toBeNull()
      expect(decision!.examStudentId).toBe(examStudentId)

      const compoundAnswerScore = await prisma.compoundAnswerScore.findUnique({
        where: { id: compoundAnswerScoreId },
      })
      expect(compoundAnswerScore).not.toBeNull()
      expect(compoundAnswerScore!.examStudentId).toBe(examStudentId)
    })
  })

  // =========================================================================
  // 学級ID変更のテスト（temp-value方式でUNIQUE制約を回避）
  // =========================================================================
  describe("学級ID変更", () => {
    it("temp-value方式により新しいIDでレコードを作成し、FK参照を更新し、古いレコードを削除する", async () => {
      const existingClassroomId = generateId()
      const newClassroomId = generateId()
      const studentId = generateId()
      const examId = generateId()

      await prisma.classroom.create({
        data: {
          id: existingClassroomId,
          name: "1年A組",
          classroomCode: "1A",
          grade: 1,
        },
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

      await prisma.exam.create({
        data: { id: examId, examName: "期末テスト" },
      })

      // FK参照を作成
      const membershipId = generateId()
      await prisma.studentClassroomMembership.create({
        data: { id: membershipId, studentId, classroomId: existingClassroomId },
      })

      const examClassroomId = generateId()
      await prisma.examClassroom.create({
        data: { id: examClassroomId, examId, classroomId: existingClassroomId },
      })

      const targets: IdChangeTarget[] = [
        {
          category: "classroom",
          existingId: existingClassroomId,
          newId: newClassroomId,
        },
      ]

      const idMappings = createEmptyIdMappings()
      idMappings.classroom["import-class-1"] = existingClassroomId
      const warnings: string[] = []

      await prisma.$transaction(async (tx) => {
        await executeIdChanges(targets, idMappings, warnings, tx)
      })

      // 新しいIDでレコードが存在し、元のnameを保持していること
      const newClassroom = await prisma.classroom.findUnique({
        where: { id: newClassroomId },
      })
      expect(newClassroom).not.toBeNull()
      expect(newClassroom!.name).toBe("1年A組")

      // 古いIDのレコードが削除されていること
      const oldClass = await prisma.classroom.findUnique({
        where: { id: existingClassroomId },
      })
      expect(oldClass).toBeNull()

      // FK参照が更新されていること
      const membership = await prisma.studentClassroomMembership.findUnique({
        where: { id: membershipId },
      })
      expect(membership!.classroomId).toBe(newClassroomId)

      const examClassroom = await prisma.examClassroom.findFirst({
        where: { id: examClassroomId },
      })
      expect(examClassroom!.classroomId).toBe(newClassroomId)

      // マッピングが更新されていること
      expect(idMappings.classroom["import-class-1"]).toBe(newClassroomId)

      // 警告なし
      expect(warnings).toHaveLength(0)
    })
  })

  // =========================================================================
  // エラーハンドリング: 対象が存在しない場合
  // =========================================================================
  describe("エラーハンドリング", () => {
    it("変更対象の生徒が存在しない場合、警告なしにスキップされる", async () => {
      const nonExistentId = generateId()
      const newId = generateId()

      const targets: IdChangeTarget[] = [
        { category: "student", existingId: nonExistentId, newId },
      ]

      const idMappings = createEmptyIdMappings()
      const warnings: string[] = []

      // エラーなく完了すること
      await prisma.$transaction(async (tx) => {
        await executeIdChanges(targets, idMappings, warnings, tx)
      })

      // 新しいIDのレコードは作成されないこと
      const student = await prisma.student.findUnique({ where: { id: newId } })
      expect(student).toBeNull()
      expect(warnings).toHaveLength(0)
    })

    it("変更対象の学級が存在しない場合、警告なしにスキップされる", async () => {
      const nonExistentId = generateId()
      const newId = generateId()

      const targets: IdChangeTarget[] = [
        { category: "classroom", existingId: nonExistentId, newId },
      ]

      const idMappings = createEmptyIdMappings()
      const warnings: string[] = []

      await prisma.$transaction(async (tx) => {
        await executeIdChanges(targets, idMappings, warnings, tx)
      })

      const classroom = await prisma.classroom.findUnique({
        where: { id: newId },
      })
      expect(classroom).toBeNull()
      expect(warnings).toHaveLength(0)
    })

    it("変更対象の小計グループが存在しない場合、警告なしにスキップされる", async () => {
      const nonExistentId = generateId()
      const newId = generateId()

      const targets: IdChangeTarget[] = [
        { category: "subtotalGroup", existingId: nonExistentId, newId },
      ]

      const idMappings = createEmptyIdMappings()
      const warnings: string[] = []

      await prisma.$transaction(async (tx) => {
        await executeIdChanges(targets, idMappings, warnings, tx)
      })

      const group = await prisma.subtotalGroup.findUnique({
        where: { id: newId },
      })
      expect(group).toBeNull()
      expect(warnings).toHaveLength(0)
    })
  })

  // =========================================================================
  // 複数のID変更を一括処理
  // =========================================================================
  describe("複数ターゲットの一括処理", () => {
    it("全カテゴリのID変更が正常に処理される", async () => {
      const existingStudentId = generateId()
      const newStudentId = generateId()
      const existingClassroomId = generateId()
      const newClassroomId = generateId()
      const existingGroupId = generateId()
      const newGroupId = generateId()

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

      await prisma.classroom.create({
        data: { id: existingClassroomId, name: "1年A組" },
      })

      await prisma.subtotalGroup.create({
        data: { id: existingGroupId, name: "知識" },
      })

      const targets: IdChangeTarget[] = [
        {
          category: "student",
          existingId: existingStudentId,
          newId: newStudentId,
        },
        {
          category: "classroom",
          existingId: existingClassroomId,
          newId: newClassroomId,
        },
        {
          category: "subtotalGroup",
          existingId: existingGroupId,
          newId: newGroupId,
        },
      ]

      const idMappings = createEmptyIdMappings()
      idMappings.student["s1"] = existingStudentId
      idMappings.classroom["c1"] = existingClassroomId
      idMappings.subtotalGroup["g1"] = existingGroupId
      const warnings: string[] = []

      await prisma.$transaction(async (tx) => {
        await executeIdChanges(targets, idMappings, warnings, tx)
      })

      // SubtotalGroup: 正常にID変更される
      expect(
        await prisma.subtotalGroup.findUnique({ where: { id: newGroupId } })
      ).not.toBeNull()
      expect(
        await prisma.subtotalGroup.findUnique({
          where: { id: existingGroupId },
        })
      ).toBeNull()
      expect(idMappings.subtotalGroup["g1"]).toBe(newGroupId)

      // Student: temp-value方式で正常にID変更される
      expect(
        await prisma.student.findUnique({ where: { id: newStudentId } })
      ).not.toBeNull()
      expect(
        await prisma.student.findUnique({ where: { id: existingStudentId } })
      ).toBeNull()
      expect(idMappings.student["s1"]).toBe(newStudentId)

      // Class: temp-value方式で正常にID変更される
      expect(
        await prisma.classroom.findUnique({ where: { id: newClassroomId } })
      ).not.toBeNull()
      expect(
        await prisma.classroom.findUnique({
          where: { id: existingClassroomId },
        })
      ).toBeNull()
      expect(idMappings.classroom["c1"]).toBe(newClassroomId)

      // 警告なし
      expect(warnings).toHaveLength(0)
    })
  })
})
