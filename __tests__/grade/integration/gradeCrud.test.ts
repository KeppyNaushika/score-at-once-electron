/**
 * Grade CRUD 統合テスト
 *
 * grade.ts の全関数（getAll, getById, create, update, delete）を検証
 */

import * as path from "path"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const TEST_DB_PATH = path.resolve(__dirname, "../../../data/test-database.db")

vi.mock("../../../electron-src/lib/prisma/client", async () => {
  const { getTestPrismaClient } = await import("../../helpers/testPrismaClient")
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

import {
  createGrade,
  deleteGrade,
  getAllGrades,
  getGradeById,
  updateGrade,
} from "@/electron-src/lib/prisma/grade"

import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

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
      expect(result).toBeDefined()
      expect(result.name).toBe("1学期期末成績")
      expect(result.gradeItems).toEqual([])
      expect(result.gradeClassrooms).toEqual([])
    })

    it("descriptionとreferenceDateを指定して作成できる", async () => {
      const result = await createGrade({
        name: "テストPJ",
        description: "テスト用の成績試験",
        referenceDate: "2026-03-01",
      })
      expect(result.description).toBe("テスト用の成績試験")
      const stored = await testPrisma.grade.findUniqueOrThrow({
        where: { id: result.id },
      })
      expect(stored.referenceDate?.toISOString()).toBe(
        new Date("2026-03-01").toISOString()
      )
    })

    it("referenceDateがnullの場合はnullで作成される", async () => {
      const result = await createGrade({
        name: "PJ",
        referenceDate: null,
      })
      expect(result.referenceDate).toBeNull()
    })
  })

  describe("getAllGrades", () => {
    it("全試験を取得できる", async () => {
      await createGrade({ name: "PJ-A" })
      await createGrade({ name: "PJ-B" })

      const result = await getAllGrades()
      expect(result).toHaveLength(2)
    })

    it("試験が0件のとき空配列を返す", async () => {
      const result = await getAllGrades()
      expect(result).toHaveLength(0)
    })
  })

  describe("getGradeById", () => {
    it("IDで取得できる", async () => {
      const created = await createGrade({ name: "対象PJ" })

      const result = await getGradeById(created.id)
      expect(result.name).toBe("対象PJ")
    })

    it("存在しないIDの場合は例外を投げる", async () => {
      await expect(getGradeById("non-existent-id")).rejects.toThrow(
        "Grade exam not found"
      )
    })

    it("関連するgradeItemsとgradeClassroomsが含まれる", async () => {
      const created = await createGrade({ name: "PJ" })
      await testPrisma.gradeItem.create({
        data: {
          gradeId: created.id,
          name: "思考",
          order: 0,
        },
      })
      const classroom = await testPrisma.classroom.create({
        data: { name: "1年A組" },
      })
      await testPrisma.gradeClassroom.create({
        data: { gradeId: created.id, classroomId: classroom.id, order: 0 },
      })

      const result = await getGradeById(created.id)

      expect(result.gradeItems).toHaveLength(1)
      expect(result.gradeItems[0].name).toBe("思考")
      expect(
        result.gradeClassrooms.map(
          (gradeClassroom) => gradeClassroom.classroom.name
        )
      ).toEqual(["1年A組"])
    })
  })

  describe("updateGrade", () => {
    // 名前・日付・説明をまとめて書く経路は overviewInPlaceEdit.test.ts が見る。
    // ここでは渡さなかった項目に触れないことを固定する
    it("渡した項目だけを更新し、渡さなかった項目は変えない", async () => {
      const created = await createGrade({
        name: "旧名",
        description: "説明",
        referenceDate: "2026-04-01",
      })

      const result = await updateGrade(created.id, { name: "新名" })
      expect(result.name).toBe("新名")

      const stored = await testPrisma.grade.findUniqueOrThrow({
        where: { id: created.id },
      })
      expect(stored.description).toBe("説明")
      expect(stored.referenceDate?.toISOString()).toBe(
        new Date("2026-04-01").toISOString()
      )
    })

    it("referenceDateをnullにリセットできる", async () => {
      const created = await createGrade({
        name: "PJ",
        referenceDate: "2026-04-01",
      })

      const result = await updateGrade(created.id, {
        referenceDate: null,
      })
      expect(result.referenceDate).toBeNull()
    })
  })

  describe("deleteGrade", () => {
    it("試験を削除できる", async () => {
      const created = await createGrade({ name: "削除対象" })

      await deleteGrade(created.id)

      await expect(getGradeById(created.id)).rejects.toThrow()
    })

    it("関連するGradeItemもカスケード削除される", async () => {
      const created = await createGrade({ name: "PJ" })
      await testPrisma.gradeItem.create({
        data: {
          gradeId: created.id,
          name: "削除対象項目",
          order: 0,
        },
      })

      await deleteGrade(created.id)

      const items = await testPrisma.gradeItem.findMany({
        where: { gradeId: created.id },
      })
      expect(items).toHaveLength(0)
    })
  })
})
