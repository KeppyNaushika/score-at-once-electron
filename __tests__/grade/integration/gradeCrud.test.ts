/**
 * Grade CRUD 統合テスト
 *
 * grade.ts の全関数（getAll, getById, create, update, delete）を検証
 */

import { PrismaClient } from "@prisma/client"
import * as path from "path"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const TEST_DB_PATH = path.resolve(__dirname, "../../../data/test-database.db")

vi.mock("@/electron-src/lib/prisma/client", () => {
  const { PrismaClient: PC } = require("@prisma/client")
  const p = path.resolve(__dirname, "../../../data/test-database.db")
  const client = new PC({
    datasources: { db: { url: `file:${p}` } },
    log: ["error"],
  })
  return { default: client }
})

import {
  cleanupTestDatabase,
  disconnectTestPrisma,
} from "@/__tests__/helpers/testPrismaClient"
import {
  createGrade,
  deleteGrade,
  getAllGrades,
  getGradeById,
  updateGrade,
} from "@/electron-src/lib/prisma/grade"

const testPrisma = new PrismaClient({
  datasources: { db: { url: `file:${TEST_DB_PATH}` } },
  log: ["error"],
})

describe("Grade CRUD", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  describe("createGrade", () => {
    it("成績試験を作成できる", async () => {
      const result = await createGrade({ name: "1学期期末成績" })

      expect(result.success).toBe(true)
      expect(result.grade).toBeDefined()
      expect(result.grade!.name).toBe("1学期期末成績")
      expect(result.grade!.gradeItems).toEqual([])
      expect(result.grade!.gradeClasses).toEqual([])
    })

    it("descriptionとreferenceDateを指定して作成できる", async () => {
      const result = await createGrade({
        name: "テストPJ",
        description: "テスト用の成績試験",
        referenceDate: "2026-03-01",
      })

      expect(result.success).toBe(true)
      expect(result.grade!.description).toBe("テスト用の成績試験")
      expect(result.grade!.referenceDate).toBeTruthy()
    })

    it("referenceDateがnullの場合はnullで作成される", async () => {
      const result = await createGrade({
        name: "PJ",
        referenceDate: null,
      })

      expect(result.success).toBe(true)
      expect(result.grade!.referenceDate).toBeNull()
    })
  })

  describe("getAllGrades", () => {
    it("全試験を取得できる", async () => {
      await createGrade({ name: "PJ-A" })
      await createGrade({ name: "PJ-B" })

      const result = await getAllGrades()

      expect(result.success).toBe(true)
      expect(result.grades).toHaveLength(2)
    })

    it("試験が0件のとき空配列を返す", async () => {
      const result = await getAllGrades()

      expect(result.success).toBe(true)
      expect(result.grades).toHaveLength(0)
    })

    it("gradeItems数とgradeStudents数のカウントが含まれる", async () => {
      const created = await createGrade({ name: "PJ" })
      await testPrisma.gradeItem.create({
        data: {
          gradeId: created.grade!.id,
          name: "知識",
          order: 0,
        },
      })

      const result = await getAllGrades()

      expect(result.grades![0]._count.gradeItems).toBe(1)
      expect(result.grades![0]._count.gradeStudents).toBe(0)
    })
  })

  describe("getGradeById", () => {
    it("IDで取得できる", async () => {
      const created = await createGrade({ name: "対象PJ" })

      const result = await getGradeById(created.grade!.id)

      expect(result.success).toBe(true)
      expect(result.grade!.name).toBe("対象PJ")
    })

    it("存在しないIDの場合はエラーを返す", async () => {
      const result = await getGradeById("non-existent-id")

      expect(result.success).toBe(false)
      expect(result.error).toBe("Grade exam not found")
    })

    it("関連するgradeItemsとgradeClassesが含まれる", async () => {
      const created = await createGrade({ name: "PJ" })
      await testPrisma.gradeItem.create({
        data: {
          gradeId: created.grade!.id,
          name: "思考",
          order: 0,
        },
      })

      const result = await getGradeById(created.grade!.id)

      expect(result.grade!.gradeItems).toHaveLength(1)
      expect(result.grade!.gradeItems[0].name).toBe("思考")
    })
  })

  describe("updateGrade", () => {
    it("名前を更新できる", async () => {
      const created = await createGrade({ name: "旧名" })

      const result = await updateGrade(created.grade!.id, {
        name: "新名",
      })

      expect(result.success).toBe(true)
      expect(result.grade!.name).toBe("新名")
    })

    it("descriptionを更新できる", async () => {
      const created = await createGrade({ name: "PJ" })

      const result = await updateGrade(created.grade!.id, {
        description: "更新された説明",
      })

      expect(result.success).toBe(true)
      expect(result.grade!.description).toBe("更新された説明")
    })

    it("referenceDateを更新できる", async () => {
      const created = await createGrade({ name: "PJ" })

      const result = await updateGrade(created.grade!.id, {
        referenceDate: "2026-04-01",
      })

      expect(result.success).toBe(true)
      expect(result.grade!.referenceDate).toBeTruthy()
    })

    it("referenceDateをnullにリセットできる", async () => {
      const created = await createGrade({
        name: "PJ",
        referenceDate: "2026-04-01",
      })

      const result = await updateGrade(created.grade!.id, {
        referenceDate: null,
      })

      expect(result.success).toBe(true)
      expect(result.grade!.referenceDate).toBeNull()
    })
  })

  describe("deleteGrade", () => {
    it("試験を削除できる", async () => {
      const created = await createGrade({ name: "削除対象" })

      const result = await deleteGrade(created.grade!.id)
      expect(result.success).toBe(true)

      const found = await getGradeById(created.grade!.id)
      expect(found.success).toBe(false)
    })

    it("関連するGradeItemもカスケード削除される", async () => {
      const created = await createGrade({ name: "PJ" })
      await testPrisma.gradeItem.create({
        data: {
          gradeId: created.grade!.id,
          name: "削除対象項目",
          order: 0,
        },
      })

      await deleteGrade(created.grade!.id)

      const items = await testPrisma.gradeItem.findMany({
        where: { gradeId: created.grade!.id },
      })
      expect(items).toHaveLength(0)
    })
  })
})
