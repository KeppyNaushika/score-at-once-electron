/**
 * classroomProcessor の統合テスト
 *
 * テスト対象: electron-src/lib/import/merge/processors/classroomProcessor.ts
 * 実際のSQLiteテスト用DBを使用し、学級ID統合処理を検証する
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import type { IdChangeTarget } from "../../../electron-src/lib/import/merge/types"
import {
  createArchiveClassesData,
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
import { processClassroomIdIntegration } from "../../../electron-src/lib/import/merge/processors/classroomProcessor"

const prisma = getTestPrismaClient()

/**
 * 取り込みの方針（上書きする / 統合する / 別で追加する）。
 * 既定は「統合する」＝ LWW。上書きを見るテストだけ個別に作る。
 */
const policy = createImportValuePolicy("merge")

describe("processClassroomIdIntegration", () => {
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
    it("同一IDの学級が存在する場合、自動でマッピングされる", async () => {
      const classroomId = generateId()

      await prisma.classroom.create({
        data: {
          id: classroomId,
          name: "1年A組",
          classroomCode: "1A",
          grade: 1,
        },
      })

      const data = createExtractedArchiveData({
        classesData: createArchiveClassesData([
          { id: classroomId, name: "1年A組", classroomCode: "1A", grade: 1 },
        ]),
      })

      const preMatchResult = createFileOverviewData({
        classroom: createPreMatchingResult({
          byId: [
            createMatchedItem({
              importId: classroomId,
              existingId: classroomId,
            }),
          ],
          noMatch: [],
        }),
      })

      const idMappings = createEmptyIdMappings()
      const idChangeTargets: IdChangeTarget[] = []
      const counts = createEmptyImportCounts()
      const warnings: string[] = []

      await prisma.$transaction(async (tx) => {
        await processClassroomIdIntegration(
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

      expect(idMappings.classroom[classroomId]).toBe(classroomId)
    })
  })

  // =========================================================================
  // 名前一致（byName） + by_name戦略
  // =========================================================================
  describe("名前一致（by_name戦略）", () => {
    it("名前が一致する場合、same_personとして自動マッピングされる", async () => {
      const existingId = generateId()
      const importId = generateId()

      await prisma.classroom.create({
        data: {
          id: existingId,
          name: "2年B組",
          classroomCode: "2B",
          grade: 2,
        },
      })

      const data = createExtractedArchiveData({
        classesData: createArchiveClassesData([
          { id: importId, name: "2年B組", classroomCode: "2B-new", grade: 2 },
        ]),
      })

      const preMatchResult = createFileOverviewData({
        classroom: createPreMatchingResult({
          byName: [createMatchedItem({ importId, existingId })],
          noMatch: [],
        }),
      })

      const idMappings = createEmptyIdMappings()
      const idChangeTargets: IdChangeTarget[] = []
      const counts = createEmptyImportCounts()
      const warnings: string[] = []

      await prisma.$transaction(async (tx) => {
        await processClassroomIdIntegration(
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

      expect(idMappings.classroom[importId]).toBe(existingId)
      expect(idChangeTargets).toHaveLength(0)
    })
  })

  // =========================================================================
  // 一致なし + create_new
  // =========================================================================
  describe("一致なし（create_new）", () => {
    it("一致するレコードがない場合、新規学級がDBに作成される", async () => {
      const importId = generateId()

      const data = createExtractedArchiveData({
        classesData: createArchiveClassesData([
          { id: importId, name: "3年C組", classroomCode: "3C", grade: 3 },
        ]),
      })

      const preMatchResult = createFileOverviewData({
        classroom: createPreMatchingResult({
          noMatch: [{ importId, importData: {}, displayLabel: "3年C組" }],
        }),
      })

      const idMappings = createEmptyIdMappings()
      const idChangeTargets: IdChangeTarget[] = []
      const counts = createEmptyImportCounts()
      const warnings: string[] = []

      await prisma.$transaction(async (tx) => {
        await processClassroomIdIntegration(
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

      expect(idMappings.classroom[importId]).toBe(importId)
      const created = await prisma.classroom.findUnique({
        where: { id: importId },
      })
      expect(created).not.toBeNull()
      expect(created!.name).toBe("3年C組")
      expect(counts.created.classrooms).toBe(1)
    })
  })

  // =========================================================================
  // same_person + use_existing_id
  // =========================================================================
  describe("same_person決定（use_existing_id）", () => {
    it("既存IDを使用してマッピングされる", async () => {
      const existingId = generateId()
      const importId = generateId()

      await prisma.classroom.create({
        data: {
          id: existingId,
          name: "1年A組",
          classroomCode: "1A",
          grade: 1,
        },
      })

      const data = createExtractedArchiveData({
        classesData: createArchiveClassesData([
          {
            id: importId,
            name: "1年A組_renamed",
            classroomCode: "1A-new",
            grade: 1,
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
        classroom: createPreMatchingResult({
          byName: [createMatchedItem({ importId, existingId })],
          noMatch: [],
        }),
      })

      const idMappings = createEmptyIdMappings()
      const idChangeTargets: IdChangeTarget[] = []
      const counts = createEmptyImportCounts()
      const warnings: string[] = []

      await prisma.$transaction(async (tx) => {
        await processClassroomIdIntegration(
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

      expect(idMappings.classroom[importId]).toBe(existingId)
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

      await prisma.classroom.create({
        data: {
          id: existingId,
          name: "2年B組",
          classroomCode: "2B",
          grade: 2,
        },
      })

      const data = createExtractedArchiveData({
        classesData: createArchiveClassesData([
          {
            id: importId,
            name: "2年B組_import",
            classroomCode: "2B-import",
            grade: 2,
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
        classroom: createPreMatchingResult({
          byName: [createMatchedItem({ importId, existingId })],
          noMatch: [],
        }),
      })

      const idMappings = createEmptyIdMappings()
      const idChangeTargets: IdChangeTarget[] = []
      const counts = createEmptyImportCounts()
      const warnings: string[] = []

      await prisma.$transaction(async (tx) => {
        await processClassroomIdIntegration(
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

      expect(idMappings.classroom[importId]).toBe(existingId)
      expect(idChangeTargets).toHaveLength(1)
      expect(idChangeTargets[0]).toEqual({
        category: "classroom",
        existingId,
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
        classesData: createArchiveClassesData([
          { id: importId, name: "スキップクラス" },
        ]),
      })

      const decision = createDecision({
        importId,
        decisionType: "skip",
      })

      const preMatchResult = createFileOverviewData({
        classroom: createPreMatchingResult({
          noMatch: [
            { importId, importData: {}, displayLabel: "スキップクラス" },
          ],
        }),
      })

      const idMappings = createEmptyIdMappings()
      const idChangeTargets: IdChangeTarget[] = []
      const counts = createEmptyImportCounts()
      const warnings: string[] = []

      await prisma.$transaction(async (tx) => {
        await processClassroomIdIntegration(
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

      expect(counts.skipped.classrooms).toBe(1)
      expect(idMappings.classroom[importId]).toBeUndefined()
    })
  })

  // =========================================================================
  // Bug B5類似: create_newだが既存の名前が一致する場合
  // =========================================================================
  describe("Bug B5類似: create_newで既存名が一致する場合", () => {
    it("クラス名にサフィックスを付与して新規作成する", async () => {
      const existingId = generateId()
      const importId = generateId()

      await prisma.classroom.create({
        data: {
          id: existingId,
          name: "1年A組",
          classroomCode: "1A-old",
          grade: 1,
        },
      })

      const data = createExtractedArchiveData({
        classesData: createArchiveClassesData([
          {
            id: importId,
            name: "1年A組", // 既存と同じ名前
            classroomCode: "1A-new",
            grade: 1,
          },
        ]),
      })

      const decision = createDecision({
        importId,
        decisionType: "create_new",
      })

      const preMatchResult = createFileOverviewData({
        classroom: createPreMatchingResult({
          noMatch: [{ importId, importData: {}, displayLabel: "1年A組" }],
        }),
      })

      const idMappings = createEmptyIdMappings()
      const idChangeTargets: IdChangeTarget[] = []
      const counts = createEmptyImportCounts()
      const warnings: string[] = []

      await prisma.$transaction(async (tx) => {
        await processClassroomIdIntegration(
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

      // B5修正: サフィックス付きのクラス名で新規作成される
      expect(idMappings.classroom[importId]).toBe(importId)
      const created = await prisma.classroom.findUnique({
        where: { id: importId },
      })
      expect(created).not.toBeNull()
      expect(created!.name).toBe("1年A組 (2)") // suffix added
      expect(counts.created.classrooms).toBe(1)
      // 警告にサフィックス付与の通知が含まれる
      expect(warnings.length).toBeGreaterThan(0)
      expect(warnings[0]).toContain("重複回避")
      // 既存レコードは変更されない
      const existing = await prisma.classroom.findUnique({
        where: { id: existingId },
      })
      expect(existing).not.toBeNull()
      expect(existing!.name).toBe("1年A組")
    })
  })

  // =========================================================================
  // 値の扱い: 上書きする
  // =========================================================================
  describe("値の扱い（上書きする）", () => {
    it("同じ学級だと決まった行は、時刻を見ずに全ての列がファイルの値になる", async () => {
      const existingId = generateId()
      const importId = generateId()

      await prisma.classroom.create({
        data: {
          id: existingId,
          name: "旧名クラス",
          classroomCode: "OLD",
          grade: 1,
          description: "旧説明",
        },
      })

      const classesData = createArchiveClassesData([
        {
          id: importId,
          name: "新名クラス",
          classroomCode: "NEW",
          grade: 2,
        },
      ])
      // descriptionを設定
      classesData.classrooms[0].description = "新説明"

      const data = createExtractedArchiveData({ classesData })

      const decision = createDecision({
        importId,
        decisionType: "same_person",
        existingId,
        idChoice: "use_existing_id",
      })

      const preMatchResult = createFileOverviewData({
        classroom: createPreMatchingResult({
          byName: [createMatchedItem({ importId, existingId })],
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
        await processClassroomIdIntegration(
          data,
          preMatchResult,
          { strategy: "by_name", decisions: [decision] },
          idMappings,
          idChangeTargets,
          counts,
          warnings,
          overwritePolicy,
          tx
        )
      })

      const updated = await prisma.classroom.findUnique({
        where: { id: existingId },
      })
      expect(updated!.classroomCode).toBe("NEW")
      expect(updated!.grade).toBe(2)
      // 項目ごとの選択が無いので、名前も説明もファイルの値になる
      expect(updated!.name).toBe("新名クラス")
      expect(updated!.description).toBe("新説明")
      expect(counts.updated.classrooms).toBe(1)
    })

    it("表示設定（isVisible）も規則の対象で、ファイルの値になる", async () => {
      // 表示設定が更新できるフィールドの一覧に無いと、値が食い違っていても
      // 利用者が「ファイルに従う」を選ぶ手段が無い
      const existingId = generateId()
      const importId = generateId()

      await prisma.classroom.create({
        data: { id: existingId, name: "表示クラス", isVisible: true },
      })

      const classesData = createArchiveClassesData([
        { id: importId, name: "表示クラス" },
      ])
      classesData.classrooms[0].isVisible = false

      const data = createExtractedArchiveData({ classesData })

      const decision = createDecision({
        importId,
        decisionType: "same_person",
        existingId,
        idChoice: "use_existing_id",
      })

      const preMatchResult = createFileOverviewData({
        classroom: createPreMatchingResult({
          byName: [createMatchedItem({ importId, existingId })],
          noMatch: [],
        }),
      })

      const idMappings = createEmptyIdMappings()
      const idChangeTargets: IdChangeTarget[] = []
      const counts = createEmptyImportCounts()
      const warnings: string[] = []

      await prisma.$transaction(async (tx) => {
        await processClassroomIdIntegration(
          data,
          preMatchResult,
          { strategy: "by_name", decisions: [decision] },
          idMappings,
          idChangeTargets,
          counts,
          warnings,
          createImportValuePolicy("overwrite"),
          tx
        )
      })

      const updated = await prisma.classroom.findUnique({
        where: { id: existingId },
      })
      expect(updated!.isVisible).toBe(false)
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

      await prisma.classroom.create({
        data: {
          id: existingId,
          name: "古い名前",
          classroomCode: "OLD",
          grade: 1,
          updatedAt: oldDate,
        },
      })

      const newerDate = new Date("2025-06-01")
      const classesData = createArchiveClassesData([
        { id: importId, name: "新しい名前", classroomCode: "NEW", grade: 2 },
      ])
      classesData.classrooms[0].updatedAt = newerDate.toISOString()

      const data = createExtractedArchiveData({ classesData })

      const decision = createDecision({
        importId,
        decisionType: "same_person",
        existingId,
        idChoice: "use_existing_id",
      })

      const preMatchResult = createFileOverviewData({
        classroom: createPreMatchingResult({
          byName: [createMatchedItem({ importId, existingId })],
          noMatch: [],
        }),
      })

      const idMappings = createEmptyIdMappings()
      const idChangeTargets: IdChangeTarget[] = []
      const counts = createEmptyImportCounts()
      const warnings: string[] = []

      await prisma.$transaction(async (tx) => {
        await processClassroomIdIntegration(
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

      const updated = await prisma.classroom.findUnique({
        where: { id: existingId },
      })
      expect(updated!.classroomCode).toBe("NEW")
      expect(counts.updated.classrooms).toBe(1)
    })
  })
})
