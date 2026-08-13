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
import {
  createGradeItemBoundary,
  deleteGradeItemBoundary,
  updateGradeItemBoundary,
} from "@/electron-src/lib/prisma/gradeItemBoundary"

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
      expect(result).toBeDefined()
      expect(result.name).toBe("知識・技能")
      expect(result.order).toBe(0)
      expect(result.gradeId).toBe(grade.id)
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

      expect(gradeItemResult1.order).toBe(0)
      expect(gradeItemResult2.order).toBe(1)
      expect(gradeItemResult3.order).toBe(2)
    })
  })

  describe("getGradeItemsByExamId", () => {
    it("試験のGradeItem一覧を取得できる", async () => {
      const grade = await createTestGrade()
      await createGradeItem({ gradeId: grade.id, name: "項目A" })
      await createGradeItem({ gradeId: grade.id, name: "項目B" })

      const result = await getGradeItemsByExamId(grade.id)
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe("項目A")
      expect(result[1].name).toBe("項目B")
    })

    it("dataSourcesも含めて取得できる", async () => {
      const grade = await createTestGrade()
      const gradeItemResult = await createGradeItem({
        gradeId: grade.id,
        name: "項目A",
      })
      await createDataSource({
        gradeItemId: gradeItemResult.id,
        type: "manual",
        name: "レポート",
        weight: 50,
      })

      const result = await getGradeItemsByExamId(grade.id)

      expect(result[0].dataSources).toHaveLength(1)
      expect(result[0].dataSources[0].name).toBe("レポート")
    })
  })

  describe("updateGradeItem", () => {
    it("名前を更新できる", async () => {
      const grade = await createTestGrade()
      const gradeItemResult = await createGradeItem({
        gradeId: grade.id,
        name: "旧名",
      })

      const result = await updateGradeItem(gradeItemResult.id, {
        name: "新名",
      })
      expect(result.name).toBe("新名")
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
        gradeItemId: gradeItemResult.id,
        type: "manual",
        name: "ソース",
        weight: 10,
      })

      await deleteGradeItem(gradeItemResult.id)

      // GradeItem配下のDataSourceも削除されている
      const dataSourceResult = await getDataSourcesByGradeItemId(
        gradeItemResult.id
      )
      expect(dataSourceResult ?? []).toHaveLength(0)
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
      await reorderGradeItems([
        { id: gradeItemResult1.id, order: 1 },
        { id: gradeItemResult2.id, order: 0 },
      ])

      const items = await getGradeItemsByExamId(grade.id)
      expect(items[0].name).toBe("B")
      expect(items[1].name).toBe("A")
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
      gradeItemId: gradeItemResult.id,
      type: "manual",
      name: "手動入力",
      weight: 30,
    })
    expect(dataSourceResult.type).toBe("manual")
    // 満点は元データからライブ算出（manual型は対応ソースなしのため0）
    expect(Number(dataSourceResult.maxScore)).toBe(0)
    expect(Number(dataSourceResult.weight)).toBe(30)

    const list = await getDataSourcesByGradeItemId(gradeItemResult.id)
    expect(list).toHaveLength(1)
  })

  it("DataSourceの名前・換算満点を更新できる（満点は元データ追従で編集不可）", async () => {
    const grade = await createTestGrade()
    const gradeItemResult = await createGradeItem({
      gradeId: grade.id,
      name: "項目",
    })
    const dataSourceResult = await createDataSource({
      gradeItemId: gradeItemResult.id,
      type: "manual",
      name: "旧",
      weight: 10,
    })

    const updated = await updateDataSource(dataSourceResult.id, {
      name: "新",
      weight: 50,
    })
    expect(updated.name).toBe("新")
    expect(Number(updated.weight)).toBe(50)
  })

  it("DataSourceを削除できる", async () => {
    const grade = await createTestGrade()
    const gradeItemResult = await createGradeItem({
      gradeId: grade.id,
      name: "項目",
    })
    const dataSourceResult = await createDataSource({
      gradeItemId: gradeItemResult.id,
      type: "manual",
      name: "削除対象",
      weight: 10,
    })

    await deleteDataSource(dataSourceResult.id)

    const list = await getDataSourcesByGradeItemId(gradeItemResult.id)
    expect(list).toHaveLength(0)
  })

  it("同一GradeItem内でorderが自動インクリメントされる", async () => {
    const grade = await createTestGrade()
    const gradeItemResult = await createGradeItem({
      gradeId: grade.id,
      name: "項目",
    })

    const dataSource1 = await createDataSource({
      gradeItemId: gradeItemResult.id,
      type: "manual",
      name: "A",
      weight: 10,
    })
    const dataSource2 = await createDataSource({
      gradeItemId: gradeItemResult.id,
      type: "manual",
      name: "B",
      weight: 20,
    })

    expect(dataSource1.order).toBe(0)
    expect(dataSource2.order).toBe(1)
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

    await createGradeItemBoundary({
      gradeItemId: gradeItemResult.id,
      label: "A",
      minPercentage: 90,
      order: 0,
    })
    await createGradeItemBoundary({
      gradeItemId: gradeItemResult.id,
      label: "B",
      minPercentage: 70,
      order: 1,
    })
    expect(await readBoundaryLabels(gradeItemResult.id)).toEqual(["A", "B"])
  })

  // 差分更新の要点は「触っていない行に手を触れないこと」。全消し→作り直しでは
  // 行の id が毎回変わり、他端末の編集や作成日時を巻き添えにする。
  it("1本だけ更新しても、他の行の id は変わらない", async () => {
    const grade = await createTestGrade()
    const gradeItemResult = await createGradeItem({
      gradeId: grade.id,
      name: "知識・技能",
    })

    const boundaryA = await createGradeItemBoundary({
      gradeItemId: gradeItemResult.id,
      label: "A",
      minPercentage: 80,
      order: 0,
    })
    const boundaryB = await createGradeItemBoundary({
      gradeItemId: gradeItemResult.id,
      label: "B",
      minPercentage: 60,
      order: 1,
    })

    await updateGradeItemBoundary(boundaryA.id, { minPercentage: 85 })

    const boundaries = await testPrisma.gradeItemBoundary.findMany({
      where: { gradeItemId: gradeItemResult.id },
      orderBy: { order: "asc" },
    })
    expect(boundaries.map((boundary) => boundary.id)).toEqual([
      boundaryA.id,
      boundaryB.id,
    ])
    expect(Number(boundaries[0].minPercentage)).toBe(85)
    expect(Number(boundaries[1].minPercentage)).toBe(60)
  })

  it("1本消しても残りは消えない", async () => {
    const grade = await createTestGrade()
    const gradeItemResult = await createGradeItem({
      gradeId: grade.id,
      name: "知識・技能",
    })

    const boundaryA = await createGradeItemBoundary({
      gradeItemId: gradeItemResult.id,
      label: "A",
      minPercentage: 80,
      order: 0,
    })
    await createGradeItemBoundary({
      gradeItemId: gradeItemResult.id,
      label: "B",
      minPercentage: 60,
      order: 1,
    })

    await deleteGradeItemBoundary(boundaryA.id)

    expect(await readBoundaryLabels(gradeItemResult.id)).toEqual(["B"])
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

    await createGradeItemBoundary({
      gradeItemId: firstItem.id,
      label: "A",
      minPercentage: 80,
      order: 0,
    })
    await createGradeItemBoundary({
      gradeItemId: secondItem.id,
      label: "B",
      minPercentage: 70,
      order: 0,
    })

    const result = await getGradeItemsByExamId(grade.id)
    expect(result).toHaveLength(3)
    expect(result.map((gradeItem) => gradeItem.boundaries.length)).toEqual([
      1, 1, 0,
    ])
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
