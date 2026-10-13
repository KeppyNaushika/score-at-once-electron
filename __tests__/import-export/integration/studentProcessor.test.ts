/**
 * studentProcessor の統合テスト
 *
 * テスト対象: electron-src/lib/import/merge/processors/studentProcessor.ts
 * 実際のSQLiteテスト用DBを使用し、生徒ID統合処理を検証する
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import type { IdChangeTarget } from "../../../electron-src/lib/import/merge/types"
import {
  createEmptyIdMappings,
  createEmptyImportCounts,
} from "../../../electron-src/lib/import/merge/types"
import {
  createArchiveStudentsData,
  createDecision,
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
import { preMatchStudents } from "../../../electron-src/lib/import/merge/matchers/studentMatcher"
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
  // create_newだが既存の学籍番号が一致する場合（旧 Bug B5）
  // 学籍番号は unique ではない。付け替えずにアーカイブの値のまま別の行として作り、id で区別する
  // =========================================================================
  describe("create_newで既存studentNumberが一致する場合", () => {
    it("学籍番号を変えずに別の行として新規作成する", async () => {
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

      // 学籍番号はアーカイブの値のまま、取り込んだ id で新規作成される
      expect(idMappings.student[importId]).toBe(importId)
      const created = await prisma.student.findUnique({
        where: { id: importId },
      })
      expect(created).not.toBeNull()
      expect(created!.studentNumber).toBe("S001")
      expect(created!.lastName).toBe("インポート")
      expect(counts.created.students).toBe(1)
      expect(warnings).toEqual([])
      // 同じ学籍番号の行が2つ並び、id で区別される（既存へ統合されていない）
      const sameNumberStudents = await prisma.student.findMany({
        where: { studentNumber: "S001" },
      })
      expect(
        new Map(
          sameNumberStudents.map((student) => [student.id, student.lastName])
        )
      ).toEqual(
        new Map([
          [existingId, "既存"],
          [importId, "インポート"],
        ])
      )
    })
  })

  // =========================================================================
  // id が一致すれば同じ行（照合・判断より先）
  // =========================================================================
  describe("id が一致すれば同じ行", () => {
    /** 事前照合から取り込みまでを、実際の照合（preMatchStudents）で通す */
    const runWithPreMatch = async (
      data: ReturnType<typeof createExtractedArchiveData>,
      config: Parameters<typeof processStudentIdIntegration>[2],
      importPolicy = policy
    ) => {
      const preMatchResult = createFileOverviewData({
        student: await preMatchStudents(data),
      })
      const idMappings = createEmptyIdMappings()
      const idChangeTargets: IdChangeTarget[] = []
      const counts = createEmptyImportCounts()
      const warnings: string[] = []
      await prisma.$transaction(async (tx) => {
        await processStudentIdIntegration(
          data,
          preMatchResult,
          config,
          idMappings,
          idChangeTargets,
          counts,
          warnings,
          importPolicy,
          tx
        )
      })
      return { preMatchResult, idMappings, idChangeTargets, counts, warnings }
    }

    it("照合の後で同じ id の行が入ってきても、新しく作らず同じ行として値を書く", async () => {
      const importId = generateId()
      const data = createExtractedArchiveData({
        studentsData: createArchiveStudentsData([
          { id: importId, studentNumber: "S300", lastName: "取込" },
        ]),
      })
      // 照合の時点では一致なし（新規作成の判断）
      const preMatchResult = createFileOverviewData({
        student: await preMatchStudents(data),
      })
      expect(
        preMatchResult.student.noMatch.map((item) => item.importId)
      ).toEqual([importId])
      // 実行までの間に、同じ id の行が入ってくる（同期など）
      await prisma.student.create({
        data: {
          id: importId,
          studentNumber: "S300",
          lastName: "同期",
          firstName: "生徒",
          lastNameKana: "ドウキ",
          firstNameKana: "セイト",
        },
      })

      const idMappings = createEmptyIdMappings()
      const counts = createEmptyImportCounts()
      await prisma.$transaction(async (tx) => {
        await processStudentIdIntegration(
          data,
          preMatchResult,
          {
            strategy: "by_student_number",
            decisions: [
              createDecision({ importId, decisionType: "create_new" }),
            ],
          },
          idMappings,
          [],
          counts,
          [],
          createImportValuePolicy("overwrite"),
          tx
        )
      })

      expect(idMappings.student[importId]).toBe(importId)
      expect(counts.created.students).toBe(0)
      expect(counts.updated.students).toBe(1)
      expect(
        (await prisma.student.findUniqueOrThrow({ where: { id: importId } }))
          .lastName
      ).toBe("取込")
    })

    it("氏名で紐づけるときは、学籍番号も一致する生徒を氏名の候補へ結ぶ", async () => {
      const numberMatchId = generateId()
      const nameMatchId = generateId()
      for (const [id, studentNumber, lastName] of [
        [numberMatchId, "S001", "別人"],
        [nameMatchId, "S999", "山田"],
      ]) {
        await prisma.student.create({
          data: {
            id,
            studentNumber,
            lastName,
            firstName: "太郎",
            lastNameKana: "カナ",
            firstNameKana: "タロウ",
          },
        })
      }
      const importId = generateId()
      const data = createExtractedArchiveData({
        studentsData: createArchiveStudentsData([
          {
            id: importId,
            studentNumber: "S001",
            lastName: "山田",
            firstName: "太郎",
          },
        ]),
      })

      const { preMatchResult, idMappings, counts } = await runWithPreMatch(
        data,
        { strategy: "by_name", decisions: [] }
      )

      // 学籍番号一致と氏名一致の両方の一覧に載る
      expect(
        preMatchResult.student.byStudentNumber?.map((item) => item.existingId)
      ).toEqual([numberMatchId])
      expect(
        preMatchResult.student.byName?.map((item) => item.existingId)
      ).toEqual([nameMatchId])
      expect(idMappings.student[importId]).toBe(nameMatchId)
      expect(counts.created.students).toBe(0)
    })

    it("別のアーカイブの生徒が id で取った既存の生徒は、学籍番号の候補にしない", async () => {
      // 既存の生徒 B（S101）。アーカイブでは B が S201 に改番され、新入生 Y が S101 を持つ
      const studentBId = generateId()
      await prisma.student.create({
        data: {
          id: studentBId,
          studentNumber: "S101",
          lastName: "改番",
          firstName: "生徒",
          lastNameKana: "カイバン",
          firstNameKana: "セイト",
        },
      })
      const newcomerId = generateId()
      const data = createExtractedArchiveData({
        studentsData: createArchiveStudentsData([
          { id: studentBId, studentNumber: "S201", lastName: "改番" },
          { id: newcomerId, studentNumber: "S101", lastName: "新入" },
        ]),
      })

      const { preMatchResult, idMappings } = await runWithPreMatch(
        data,
        { strategy: "by_student_number", decisions: [] },
        createImportValuePolicy("overwrite")
      )

      expect(preMatchResult.student.byStudentNumber).toEqual([])
      expect(idMappings.student[studentBId]).toBe(studentBId)
      expect(idMappings.student[newcomerId]).toBe(newcomerId)
      const studentB = await prisma.student.findUniqueOrThrow({
        where: { id: studentBId },
      })
      expect(studentB.studentNumber).toBe("S201")
      expect(
        (await prisma.student.findUniqueOrThrow({ where: { id: newcomerId } }))
          .lastName
      ).toBe("新入")
    })

    it("他の行が紐づけ先にした既存の生徒を選んでも結ばず、新しく作って警告に残す", async () => {
      const existingId = generateId()
      await prisma.student.create({
        data: {
          id: existingId,
          studentNumber: "S001",
          lastName: "既存",
          firstName: "生徒",
          lastNameKana: "キゾン",
          firstNameKana: "セイト",
        },
      })
      const firstId = generateId()
      const secondId = generateId()
      const data = createExtractedArchiveData({
        studentsData: createArchiveStudentsData([
          { id: firstId, studentNumber: "S001" },
          { id: secondId, studentNumber: "S002" },
        ]),
      })

      const { idMappings, warnings } = await runWithPreMatch(data, {
        strategy: "by_student_number",
        decisions: [
          createDecision({
            importId: secondId,
            decisionType: "same_person",
            existingId,
          }),
        ],
      })

      expect(idMappings.student[firstId]).toBe(existingId)
      expect(idMappings.student[secondId]).toBe(secondId)
      expect(warnings).toHaveLength(1)
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
