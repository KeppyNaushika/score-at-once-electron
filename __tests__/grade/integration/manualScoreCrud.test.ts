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
  updateDataSource,
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

    it("文字評価・加減点・理由・コメントを保存できる", async () => {
      const { dataSource, student1 } = await createTestData()

      const result = await batchUpsertManualScores([
        {
          gradeDataSourceId: dataSource.id,
          studentId: student1.id,
          letterValue: "A",
          adjustment: -5,
          adjustmentReason: "期限超過",
          comment: "丁寧にまとめられています",
        },
      ])
      expect(result.success).toBe(true)

      const scores = await getManualScoresByDataSourceId(dataSource.id)
      const ms = scores.manualScores![0]
      expect(ms.letterValue).toBe("A")
      expect(Number(ms.adjustment)).toBe(-5)
      expect(ms.adjustmentReason).toBe("期限超過")
      expect(ms.comment).toBe("丁寧にまとめられています")
    })

    it("指定フィールドのみ部分更新できる（他フィールドは保持）", async () => {
      const { dataSource, student1 } = await createTestData()

      // まずスコアとコメントを設定
      await batchUpsertManualScores([
        {
          gradeDataSourceId: dataSource.id,
          studentId: student1.id,
          score: 80,
          comment: "初回コメント",
        },
      ])

      // adjustmentのみ更新（score/commentは指定しない）
      await batchUpsertManualScores([
        {
          gradeDataSourceId: dataSource.id,
          studentId: student1.id,
          adjustment: 10,
        },
      ])

      const scores = await getManualScoresByDataSourceId(dataSource.id)
      const ms = scores.manualScores![0]
      expect(Number(ms.score)).toBe(80)
      expect(Number(ms.adjustment)).toBe(10)
      expect(ms.comment).toBe("初回コメント")
    })
  })

  describe("文字評価データソース", () => {
    it("inputMode='letter' と変換表を作成・取得できる", async () => {
      const grade = await testPrisma.grade.create({
        data: { name: "文字評価PJ" },
      })
      const gradeItemResult = await createGradeItem({
        gradeId: grade.id,
        name: "授業態度",
      })

      const dsResult = await createDataSource({
        gradeItemId: gradeItemResult.gradeItem!.id,
        type: "manual",
        name: "観点別評価",
        maxScore: 100,
        weight: 100,
        inputMode: "letter",
        letterScales: [
          { label: "A", score: 100, order: 0 },
          { label: "B", score: 80, order: 1 },
          { label: "C", score: 60, order: 2 },
        ],
      })

      expect(dsResult.success).toBe(true)
      expect(dsResult.dataSource!.inputMode).toBe("letter")
      expect(dsResult.dataSource!.letterScales).toHaveLength(3)

      const fetched = await getDataSourcesByGradeItemId(
        gradeItemResult.gradeItem!.id
      )
      const ds = fetched.dataSources![0]
      expect(ds.letterScales).toHaveLength(3)
      expect(ds.letterScales[0].label).toBe("A")
      expect(Number(ds.letterScales[0].score)).toBe(100)
    })

    it("updateDataSourceで変換表を全置換できる", async () => {
      const grade = await testPrisma.grade.create({
        data: { name: "文字評価PJ2" },
      })
      const gradeItemResult = await createGradeItem({
        gradeId: grade.id,
        name: "観点",
      })
      const dsResult = await createDataSource({
        gradeItemId: gradeItemResult.gradeItem!.id,
        type: "manual",
        name: "評価",
        maxScore: 100,
        weight: 100,
        inputMode: "letter",
        letterScales: [
          { label: "A", score: 100, order: 0 },
          { label: "B", score: 80, order: 1 },
        ],
      })

      // 2段階の新しい変換表で置換
      const updated = await updateDataSource(dsResult.dataSource!.id, {
        letterScales: [{ label: "○", score: 100, order: 0 }],
      })
      expect(updated.success).toBe(true)
      expect(updated.dataSource!.letterScales).toHaveLength(1)
      expect(updated.dataSource!.letterScales[0].label).toBe("○")

      // DB上も1件のみ（古い2件は削除されている）
      const remaining = await testPrisma.gradeLetterScale.findMany({
        where: { gradeDataSourceId: dsResult.dataSource!.id },
      })
      expect(remaining).toHaveLength(1)
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
