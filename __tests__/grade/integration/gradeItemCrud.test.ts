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
import { replaceGradeItemBoundaries } from "@/electron-src/lib/prisma/gradeItemBoundary"

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
      const grade = await createTestGrade()
      const result = await createGradeItem({
        gradeId: grade.id,
        name: "知識・技能",
      })

      expect(result.success).toBe(true)
      expect(result.gradeItem).toBeDefined()
      expect(result.gradeItem!.name).toBe("知識・技能")
      expect(result.gradeItem!.order).toBe(0)
      expect(result.gradeItem!.gradeId).toBe(grade.id)
    })

    it("orderが自動インクリメントされる", async () => {
      const grade = await createTestGrade()

      const gradeItemResult1 = await createGradeItem({
        gradeId: grade.id,
        name: "知識・技能",
      })
      const gradeItemResult2 = await createGradeItem({
        gradeId: grade.id,
        name: "思考・判断・表現",
      })
      const gradeItemResult3 = await createGradeItem({
        gradeId: grade.id,
        name: "主体的に学習に取り組む態度",
      })

      expect(gradeItemResult1.gradeItem!.order).toBe(0)
      expect(gradeItemResult2.gradeItem!.order).toBe(1)
      expect(gradeItemResult3.gradeItem!.order).toBe(2)
    })
  })

  describe("getGradeItemsByExamId", () => {
    it("試験のGradeItem一覧を取得できる", async () => {
      const grade = await createTestGrade()
      await createGradeItem({ gradeId: grade.id, name: "項目A" })
      await createGradeItem({ gradeId: grade.id, name: "項目B" })

      const result = await getGradeItemsByExamId(grade.id)

      expect(result.success).toBe(true)
      expect(result.gradeItems).toHaveLength(2)
      expect(result.gradeItems![0].name).toBe("項目A")
      expect(result.gradeItems![1].name).toBe("項目B")
    })

    it("dataSourcesも含めて取得できる", async () => {
      const grade = await createTestGrade()
      const gradeItemResult = await createGradeItem({
        gradeId: grade.id,
        name: "項目A",
      })
      await createDataSource({
        gradeItemId: gradeItemResult.gradeItem!.id,
        type: "manual",
        name: "レポート",
        weight: 50,
      })

      const result = await getGradeItemsByExamId(grade.id)

      expect(result.gradeItems![0].dataSources).toHaveLength(1)
      expect(result.gradeItems![0].dataSources[0].name).toBe("レポート")
    })
  })

  describe("updateGradeItem", () => {
    it("名前を更新できる", async () => {
      const grade = await createTestGrade()
      const gradeItemResult = await createGradeItem({
        gradeId: grade.id,
        name: "旧名",
      })

      const result = await updateGradeItem(gradeItemResult.gradeItem!.id, {
        name: "新名",
      })

      expect(result.success).toBe(true)
      expect(result.gradeItem!.name).toBe("新名")
    })
  })

  describe("deleteGradeItem", () => {
    it("GradeItemを削除できる（Cascade）", async () => {
      const grade = await createTestGrade()
      const gradeItemResult = await createGradeItem({
        gradeId: grade.id,
        name: "削除対象",
      })
      await createDataSource({
        gradeItemId: gradeItemResult.gradeItem!.id,
        type: "manual",
        name: "ソース",
        weight: 10,
      })

      const result = await deleteGradeItem(gradeItemResult.gradeItem!.id)
      expect(result.success).toBe(true)

      // GradeItem配下のDataSourceも削除されている
      const dataSourceResult = await getDataSourcesByGradeItemId(
        gradeItemResult.gradeItem!.id
      )
      expect(dataSourceResult.dataSources ?? []).toHaveLength(0)
    })
  })

  describe("reorderGradeItems", () => {
    it("並び順を変更できる", async () => {
      const grade = await createTestGrade()
      const gradeItemResult1 = await createGradeItem({
        gradeId: grade.id,
        name: "A",
      })
      const gradeItemResult2 = await createGradeItem({
        gradeId: grade.id,
        name: "B",
      })

      // 順序を入れ替え
      const result = await reorderGradeItems([
        { id: gradeItemResult1.gradeItem!.id, order: 1 },
        { id: gradeItemResult2.gradeItem!.id, order: 0 },
      ])
      expect(result.success).toBe(true)

      const items = await getGradeItemsByExamId(grade.id)
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
    const grade = await createTestGrade()
    const gradeItemResult = await createGradeItem({
      gradeId: grade.id,
      name: "項目",
    })

    const dataSourceResult = await createDataSource({
      gradeItemId: gradeItemResult.gradeItem!.id,
      type: "manual",
      name: "手動入力",
      weight: 30,
    })

    expect(dataSourceResult.success).toBe(true)
    expect(dataSourceResult.dataSource!.type).toBe("manual")
    // 満点は元データからライブ算出（manual型は対応ソースなしのため0）
    expect(Number(dataSourceResult.dataSource!.maxScore)).toBe(0)
    expect(Number(dataSourceResult.dataSource!.weight)).toBe(30)

    const list = await getDataSourcesByGradeItemId(
      gradeItemResult.gradeItem!.id
    )
    expect(list.dataSources).toHaveLength(1)
  })

  it("DataSourceの名前・換算満点を更新できる（満点は元データ追従で編集不可）", async () => {
    const grade = await createTestGrade()
    const gradeItemResult = await createGradeItem({
      gradeId: grade.id,
      name: "項目",
    })
    const dataSourceResult = await createDataSource({
      gradeItemId: gradeItemResult.gradeItem!.id,
      type: "manual",
      name: "旧",
      weight: 10,
    })

    const updated = await updateDataSource(dataSourceResult.dataSource!.id, {
      name: "新",
      weight: 50,
    })

    expect(updated.success).toBe(true)
    expect(updated.dataSource!.name).toBe("新")
    expect(Number(updated.dataSource!.weight)).toBe(50)
  })

  it("DataSourceを削除できる", async () => {
    const grade = await createTestGrade()
    const gradeItemResult = await createGradeItem({
      gradeId: grade.id,
      name: "項目",
    })
    const dataSourceResult = await createDataSource({
      gradeItemId: gradeItemResult.gradeItem!.id,
      type: "manual",
      name: "削除対象",
      weight: 10,
    })

    const result = await deleteDataSource(dataSourceResult.dataSource!.id)
    expect(result.success).toBe(true)

    const list = await getDataSourcesByGradeItemId(
      gradeItemResult.gradeItem!.id
    )
    expect(list.dataSources).toHaveLength(0)
  })

  it("同一GradeItem内でorderが自動インクリメントされる", async () => {
    const grade = await createTestGrade()
    const gradeItemResult = await createGradeItem({
      gradeId: grade.id,
      name: "項目",
    })

    const dataSource1 = await createDataSource({
      gradeItemId: gradeItemResult.gradeItem!.id,
      type: "manual",
      name: "A",
      weight: 10,
    })
    const dataSource2 = await createDataSource({
      gradeItemId: gradeItemResult.gradeItem!.id,
      type: "manual",
      name: "B",
      weight: 20,
    })

    expect(dataSource1.dataSource!.order).toBe(0)
    expect(dataSource2.dataSource!.order).toBe(1)
  })
})

describe("GradeItemBoundary CRUD", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  /** 境界のラベルを order 昇順で読む */
  async function readBoundaryLabels(gradeItemId: string): Promise<string[]> {
    const boundaries = await testPrisma.gradeItemBoundary.findMany({
      where: { gradeItemId },
      orderBy: { order: "asc" },
    })
    return boundaries.map((boundary) => boundary.label)
  }

  it("評価項目に境界を引ける", async () => {
    const grade = await createTestGrade()
    const gradeItemResult = await createGradeItem({
      gradeId: grade.id,
      name: "知識・技能",
    })

    const result = await replaceGradeItemBoundaries({
      gradeItemId: gradeItemResult.gradeItem!.id,
      boundaries: [
        { label: "A", minPercentage: 90, order: 0 },
        { label: "B", minPercentage: 70, order: 1 },
      ],
    })

    expect(result.success).toBe(true)
    expect(await readBoundaryLabels(gradeItemResult.gradeItem!.id)).toEqual([
      "A",
      "B",
    ])
  })

  it("同じ評価項目へ再度書くと境界が置換される", async () => {
    const grade = await createTestGrade()
    const gradeItemResult = await createGradeItem({
      gradeId: grade.id,
      name: "知識・技能",
    })

    await replaceGradeItemBoundaries({
      gradeItemId: gradeItemResult.gradeItem!.id,
      boundaries: [{ label: "A", minPercentage: 80, order: 0 }],
    })

    const result = await replaceGradeItemBoundaries({
      gradeItemId: gradeItemResult.gradeItem!.id,
      boundaries: [
        { label: "S", minPercentage: 95, order: 0 },
        { label: "A", minPercentage: 80, order: 1 },
        { label: "B", minPercentage: 60, order: 2 },
      ],
    })

    expect(result.success).toBe(true)
    expect(await readBoundaryLabels(gradeItemResult.gradeItem!.id)).toEqual([
      "S",
      "A",
      "B",
    ])
  })

  it("空配列で置換すると境界が1本も残らない", async () => {
    const grade = await createTestGrade()
    const gradeItemResult = await createGradeItem({
      gradeId: grade.id,
      name: "知識・技能",
    })

    await replaceGradeItemBoundaries({
      gradeItemId: gradeItemResult.gradeItem!.id,
      boundaries: [{ label: "A", minPercentage: 80, order: 0 }],
    })
    const result = await replaceGradeItemBoundaries({
      gradeItemId: gradeItemResult.gradeItem!.id,
      boundaries: [],
    })

    expect(result.success).toBe(true)
    expect(await readBoundaryLabels(gradeItemResult.gradeItem!.id)).toEqual([])
  })

  // 境界は専用APIでなく評価項目の子として降ってくる。境界0本の項目も
  // 「境界の無い評価項目」として必ず並ぶ（設定画面が全項目の編集欄を出せる）
  it("評価項目一覧が境界を同梱して返す（0本の項目も落とさない）", async () => {
    const grade = await createTestGrade()
    const firstItem = await createGradeItem({
      gradeId: grade.id,
      name: "項目1",
    })
    const secondItem = await createGradeItem({
      gradeId: grade.id,
      name: "項目2",
    })
    await createGradeItem({ gradeId: grade.id, name: "項目3" })

    await replaceGradeItemBoundaries({
      gradeItemId: firstItem.gradeItem!.id,
      boundaries: [{ label: "A", minPercentage: 80, order: 0 }],
    })
    await replaceGradeItemBoundaries({
      gradeItemId: secondItem.gradeItem!.id,
      boundaries: [{ label: "B", minPercentage: 70, order: 0 }],
    })

    const result = await getGradeItemsByExamId(grade.id)

    expect(result.success).toBe(true)
    expect(result.gradeItems).toHaveLength(3)
    expect(
      result.gradeItems!.map((gradeItem) => gradeItem.boundaries.length)
    ).toEqual([1, 1, 0])
  })
})

describe("評価項目の削除と制約ルール（issue #1063）", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  /** 比較先＝評定、集計対象＝渡した項目 の整合ルールを作る */
  async function createConsistencyConstraint(
    gradeId: string,
    targetGradeItemId: string,
    viewpointGradeItemIds: string[]
  ) {
    return testPrisma.gradeConstraint.create({
      data: {
        gradeId,
        name: "評定と観点の整合",
        kind: "consistency",
        targetGradeItemId,
        aggregate: "average",
        tolerance: 1,
        expression: "",
        color: "#fecaca",
        enabled: true,
        order: 0,
        viewpoints: {
          create: viewpointGradeItemIds.map((gradeItemId, index) => ({
            id: `${targetGradeItemId}:${gradeItemId}`,
            gradeItemId,
            order: index,
          })),
        },
      },
    })
  }

  // 集計対象が1つ減ると残りだけで平均を取り、判定の意味が黙って変わる。
  // viewpoint 行は FK の Cascade で消えるため、削除側で無効化しないと検知できない。
  it("集計対象の評価項目を削除すると、その制約ルールを無効化して知らせる", async () => {
    const grade = await createTestGrade("削除と制約")
    const knowledge = await testPrisma.gradeItem.create({
      data: { gradeId: grade.id, name: "知識・技能", order: 0 },
    })
    const thinking = await testPrisma.gradeItem.create({
      data: { gradeId: grade.id, name: "思考・判断・表現", order: 1 },
    })
    const hyotei = await testPrisma.gradeItem.create({
      data: { gradeId: grade.id, name: "評定", order: 2 },
    })
    const constraint = await createConsistencyConstraint(grade.id, hyotei.id, [
      knowledge.id,
      thinking.id,
    ])

    const result = await deleteGradeItem(thinking.id)

    expect(result.success).toBe(true)
    expect(result.disabledConstraintNames).toEqual(["評定と観点の整合"])

    const after = await testPrisma.gradeConstraint.findUnique({
      where: { id: constraint.id },
      include: { viewpoints: true },
    })
    // 集計対象は Cascade で減るが、ルールは無効化され理由が残る。
    // 理由は disabledReason へ書き、教員が書いた message は触らない
    // （message は結果表のツールチップに違反理由として出るため）。
    expect(after!.viewpoints).toHaveLength(1)
    expect(after!.enabled).toBe(false)
    expect(after!.disabledReason).toContain("思考・判断・表現")
    expect(after!.message).toBeNull()
  })

  it("比較先の評価項目を削除すると参照はnullになり、ルールは残る", async () => {
    const grade = await createTestGrade("削除と比較先")
    const knowledge = await testPrisma.gradeItem.create({
      data: { gradeId: grade.id, name: "知識・技能", order: 0 },
    })
    const hyotei = await testPrisma.gradeItem.create({
      data: { gradeId: grade.id, name: "評定", order: 1 },
    })
    const constraint = await createConsistencyConstraint(grade.id, hyotei.id, [
      knowledge.id,
    ])

    const result = await deleteGradeItem(hyotei.id)

    expect(result.success).toBe(true)
    // 比較先の欠落は評価時に「未選択」として検知されるので、無効化はしない
    expect(result.disabledConstraintNames).toEqual([])

    const after = await testPrisma.gradeConstraint.findUnique({
      where: { id: constraint.id },
    })
    expect(after!.targetGradeItemId).toBeNull()
    expect(after!.enabled).toBe(true)
  })

  it("集計対象を含まない制約ルールは無効化されない", async () => {
    const grade = await createTestGrade("削除と無関係ルール")
    const knowledge = await testPrisma.gradeItem.create({
      data: { gradeId: grade.id, name: "知識・技能", order: 0 },
    })
    const unrelated = await testPrisma.gradeItem.create({
      data: { gradeId: grade.id, name: "無関係", order: 1 },
    })
    const hyotei = await testPrisma.gradeItem.create({
      data: { gradeId: grade.id, name: "評定", order: 2 },
    })
    const constraint = await createConsistencyConstraint(grade.id, hyotei.id, [
      knowledge.id,
    ])

    const result = await deleteGradeItem(unrelated.id)

    expect(result.disabledConstraintNames).toEqual([])
    const after = await testPrisma.gradeConstraint.findUnique({
      where: { id: constraint.id },
    })
    expect(after!.enabled).toBe(true)
  })
})
