/**
 * GradeItem / GradeDataSource / GradeBoundary CRUD 統合テスト
 *
 * テスト用SQLiteに直接接続してDB操作を検証
 * Electronの`app`依存を回避するため、prisma/clientをモックしてテスト用クライアントを注入
 */

import * as path from "path"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const TEST_DB_PATH = path.resolve(__dirname, "../../../data/test-database.db")

// prisma/clientをテスト用クライアントでモック（vi.mockはホイスティングされるため内部で生成）
vi.mock("../../../electron-src/lib/prisma/client", async () => {
  const { getTestPrismaClient } = await import("../../helpers/testPrismaClient")
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

import {
  getBoundarySetsByGradeId,
  upsertBoundarySet,
} from "@/electron-src/lib/prisma/gradeBoundary"
import {
  createDataSource,
  deleteDataSource,
  getDataSourcesByGradeItemId,
  updateDataSource,
} from "@/electron-src/lib/prisma/gradeDataSource"
import {
  createGradeItem,
  deleteGradeItem,
  getGradeItemsByExamId,
  reorderGradeItems,
  updateGradeItem,
} from "@/electron-src/lib/prisma/gradeItem"

import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

// テスト用Grade作成ヘルパー（テスト用クライアントを直接使用）
const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

async function createTestGrade(name = "テスト成績PJ") {
  return testPrisma.grade.create({
    data: { name },
  })
}

describe("GradeItem CRUD", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  describe("createGradeItem", () => {
    it("GradeItemを作成できる", async () => {
      const gp = await createTestGrade()
      const result = await createGradeItem({
        gradeId: gp.id,
        name: "知識・技能",
      })

      expect(result.success).toBe(true)
      expect(result.gradeItem).toBeDefined()
      expect(result.gradeItem!.name).toBe("知識・技能")
      expect(result.gradeItem!.order).toBe(0)
      expect(result.gradeItem!.gradeId).toBe(gp.id)
    })

    it("orderが自動インクリメントされる", async () => {
      const gp = await createTestGrade()

      const r1 = await createGradeItem({
        gradeId: gp.id,
        name: "知識・技能",
      })
      const r2 = await createGradeItem({
        gradeId: gp.id,
        name: "思考・判断・表現",
      })
      const r3 = await createGradeItem({
        gradeId: gp.id,
        name: "主体的に学習に取り組む態度",
      })

      expect(r1.gradeItem!.order).toBe(0)
      expect(r2.gradeItem!.order).toBe(1)
      expect(r3.gradeItem!.order).toBe(2)
    })
  })

  describe("getGradeItemsByExamId", () => {
    it("試験のGradeItem一覧を取得できる", async () => {
      const gp = await createTestGrade()
      await createGradeItem({ gradeId: gp.id, name: "項目A" })
      await createGradeItem({ gradeId: gp.id, name: "項目B" })

      const result = await getGradeItemsByExamId(gp.id)

      expect(result.success).toBe(true)
      expect(result.gradeItems).toHaveLength(2)
      expect(result.gradeItems![0].name).toBe("項目A")
      expect(result.gradeItems![1].name).toBe("項目B")
    })

    it("dataSourcesも含めて取得できる", async () => {
      const gp = await createTestGrade()
      const giResult = await createGradeItem({
        gradeId: gp.id,
        name: "項目A",
      })
      await createDataSource({
        gradeItemId: giResult.gradeItem!.id,
        type: "manual",
        name: "レポート",
        weight: 50,
      })

      const result = await getGradeItemsByExamId(gp.id)

      expect(result.gradeItems![0].dataSources).toHaveLength(1)
      expect(result.gradeItems![0].dataSources[0].name).toBe("レポート")
    })
  })

  describe("updateGradeItem", () => {
    it("名前を更新できる", async () => {
      const gp = await createTestGrade()
      const giResult = await createGradeItem({
        gradeId: gp.id,
        name: "旧名",
      })

      const result = await updateGradeItem(giResult.gradeItem!.id, {
        name: "新名",
      })

      expect(result.success).toBe(true)
      expect(result.gradeItem!.name).toBe("新名")
    })
  })

  describe("deleteGradeItem", () => {
    it("GradeItemを削除できる（Cascade）", async () => {
      const gp = await createTestGrade()
      const giResult = await createGradeItem({
        gradeId: gp.id,
        name: "削除対象",
      })
      await createDataSource({
        gradeItemId: giResult.gradeItem!.id,
        type: "manual",
        name: "ソース",
        weight: 10,
      })

      const result = await deleteGradeItem(giResult.gradeItem!.id)
      expect(result.success).toBe(true)

      // GradeItem配下のDataSourceも削除されている
      const dsResult = await getDataSourcesByGradeItemId(giResult.gradeItem!.id)
      expect(dsResult.dataSources ?? []).toHaveLength(0)
    })
  })

  describe("reorderGradeItems", () => {
    it("並び順を変更できる", async () => {
      const gp = await createTestGrade()
      const r1 = await createGradeItem({
        gradeId: gp.id,
        name: "A",
      })
      const r2 = await createGradeItem({
        gradeId: gp.id,
        name: "B",
      })

      // 順序を入れ替え
      const result = await reorderGradeItems([
        { id: r1.gradeItem!.id, order: 1 },
        { id: r2.gradeItem!.id, order: 0 },
      ])
      expect(result.success).toBe(true)

      const items = await getGradeItemsByExamId(gp.id)
      expect(items.gradeItems![0].name).toBe("B")
      expect(items.gradeItems![1].name).toBe("A")
    })
  })
})

describe("GradeDataSource CRUD", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  it("DataSourceを作成・取得できる", async () => {
    const gp = await createTestGrade()
    const giResult = await createGradeItem({
      gradeId: gp.id,
      name: "項目",
    })

    const dsResult = await createDataSource({
      gradeItemId: giResult.gradeItem!.id,
      type: "manual",
      name: "手動入力",
      weight: 30,
    })

    expect(dsResult.success).toBe(true)
    expect(dsResult.dataSource!.type).toBe("manual")
    // 満点は元データからライブ算出（manual型は対応ソースなしのため0）
    expect(Number(dsResult.dataSource!.maxScore)).toBe(0)
    expect(Number(dsResult.dataSource!.weight)).toBe(30)

    const list = await getDataSourcesByGradeItemId(giResult.gradeItem!.id)
    expect(list.dataSources).toHaveLength(1)
  })

  it("DataSourceの名前・換算満点を更新できる（満点は元データ追従で編集不可）", async () => {
    const gp = await createTestGrade()
    const giResult = await createGradeItem({
      gradeId: gp.id,
      name: "項目",
    })
    const dsResult = await createDataSource({
      gradeItemId: giResult.gradeItem!.id,
      type: "manual",
      name: "旧",
      weight: 10,
    })

    const updated = await updateDataSource(dsResult.dataSource!.id, {
      name: "新",
      weight: 50,
    })

    expect(updated.success).toBe(true)
    expect(updated.dataSource!.name).toBe("新")
    expect(Number(updated.dataSource!.weight)).toBe(50)
  })

  it("DataSourceを削除できる", async () => {
    const gp = await createTestGrade()
    const giResult = await createGradeItem({
      gradeId: gp.id,
      name: "項目",
    })
    const dsResult = await createDataSource({
      gradeItemId: giResult.gradeItem!.id,
      type: "manual",
      name: "削除対象",
      weight: 10,
    })

    const result = await deleteDataSource(dsResult.dataSource!.id)
    expect(result.success).toBe(true)

    const list = await getDataSourcesByGradeItemId(giResult.gradeItem!.id)
    expect(list.dataSources).toHaveLength(0)
  })

  it("同一GradeItem内でorderが自動インクリメントされる", async () => {
    const gp = await createTestGrade()
    const giResult = await createGradeItem({
      gradeId: gp.id,
      name: "項目",
    })

    const ds1 = await createDataSource({
      gradeItemId: giResult.gradeItem!.id,
      type: "manual",
      name: "A",
      weight: 10,
    })
    const ds2 = await createDataSource({
      gradeItemId: giResult.gradeItem!.id,
      type: "manual",
      name: "B",
      weight: 20,
    })

    expect(ds1.dataSource!.order).toBe(0)
    expect(ds2.dataSource!.order).toBe(1)
  })
})

describe("GradeBoundary CRUD", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  it("overall境界セットを作成できる", async () => {
    const gp = await createTestGrade()

    const result = await upsertBoundarySet({
      gradeId: gp.id,
      targetType: "overall",
      gradeItemId: null,
      boundaries: [
        { label: "A", minPercentage: 80, order: 0 },
        { label: "B", minPercentage: 60, order: 1 },
        { label: "C", minPercentage: 0, order: 2 },
      ],
    })

    expect(result.success).toBe(true)
    expect(result.boundarySet!.boundaries).toHaveLength(3)
    expect(result.boundarySet!.targetType).toBe("overall")
  })

  it("grade_item境界セットを作成できる", async () => {
    const gp = await createTestGrade()
    const giResult = await createGradeItem({
      gradeId: gp.id,
      name: "知識・技能",
    })

    const result = await upsertBoundarySet({
      gradeId: gp.id,
      targetType: "grade_item",
      gradeItemId: giResult.gradeItem!.id,
      boundaries: [
        { label: "A", minPercentage: 90, order: 0 },
        { label: "B", minPercentage: 70, order: 1 },
      ],
    })

    expect(result.success).toBe(true)
    expect(result.boundarySet!.gradeItemId).toBe(giResult.gradeItem!.id)
  })

  it("同一キーで再upsertすると境界が置換される", async () => {
    const gp = await createTestGrade()

    await upsertBoundarySet({
      gradeId: gp.id,
      targetType: "overall",
      gradeItemId: null,
      boundaries: [{ label: "A", minPercentage: 80, order: 0 }],
    })

    const result = await upsertBoundarySet({
      gradeId: gp.id,
      targetType: "overall",
      gradeItemId: null,
      boundaries: [
        { label: "S", minPercentage: 95, order: 0 },
        { label: "A", minPercentage: 80, order: 1 },
        { label: "B", minPercentage: 60, order: 2 },
      ],
    })

    expect(result.success).toBe(true)
    expect(result.boundarySet!.boundaries).toHaveLength(3)
    expect(result.boundarySet!.boundaries[0].label).toBe("S")
  })

  it("getBoundarySetsByGradeIdで全セットを取得できる", async () => {
    const gp = await createTestGrade()
    const giResult = await createGradeItem({
      gradeId: gp.id,
      name: "項目",
    })

    await upsertBoundarySet({
      gradeId: gp.id,
      targetType: "overall",
      gradeItemId: null,
      boundaries: [{ label: "A", minPercentage: 80, order: 0 }],
    })
    await upsertBoundarySet({
      gradeId: gp.id,
      targetType: "grade_item",
      gradeItemId: giResult.gradeItem!.id,
      boundaries: [{ label: "B", minPercentage: 70, order: 0 }],
    })

    const result = await getBoundarySetsByGradeId(gp.id)

    expect(result.success).toBe(true)
    expect(result.boundarySets).toHaveLength(2)
  })
})
