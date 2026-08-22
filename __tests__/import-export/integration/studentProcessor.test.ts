/**
 * studentProcessor の統合テスト
 *
 * テスト対象: electron-src/lib/import/merge/processors/studentProcessor.ts
 * 実際のSQLiteテスト用DBを使用し、生徒ID統合処理を検証する
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import type { IdChangeTarget } from "../../../electron-src/lib/import/merge/types"
import {
  createArchiveStudentsData,
  createDecision,
  createEmptyIdMappings,
  createEmptyImportCounts,
  createExtractedArchiveData,
  createFileOverviewData,
  createMatchedItem,
  createPreMatchingResult,
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

import { createImportValuePolicy } from "../../../electron-src/lib/import/merge/importValuePolicy"
import { processStudentIdIntegration } from "../../../electron-src/lib/import/merge/processors/studentProcessor"

const prisma = getTestPrismaClient()

/**
 * 取り込みの方針（上書きする / 統合する / 別で追加する）。
 * 既定は「統合する」＝ LWW。上書きを見るテストだけ個別に作る。
 */
const policy = createImportValuePolicy("merge")

describe("processStudentIdIntegration", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  // =========================================================================
  // ID一致（byId）のテスト
  // =========================================================================
  describe("ID一致（byId）", () => {
    it("同一IDの生徒が存在する場合、自動でマッピングされる", async () => {
      const studentId = generateId()
      const importId = studentId
      const existingId = studentId

      // 既存の生徒をDBに作成
      await prisma.student.create({
        data: {
          id: existingId,
          studentNumber: "S001",
          lastName: "田中",
          firstName: "太郎",
          lastNameKana: "タナカ",
          firstNameKana: "タロウ",
          enrollmentYear: 2024,
        },
      })

      const data = createExtractedArchiveData({
        studentsData: createArchiveStudentsData([
          {
            id: importId,
            studentNumber: "S001",
            lastName: "田中",
            firstName: "太郎",
          },
        ]),
      })

      const preMatchResult = createFileOverviewData({
        student: createPreMatchingResult({
          byId: [createMatchedItem({ importId, existingId })],
          noMatch: [],
        }),
      })

      const idMappings = createEmptyIdMappings()
      const idChangeTargets: IdChangeTarget[] = []
      const counts = createEmptyImportCounts()
      const warnings: string[] = []

      await prisma.$transaction(async (tx) => {
        await processStudentIdIntegration(
          data,
          preMatchResult,
          { strategy: "by_student_number", decisions: [] },
          idMappings,
          idChangeTargets,
          counts,
          warnings,
          policy,
          tx
        )
      })

      expect(idMappings.student[importId]).toBe(existingId)
    })
  })

  // =========================================================================
  // 学籍番号一致（byStudentNumber） + by_student_number戦略
  // =========================================================================
  describe("学籍番号一致（by_student_number戦略）", () => {
    it("学籍番号が一致する場合、same_personとして自動マッピングされる", async () => {
      const existingId = generateId()
      const importId = generateId()

      await prisma.student.create({
        data: {
          id: existingId,
          studentNumber: "S001",
          lastName: "田中",
          firstName: "太郎",
          lastNameKana: "タナカ",
          firstNameKana: "タロウ",
          enrollmentYear: 2024,
        },
      })

      const data = createExtractedArchiveData({
        studentsData: createArchiveStudentsData([
          {
            id: importId,
            studentNumber: "S001",
            lastName: "田中",
            firstName: "太郎",
          },
        ]),
      })

      const preMatchResult = createFileOverviewData({
        student: createPreMatchingResult({
          byStudentNumber: [createMatchedItem({ importId, existingId })],
          noMatch: [],
        }),
      })

      const idMappings = createEmptyIdMappings()
      const idChangeTargets: IdChangeTarget[] = []
      const counts = createEmptyImportCounts()
      const warnings: string[] = []

      await prisma.$transaction(async (tx) => {
        await processStudentIdIntegration(
          data,
          preMatchResult,
          { strategy: "by_student_number", decisions: [] },
          idMappings,
          idChangeTargets,
          counts,
          warnings,
          policy,
          tx
        )
      })

      // 既存IDにマッピングされること
      expect(idMappings.student[importId]).toBe(existingId)
      // ID変更ターゲットには追加されないこと（use_existing_idのため）
      expect(idChangeTargets).toHaveLength(0)
    })
  })

  // =========================================================================
  // 氏名一致（byName） + by_name戦略
  // =========================================================================
  describe("氏名一致（by_name戦略）", () => {
    it("氏名が一致する場合、same_personとして自動マッピングされる", async () => {
      const existingId = generateId()
      const importId = generateId()

      await prisma.student.create({
        data: {
          id: existingId,
          studentNumber: "S100",
          lastName: "佐藤",
          firstName: "花子",
          lastNameKana: "サトウ",
          firstNameKana: "ハナコ",
          enrollmentYear: 2024,
        },
      })

      const data = createExtractedArchiveData({
        studentsData: createArchiveStudentsData([
          {
            id: importId,
            studentNumber: "S200",
            lastName: "佐藤",
            firstName: "花子",
          },
        ]),
      })

      const preMatchResult = createFileOverviewData({
        student: createPreMatchingResult({
          byName: [createMatchedItem({ importId, existingId })],
          noMatch: [],
        }),
      })

      const idMappings = createEmptyIdMappings()
      const idChangeTargets: IdChangeTarget[] = []
      const counts = createEmptyImportCounts()
      const warnings: string[] = []

      await prisma.$transaction(async (tx) => {
        await processStudentIdIntegration(
          data,
          preMatchResult,
          { strategy: "by_name", decisions: [] },
          idMappings,
          idChangeTargets,
          counts,
          warnings,
          policy,
          tx
        )
      })

      expect(idMappings.student[importId]).toBe(existingId)
    })
  })

  // =========================================================================
  // 一致なし + create_new
  // =========================================================================
  describe("一致なし（create_new）", () => {
    it("一致するレコードがない場合、新規生徒がDBに作成される", async () => {
      const importId = generateId()

      const data = createExtractedArchiveData({
        studentsData: createArchiveStudentsData([
          {
            id: importId,
            studentNumber: "S999",
            lastName: "山田",
            firstName: "一郎",
            lastNameKana: "ヤマダ",
            firstNameKana: "イチロウ",
            enrollmentYear: 2024,
          },
        ]),
      })

      const preMatchResult = createFileOverviewData({
        student: createPreMatchingResult({
          noMatch: [{ importId, importData: {}, displayLabel: "山田 一郎" }],
        }),
      })

      const idMappings = createEmptyIdMappings()
      const idChangeTargets: IdChangeTarget[] = []
      const counts = createEmptyImportCounts()
      const warnings: string[] = []

      await prisma.$transaction(async (tx) => {
        await processStudentIdIntegration(
          data,
          preMatchResult,
          { strategy: "by_student_number", decisions: [] },
          idMappings,
          idChangeTargets,
          counts,
          warnings,
          policy,
          tx
        )
      })

      // インポートIDでマッピングされること
      expect(idMappings.student[importId]).toBe(importId)
      // DBに生徒が作成されること
      const created = await prisma.student.findUnique({
        where: { id: importId },
      })
      expect(created).not.toBeNull()
      expect(created!.studentNumber).toBe("S999")
      expect(created!.lastName).toBe("山田")
      // 作成カウントが増えること
      expect(counts.created.students).toBe(1)
    })
  })

  // =========================================================================
  // same_person + use_existing_id
  // =========================================================================
  describe("same_person決定（use_existing_id）", () => {
    it("既存IDを使用してマッピングされ、ID変更ターゲットには追加されない", async () => {
      const existingId = generateId()
      const importId = generateId()

      await prisma.student.create({
        data: {
          id: existingId,
          studentNumber: "S001",
          lastName: "鈴木",
          firstName: "次郎",
          lastNameKana: "スズキ",
          firstNameKana: "ジロウ",
          enrollmentYear: 2024,
        },
      })

      const data = createExtractedArchiveData({
        studentsData: createArchiveStudentsData([
          {
            id: importId,
            studentNumber: "S002",
            lastName: "鈴木",
            firstName: "次郎",
          },
        ]),
      })

      const decision = createDecision({
        importId,
        decisionType: "same_person",
        existingId,
        idChoice: "use_existing_id",
      })

      const preMatchResult = createFileOverviewData({
        student: createPreMatchingResult({
          byName: [createMatchedItem({ importId, existingId })],
          noMatch: [],
        }),
      })

      const idMappings = createEmptyIdMappings()
      const idChangeTargets: IdChangeTarget[] = []
      const counts = createEmptyImportCounts()
      const warnings: string[] = []

      await prisma.$transaction(async (tx) => {
        await processStudentIdIntegration(
          data,
          preMatchResult,
          { strategy: "by_name", decisions: [decision] },
          idMappings,
          idChangeTargets,
          counts,
          warnings,
          policy,
          tx
        )
      })

      expect(idMappings.student[importId]).toBe(existingId)
      expect(idChangeTargets).toHaveLength(0)
    })
  })

  // =========================================================================
  // same_person + use_import_id
  // =========================================================================
  describe("same_person決定（use_import_id）", () => {
    it("既存IDにマッピングされつつ、idChangeTargetsにも追加される", async () => {
      const existingId = generateId()
      const importId = generateId()

      await prisma.student.create({
        data: {
          id: existingId,
          studentNumber: "S001",
          lastName: "高橋",
          firstName: "三郎",
          lastNameKana: "タカハシ",
          firstNameKana: "サブロウ",
          enrollmentYear: 2024,
        },
      })

      const data = createExtractedArchiveData({
        studentsData: createArchiveStudentsData([
          {
            id: importId,
            studentNumber: "S003",
            lastName: "高橋",
            firstName: "三郎",
          },
        ]),
      })

      const decision = createDecision({
        importId,
        decisionType: "same_person",
        existingId,
        idChoice: "use_import_id",
      })

      const preMatchResult = createFileOverviewData({
        student: createPreMatchingResult({
          byName: [createMatchedItem({ importId, existingId })],
          noMatch: [],
        }),
      })

      const idMappings = createEmptyIdMappings()
      const idChangeTargets: IdChangeTarget[] = []
      const counts = createEmptyImportCounts()
      const warnings: string[] = []

      await prisma.$transaction(async (tx) => {
        await processStudentIdIntegration(
          data,
          preMatchResult,
          { strategy: "by_name", decisions: [decision] },
          idMappings,
          idChangeTargets,
          counts,
          warnings,
          policy,
          tx
        )
      })

      expect(idMappings.student[importId]).toBe(existingId)
      expect(idChangeTargets).toHaveLength(1)
      expect(idChangeTargets[0]).toEqual({
        category: "student",
        existingId: existingId,
        newId: importId,
      })
    })
  })

  // =========================================================================
  // skip決定
  // =========================================================================
  describe("skip決定", () => {
    it("スキップカウントが増加し、マッピングは作成されない", async () => {
      const importId = generateId()

      const data = createExtractedArchiveData({
        studentsData: createArchiveStudentsData([
          {
            id: importId,
            studentNumber: "S010",
            lastName: "伊藤",
            firstName: "四郎",
          },
        ]),
      })

      const decision = createDecision({
        importId,
        decisionType: "skip",
      })

      const preMatchResult = createFileOverviewData({
        student: createPreMatchingResult({
          noMatch: [{ importId, importData: {}, displayLabel: "伊藤 四郎" }],
        }),
      })

      const idMappings = createEmptyIdMappings()
      const idChangeTargets: IdChangeTarget[] = []
      const counts = createEmptyImportCounts()
      const warnings: string[] = []

      await prisma.$transaction(async (tx) => {
        await processStudentIdIntegration(
          data,
          preMatchResult,
          { strategy: "by_student_number", decisions: [decision] },
          idMappings,
          idChangeTargets,
          counts,
          warnings,
          policy,
          tx
        )
      })

      expect(counts.skipped.students).toBe(1)
      expect(idMappings.student[importId]).toBeUndefined()
    })
  })

  // =========================================================================
  // Bug B5: create_newだが既存の学籍番号が一致する場合
  // =========================================================================
  describe("Bug B5: create_newで既存studentNumberが一致する場合", () => {
    it("学籍番号にサフィックスを付与して新規作成する", async () => {
      const existingId = generateId()
      const importId = generateId()

      // 同じ学籍番号の生徒が既に存在
      await prisma.student.create({
        data: {
          id: existingId,
          studentNumber: "S001",
          lastName: "既存",
          firstName: "生徒",
          lastNameKana: "キゾン",
          firstNameKana: "セイト",
          enrollmentYear: 2024,
        },
      })

      const data = createExtractedArchiveData({
        studentsData: createArchiveStudentsData([
          {
            id: importId,
            studentNumber: "S001", // 既存と同じ学籍番号
            lastName: "インポート",
            firstName: "生徒",
          },
        ]),
      })

      // create_newの決定を明示的に指定
      const decision = createDecision({
        importId,
        decisionType: "create_new",
      })

      const preMatchResult = createFileOverviewData({
        student: createPreMatchingResult({
          noMatch: [
            { importId, importData: {}, displayLabel: "インポート 生徒" },
          ],
        }),
      })

      const idMappings = createEmptyIdMappings()
      const idChangeTargets: IdChangeTarget[] = []
      const counts = createEmptyImportCounts()
      const warnings: string[] = []

      await prisma.$transaction(async (tx) => {
        await processStudentIdIntegration(
          data,
          preMatchResult,
          { strategy: "by_student_number", decisions: [decision] },
          idMappings,
          idChangeTargets,
          counts,
          warnings,
          policy,
          tx
        )
      })

      // B5修正: サフィックス付きの学籍番号で新規作成される
      expect(idMappings.student[importId]).toBe(importId)
      const created = await prisma.student.findUnique({
        where: { id: importId },
      })
      expect(created).not.toBeNull()
      expect(created!.studentNumber).toBe("S001_1") // suffix added
      expect(created!.lastName).toBe("インポート")
      expect(counts.created.students).toBe(1)
      // 警告にサフィックス付与の通知が含まれる
      expect(warnings.length).toBeGreaterThan(0)
      expect(warnings[0]).toContain("重複回避")
      // 既存レコードは変更されない
      const existing = await prisma.student.findUnique({
        where: { id: existingId },
      })
      expect(existing).not.toBeNull()
      expect(existing!.studentNumber).toBe("S001")
    })
  })

  // =========================================================================
  // 値の扱い: 上書きする
  // =========================================================================
  describe("値の扱い（上書きする）", () => {
    it("同じ人だと決まった行は、時刻を見ずに全ての列がファイルの値になる", async () => {
      const existingId = generateId()
      const importId = generateId()

      await prisma.student.create({
        data: {
          id: existingId,
          studentNumber: "S001",
          lastName: "旧姓",
          firstName: "旧名",
          lastNameKana: "キュウセイ",
          firstNameKana: "キュウメイ",
          enrollmentYear: 2023,
        },
      })

      const data = createExtractedArchiveData({
        studentsData: createArchiveStudentsData([
          {
            id: importId,
            studentNumber: "S001",
            lastName: "新姓",
            firstName: "新名",
            lastNameKana: "シンセイ",
            firstNameKana: "シンメイ",
            enrollmentYear: 2024,
          },
        ]),
      })

      const decision = createDecision({
        importId,
        decisionType: "same_person",
        existingId,
        idChoice: "use_existing_id",
      })

      const preMatchResult = createFileOverviewData({
        student: createPreMatchingResult({
          byStudentNumber: [createMatchedItem({ importId, existingId })],
          noMatch: [],
        }),
      })

      const idMappings = createEmptyIdMappings()
      const idChangeTargets: IdChangeTarget[] = []
      const counts = createEmptyImportCounts()
      const warnings: string[] = []

      // 「上書きする」は項目を選ばない。人が統合先を指定した行の列は全部が置き換わる
      const overwritePolicy = createImportValuePolicy("overwrite")

      await prisma.$transaction(async (tx) => {
        await processStudentIdIntegration(
          data,
          preMatchResult,
          { strategy: "by_student_number", decisions: [decision] },
          idMappings,
          idChangeTargets,
          counts,
          warnings,
          overwritePolicy,
          tx
        )
      })

      // DBの値が更新されていること
      const updated = await prisma.student.findUnique({
        where: { id: existingId },
      })
      expect(updated!.lastName).toBe("新姓")
      expect(updated!.firstName).toBe("新名")
      // 項目ごとの選択が無いので、カナも入学年度もファイルの値になる
      expect(updated!.lastNameKana).toBe("シンセイ")
      expect(updated!.firstNameKana).toBe("シンメイ")
      expect(updated!.enrollmentYear).toBe(2024)
      expect(counts.updated.students).toBe(1)
    })
  })

  // =========================================================================
  // 値の扱い: 統合する（LWW）
  // =========================================================================
  describe("値の扱い（統合する）", () => {
    it("インポートデータの方が新しい場合にフィールドが更新される", async () => {
      const existingId = generateId()
      const importId = generateId()
      const oldDate = new Date("2024-01-01")

      await prisma.student.create({
        data: {
          id: existingId,
          studentNumber: "S001",
          lastName: "古い姓",
          firstName: "古い名",
          lastNameKana: "フルイセイ",
          firstNameKana: "フルイメイ",
          enrollmentYear: 2024,
          updatedAt: oldDate,
        },
      })

      // インポートデータのupdatedAtを既存より新しく設定
      const newerDate = new Date("2025-06-01")
      const studentsData = createArchiveStudentsData([
        {
          id: importId,
          studentNumber: "S001",
          lastName: "新しい姓",
          firstName: "新しい名",
        },
      ])
      // updatedAtを明示的に上書き
      studentsData.students[0].updatedAt = newerDate.toISOString()

      const data = createExtractedArchiveData({ studentsData })

      const decision = createDecision({
        importId,
        decisionType: "same_person",
        existingId,
        idChoice: "use_existing_id",
      })

      const preMatchResult = createFileOverviewData({
        student: createPreMatchingResult({
          byStudentNumber: [createMatchedItem({ importId, existingId })],
          noMatch: [],
        }),
      })

      const idMappings = createEmptyIdMappings()
      const idChangeTargets: IdChangeTarget[] = []
      const counts = createEmptyImportCounts()
      const warnings: string[] = []

      await prisma.$transaction(async (tx) => {
        await processStudentIdIntegration(
          data,
          preMatchResult,
          { strategy: "by_student_number", decisions: [decision] },
          idMappings,
          idChangeTargets,
          counts,
          warnings,
          policy,
          tx
        )
      })

      const updated = await prisma.student.findUnique({
        where: { id: existingId },
      })
      expect(updated!.lastName).toBe("新しい姓")
      expect(updated!.firstName).toBe("新しい名")
      expect(counts.updated.students).toBe(1)
    })

    it("インポートデータの方が古い場合はフィールドが更新されない", async () => {
      const existingId = generateId()
      const importId = generateId()
      const newDate = new Date("2025-12-01")

      await prisma.student.create({
        data: {
          id: existingId,
          studentNumber: "S002",
          lastName: "最新姓",
          firstName: "最新名",
          lastNameKana: "サイシンセイ",
          firstNameKana: "サイシンメイ",
          enrollmentYear: 2024,
          updatedAt: newDate,
        },
      })

      // インポートデータのupdatedAtを既存より古く設定
      const olderDate = new Date("2024-01-01")
      const studentsData = createArchiveStudentsData([
        {
          id: importId,
          studentNumber: "S002",
          lastName: "古い姓",
          firstName: "古い名",
        },
      ])
      studentsData.students[0].updatedAt = olderDate.toISOString()

      const data = createExtractedArchiveData({ studentsData })

      const decision = createDecision({
        importId,
        decisionType: "same_person",
        existingId,
        idChoice: "use_existing_id",
      })

      const preMatchResult = createFileOverviewData({
        student: createPreMatchingResult({
          byStudentNumber: [createMatchedItem({ importId, existingId })],
          noMatch: [],
        }),
      })

      const idMappings = createEmptyIdMappings()
      const idChangeTargets: IdChangeTarget[] = []
      const counts = createEmptyImportCounts()
      const warnings: string[] = []

      await prisma.$transaction(async (tx) => {
        await processStudentIdIntegration(
          data,
          preMatchResult,
          { strategy: "by_student_number", decisions: [decision] },
          idMappings,
          idChangeTargets,
          counts,
          warnings,
          policy,
          tx
        )
      })

      const notUpdated = await prisma.student.findUnique({
        where: { id: existingId },
      })
      expect(notUpdated!.lastName).toBe("最新姓")
      // 更新カウントは増えない
      expect(counts.updated.students).toBe(0)
    })
  })
})
