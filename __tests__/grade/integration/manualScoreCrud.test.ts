/**
 * GradeBoundary / GradeDataSource reorder テスト
 *
 * gradeBoundary.ts の deleteBoundarySet、gradeDataSource.ts の reorderDataSources を検証。
 * （旧 ManualScore CRUD テストは Coursework へ移行したため __tests__/coursework/ を参照）
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
  createDataSource,
  getDataSourcesByGradeItemId,
  reorderDataSources,
} from "@/electron-src/lib/prisma/gradeDataSource"
import { createGradeItem } from "@/electron-src/lib/prisma/gradeItem"
import {
  deleteGradeItemBoundaries,
  replaceGradeItemBoundaries,
} from "@/electron-src/lib/prisma/gradeItemBoundary"

import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

describe("GradeBoundary 追加テスト", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  describe("deleteGradeItemBoundaries", () => {
    it("評価項目の境界を全て削除できる", async () => {
      const grade = await testPrisma.grade.create({
        data: { name: "PJ" },
      })
      const gradeItemResult = await createGradeItem({
        gradeId: grade.id,
        name: "知識・技能",
      })

      await replaceGradeItemBoundaries({
        gradeItemId: gradeItemResult.gradeItem!.id,
        boundaries: [
          { label: "A", minPercentage: 80, order: 0 },
          { label: "B", minPercentage: 60, order: 1 },
        ],
      })

      const result = await deleteGradeItemBoundaries(
        gradeItemResult.gradeItem!.id
      )
      expect(result.success).toBe(true)

      const remaining = await testPrisma.gradeItemBoundary.findMany({
        where: { gradeItemId: gradeItemResult.gradeItem!.id },
      })
      expect(remaining).toHaveLength(0)
    })

    it("評価項目を消すと境界もカスケード削除される", async () => {
      const grade = await testPrisma.grade.create({
        data: { name: "PJ" },
      })
      const gradeItemResult = await createGradeItem({
        gradeId: grade.id,
        name: "知識・技能",
      })

      await replaceGradeItemBoundaries({
        gradeItemId: gradeItemResult.gradeItem!.id,
        boundaries: [
          { label: "A", minPercentage: 80, order: 0 },
          { label: "B", minPercentage: 60, order: 1 },
        ],
      })

      await testPrisma.gradeItem.delete({
        where: { id: gradeItemResult.gradeItem!.id },
      })

      const boundaries = await testPrisma.gradeItemBoundary.findMany({
        where: { gradeItemId: gradeItemResult.gradeItem!.id },
      })
      expect(boundaries).toHaveLength(0)
    })
  })
})

describe("GradeDataSource reorder テスト", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  describe("reorderDataSources", () => {
    it("データソースの並び順を変更できる", async () => {
      const grade = await testPrisma.grade.create({
        data: { name: "PJ" },
      })
      const gradeItemResult = await createGradeItem({
        gradeId: grade.id,
        name: "項目",
      })
      const gradeItem = gradeItemResult.gradeItem!

      const dataSource1 = await createDataSource({
        gradeItemId: gradeItem.id,
        type: "exam_total",
        name: "A",
        weight: 10,
      })
      const dataSource2 = await createDataSource({
        gradeItemId: gradeItem.id,
        type: "exam_total",
        name: "B",
        weight: 20,
      })

      // 順序を入れ替え
      const result = await reorderDataSources([
        { id: dataSource1.dataSource!.id, order: 1 },
        { id: dataSource2.dataSource!.id, order: 0 },
      ])

      expect(result.success).toBe(true)

      const dataSources = await getDataSourcesByGradeItemId(gradeItem.id)
      expect(dataSources.dataSources![0].name).toBe("B")
      expect(dataSources.dataSources![1].name).toBe("A")
    })
  })
})
