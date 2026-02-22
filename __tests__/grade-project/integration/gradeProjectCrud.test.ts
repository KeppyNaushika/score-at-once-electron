/**
 * GradeProject CRUD 統合テスト
 *
 * gradeProject.ts の全関数（getAll, getById, create, update, delete）を検証
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
  createGradeProject,
  deleteGradeProject,
  getAllGradeProjects,
  getGradeProjectById,
  updateGradeProject,
} from "@/electron-src/lib/prisma/gradeProject"

const testPrisma = new PrismaClient({
  datasources: { db: { url: `file:${TEST_DB_PATH}` } },
  log: ["error"],
})

describe("GradeProject CRUD", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  describe("createGradeProject", () => {
    it("成績プロジェクトを作成できる", async () => {
      const result = await createGradeProject({ name: "1学期期末成績" })

      expect(result.success).toBe(true)
      expect(result.gradeProject).toBeDefined()
      expect(result.gradeProject!.name).toBe("1学期期末成績")
      expect(result.gradeProject!.gradeItems).toEqual([])
      expect(result.gradeProject!.gradeProjectClasses).toEqual([])
    })

    it("descriptionとreferenceDateを指定して作成できる", async () => {
      const result = await createGradeProject({
        name: "テストPJ",
        description: "テスト用の成績プロジェクト",
        referenceDate: "2026-03-01",
      })

      expect(result.success).toBe(true)
      expect(result.gradeProject!.description).toBe(
        "テスト用の成績プロジェクト"
      )
      expect(result.gradeProject!.referenceDate).toBeTruthy()
    })

    it("referenceDateがnullの場合はnullで作成される", async () => {
      const result = await createGradeProject({
        name: "PJ",
        referenceDate: null,
      })

      expect(result.success).toBe(true)
      expect(result.gradeProject!.referenceDate).toBeNull()
    })
  })

  describe("getAllGradeProjects", () => {
    it("全プロジェクトを取得できる", async () => {
      await createGradeProject({ name: "PJ-A" })
      await createGradeProject({ name: "PJ-B" })

      const result = await getAllGradeProjects()

      expect(result.success).toBe(true)
      expect(result.gradeProjects).toHaveLength(2)
    })

    it("プロジェクトが0件のとき空配列を返す", async () => {
      const result = await getAllGradeProjects()

      expect(result.success).toBe(true)
      expect(result.gradeProjects).toHaveLength(0)
    })

    it("gradeItems数とgradeProjectStudents数のカウントが含まれる", async () => {
      const created = await createGradeProject({ name: "PJ" })
      await testPrisma.gradeItem.create({
        data: {
          gradeProjectId: created.gradeProject!.id,
          name: "知識",
          order: 0,
        },
      })

      const result = await getAllGradeProjects()

      expect(result.gradeProjects![0]._count.gradeItems).toBe(1)
      expect(result.gradeProjects![0]._count.gradeProjectStudents).toBe(0)
    })
  })

  describe("getGradeProjectById", () => {
    it("IDで取得できる", async () => {
      const created = await createGradeProject({ name: "対象PJ" })

      const result = await getGradeProjectById(created.gradeProject!.id)

      expect(result.success).toBe(true)
      expect(result.gradeProject!.name).toBe("対象PJ")
    })

    it("存在しないIDの場合はエラーを返す", async () => {
      const result = await getGradeProjectById("non-existent-id")

      expect(result.success).toBe(false)
      expect(result.error).toBe("Grade project not found")
    })

    it("関連するgradeItemsとgradeProjectClassesが含まれる", async () => {
      const created = await createGradeProject({ name: "PJ" })
      await testPrisma.gradeItem.create({
        data: {
          gradeProjectId: created.gradeProject!.id,
          name: "思考",
          order: 0,
        },
      })

      const result = await getGradeProjectById(created.gradeProject!.id)

      expect(result.gradeProject!.gradeItems).toHaveLength(1)
      expect(result.gradeProject!.gradeItems[0].name).toBe("思考")
    })
  })

  describe("updateGradeProject", () => {
    it("名前を更新できる", async () => {
      const created = await createGradeProject({ name: "旧名" })

      const result = await updateGradeProject(created.gradeProject!.id, {
        name: "新名",
      })

      expect(result.success).toBe(true)
      expect(result.gradeProject!.name).toBe("新名")
    })

    it("descriptionを更新できる", async () => {
      const created = await createGradeProject({ name: "PJ" })

      const result = await updateGradeProject(created.gradeProject!.id, {
        description: "更新された説明",
      })

      expect(result.success).toBe(true)
      expect(result.gradeProject!.description).toBe("更新された説明")
    })

    it("referenceDateを更新できる", async () => {
      const created = await createGradeProject({ name: "PJ" })

      const result = await updateGradeProject(created.gradeProject!.id, {
        referenceDate: "2026-04-01",
      })

      expect(result.success).toBe(true)
      expect(result.gradeProject!.referenceDate).toBeTruthy()
    })

    it("referenceDateをnullにリセットできる", async () => {
      const created = await createGradeProject({
        name: "PJ",
        referenceDate: "2026-04-01",
      })

      const result = await updateGradeProject(created.gradeProject!.id, {
        referenceDate: null,
      })

      expect(result.success).toBe(true)
      expect(result.gradeProject!.referenceDate).toBeNull()
    })
  })

  describe("deleteGradeProject", () => {
    it("プロジェクトを削除できる", async () => {
      const created = await createGradeProject({ name: "削除対象" })

      const result = await deleteGradeProject(created.gradeProject!.id)
      expect(result.success).toBe(true)

      const found = await getGradeProjectById(created.gradeProject!.id)
      expect(found.success).toBe(false)
    })

    it("関連するGradeItemもカスケード削除される", async () => {
      const created = await createGradeProject({ name: "PJ" })
      await testPrisma.gradeItem.create({
        data: {
          gradeProjectId: created.gradeProject!.id,
          name: "削除対象項目",
          order: 0,
        },
      })

      await deleteGradeProject(created.gradeProject!.id)

      const items = await testPrisma.gradeItem.findMany({
        where: { gradeProjectId: created.gradeProject!.id },
      })
      expect(items).toHaveLength(0)
    })
  })
})
