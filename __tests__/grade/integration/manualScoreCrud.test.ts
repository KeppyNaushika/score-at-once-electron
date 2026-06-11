/**
 * ManualScore / GradeBoundary 追加テスト
 *
 * manualScore.ts の全関数と gradeBoundary.ts の deleteBoundarySet、
 * gradeDataSource.ts の reorderDataSources を検証
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
  deleteBoundarySet,
  upsertBoundarySet,
} from "@/electron-src/lib/prisma/gradeBoundary"
import {
  createDataSource,
  getDataSourcesByGradeItemId,
  reorderDataSources,
} from "@/electron-src/lib/prisma/gradeDataSource"
import { createGradeItem } from "@/electron-src/lib/prisma/gradeItem"
import {
  batchUpsertManualScores,
  getManualScoresByDataSourceId,
} from "@/electron-src/lib/prisma/manualScore"

import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

/** テスト用のGrade + GradeItem + DataSource + Students を作成 */
async function createTestData() {
  const grade = await testPrisma.grade.create({
    data: { name: "テスト成績PJ" },
  })

  const gradeItemResult = await createGradeItem({
    gradeId: grade.id,
    name: "知識・技能",
  })
  const gradeItem = gradeItemResult.gradeItem!

  const dataSourceResult = await createDataSource({
    gradeItemId: gradeItem.id,
    type: "manual",
    name: "レポート",
    maxScore: 100,
    weight: 100,
  })
  const dataSource = dataSourceResult.dataSource!

  const student1 = await testPrisma.student.create({
    data: {
      studentNumber: "S001",
      lastName: "山田",
      firstName: "太郎",
      lastNameKana: "ヤマダ",
      firstNameKana: "タロウ",
    },
  })

  const student2 = await testPrisma.student.create({
    data: {
      studentNumber: "S002",
      lastName: "佐藤",
      firstName: "花子",
      lastNameKana: "サトウ",
      firstNameKana: "ハナコ",
    },
  })

  return { grade, gradeItem, dataSource, student1, student2 }
}

describe("ManualScore CRUD", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  describe("batchUpsertManualScores", () => {
    it("新規スコアを一括作成できる", async () => {
      const { dataSource, student1, student2 } = await createTestData()

      const result = await batchUpsertManualScores([
        {
          gradeDataSourceId: dataSource.id,
          studentId: student1.id,
          score: 85,
        },
        {
          gradeDataSourceId: dataSource.id,
          studentId: student2.id,
          score: 72,
        },
      ])

      expect(result.success).toBe(true)

      const scores = await getManualScoresByDataSourceId(dataSource.id)
      expect(scores.manualScores).toHaveLength(2)
    })

    it("既存スコアを更新できる（upsert動作）", async () => {
      const { dataSource, student1 } = await createTestData()

      // 初回作成
      await batchUpsertManualScores([
        {
          gradeDataSourceId: dataSource.id,
          studentId: student1.id,
          score: 50,
        },
      ])

      // 更新
      const result = await batchUpsertManualScores([
        {
          gradeDataSourceId: dataSource.id,
          studentId: student1.id,
          score: 90,
        },
      ])

      expect(result.success).toBe(true)

      const scores = await getManualScoresByDataSourceId(dataSource.id)
      expect(scores.manualScores).toHaveLength(1)
      expect(Number(scores.manualScores![0].score)).toBe(90)
    })

    it("scoreをnullに更新できる", async () => {
      const { dataSource, student1 } = await createTestData()

      await batchUpsertManualScores([
        {
          gradeDataSourceId: dataSource.id,
          studentId: student1.id,
          score: 85,
        },
      ])

      await batchUpsertManualScores([
        {
          gradeDataSourceId: dataSource.id,
          studentId: student1.id,
          score: null,
        },
      ])

      const scores = await getManualScoresByDataSourceId(dataSource.id)
      expect(scores.manualScores![0].score).toBeNull()
    })

    it("空配列の場合は何も起きない", async () => {
      const result = await batchUpsertManualScores([])
      expect(result.success).toBe(true)
    })
  })

  describe("getManualScoresByDataSourceId", () => {
    it("データソースのスコア一覧を取得できる", async () => {
      const { dataSource, student1, student2 } = await createTestData()

      await batchUpsertManualScores([
        {
          gradeDataSourceId: dataSource.id,
          studentId: student1.id,
          score: 85,
        },
        {
          gradeDataSourceId: dataSource.id,
          studentId: student2.id,
          score: 72,
        },
      ])

      const result = await getManualScoresByDataSourceId(dataSource.id)

      expect(result.success).toBe(true)
      expect(result.manualScores).toHaveLength(2)
      // studentNumber昇順でソートされている
      expect(result.manualScores![0].student.studentNumber).toBe("S001")
      expect(result.manualScores![1].student.studentNumber).toBe("S002")
    })

    it("student情報が含まれる", async () => {
      const { dataSource, student1 } = await createTestData()

      await batchUpsertManualScores([
        {
          gradeDataSourceId: dataSource.id,
          studentId: student1.id,
          score: 85,
        },
      ])

      const result = await getManualScoresByDataSourceId(dataSource.id)

      expect(result.manualScores![0].student.lastName).toBe("山田")
      expect(result.manualScores![0].student.firstName).toBe("太郎")
    })

    it("スコアが存在しない場合は空配列を返す", async () => {
      const { dataSource } = await createTestData()

      const result = await getManualScoresByDataSourceId(dataSource.id)

      expect(result.success).toBe(true)
      expect(result.manualScores).toHaveLength(0)
    })
  })
})

describe("GradeBoundary 追加テスト", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  describe("deleteBoundarySet", () => {
    it("境界セットを削除できる", async () => {
      const grade = await testPrisma.grade.create({
        data: { name: "PJ" },
      })

      const upserted = await upsertBoundarySet({
        gradeId: grade.id,
        targetType: "overall",
        gradeItemId: null,
        boundaries: [
          { label: "A", minPercentage: 80, order: 0 },
          { label: "B", minPercentage: 60, order: 1 },
        ],
      })

      const result = await deleteBoundarySet(upserted.boundarySet!.id)
      expect(result.success).toBe(true)

      // 削除後はセットが0件
      const remaining = await testPrisma.gradeBoundarySet.findMany({
        where: { gradeId: grade.id },
      })
      expect(remaining).toHaveLength(0)
    })

    it("境界セット内のboundaryもカスケード削除される", async () => {
      const grade = await testPrisma.grade.create({
        data: { name: "PJ" },
      })

      const upserted = await upsertBoundarySet({
        gradeId: grade.id,
        targetType: "overall",
        gradeItemId: null,
        boundaries: [
          { label: "A", minPercentage: 80, order: 0 },
          { label: "B", minPercentage: 60, order: 1 },
        ],
      })

      await deleteBoundarySet(upserted.boundarySet!.id)

      const boundaries = await testPrisma.gradeBoundary.findMany({
        where: { gradeBoundarySetId: upserted.boundarySet!.id },
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

      const ds1 = await createDataSource({
        gradeItemId: gradeItem.id,
        type: "manual",
        name: "A",
        maxScore: 10,
        weight: 10,
      })
      const ds2 = await createDataSource({
        gradeItemId: gradeItem.id,
        type: "manual",
        name: "B",
        maxScore: 20,
        weight: 20,
      })

      // 順序を入れ替え
      const result = await reorderDataSources([
        { id: ds1.dataSource!.id, order: 1 },
        { id: ds2.dataSource!.id, order: 0 },
      ])

      expect(result.success).toBe(true)

      const dataSources = await getDataSourcesByGradeItemId(gradeItem.id)
      expect(dataSources.dataSources![0].name).toBe("B")
      expect(dataSources.dataSources![1].name).toBe("A")
    })
  })
})
