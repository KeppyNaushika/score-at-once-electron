/**
 * GradeItem / GradeDataSource / GradeItemBoundary CRUD 統合テスト
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

import { getGradeById } from "@/electron-src/lib/prisma/grade"
import {
  createDataSource,
  deleteDataSource,
  reorderDataSources,
  updateDataSource,
} from "@/electron-src/lib/prisma/gradeDataSource"
import {
  createGradeItem,
  deleteGradeItem,
  reorderGradeItems,
  updateGradeItem,
} from "@/electron-src/lib/prisma/gradeItem"
import {
  createGradeItemBoundary,
  deleteGradeItemBoundaries,
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

/** 評価項目の名前を order 昇順で読む */
async function readGradeItemNames(gradeId: string): Promise<string[]> {
  const gradeItems = await testPrisma.gradeItem.findMany({
    where: { gradeId },
    orderBy: { order: "asc" },
  })
  return gradeItems.map((gradeItem) => gradeItem.name)
}

/** データソースの名前を order 昇順で読む */
async function readDataSourceNames(gradeItemId: string): Promise<string[]> {
  const dataSources = await testPrisma.gradeDataSource.findMany({
    where: { gradeItemId },
    orderBy: { order: "asc" },
  })
  return dataSources.map((dataSource) => dataSource.name)
}

/** 境界のラベルを order 昇順で読む */
async function readBoundaryLabels(gradeItemId: string): Promise<string[]> {
  const boundaries = await testPrisma.gradeItemBoundary.findMany({
    where: { gradeItemId },
    orderBy: { order: "asc" },
  })
  return boundaries.map((boundary) => boundary.label)
}

beforeEach(async () => {
  await cleanupTestDatabase()
})

afterAll(async () => {
  await cleanupTestDatabase()
  await testPrisma.$disconnect()
  await disconnectTestPrisma()
})

describe("GradeItem CRUD", () => {
  describe("createGradeItem", () => {
    it("GradeItemを作成できる", async () => {
      const grade = await createTestGrade()
      const result = await createGradeItem({
        gradeId: grade.id,
        name: "知識・技能",
      })
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
    it("GradeItemを削除すると、配下のデータソースと境界も消える", async () => {
      const grade = await createTestGrade()
      const gradeItemResult = await createGradeItem({
        gradeId: grade.id,
        name: "削除対象",
      })
      await createDataSource({
        gradeItemId: gradeItemResult.id,
        type: "exam_total",
        name: "ソース",
        weight: 10,
      })
      await createGradeItemBoundary({
        gradeItemId: gradeItemResult.id,
        label: "A",
        minPercentage: 80,
        order: 0,
      })

      await deleteGradeItem(gradeItemResult.id)

      expect(await readGradeItemNames(grade.id)).toEqual([])
      expect(await readDataSourceNames(gradeItemResult.id)).toEqual([])
      expect(await readBoundaryLabels(gradeItemResult.id)).toEqual([])
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

      expect(await readGradeItemNames(grade.id)).toEqual(["B", "A"])
    })
  })
})

describe("GradeDataSource CRUD", () => {
  it("DataSourceを作成でき、満点は参照先の元データから算出される", async () => {
    const grade = await createTestGrade()
    const gradeItemResult = await createGradeItem({
      gradeId: grade.id,
      name: "項目",
    })
    const coursework = await testPrisma.coursework.create({
      data: { name: "提出物" },
    })
    const courseworkItem = await testPrisma.courseworkItem.create({
      data: { courseworkId: coursework.id, name: "レポート", maxScore: 20 },
    })

    const dataSourceResult = await createDataSource({
      gradeItemId: gradeItemResult.id,
      type: "coursework",
      courseworkItemId: courseworkItem.id,
      name: "提出物(レポート)",
      weight: 30,
    })
    expect(dataSourceResult.type).toBe("coursework")
    // 満点は列ではなく、参照先の評価項目の満点から算出される
    expect(Number(dataSourceResult.maxScore)).toBe(20)
    expect(Number(dataSourceResult.weight)).toBe(30)

    expect(await readDataSourceNames(gradeItemResult.id)).toEqual([
      "提出物(レポート)",
    ])
  })

  it("DataSourceの名前・換算満点を更新できる", async () => {
    const grade = await createTestGrade()
    const gradeItemResult = await createGradeItem({
      gradeId: grade.id,
      name: "項目",
    })
    const dataSourceResult = await createDataSource({
      gradeItemId: gradeItemResult.id,
      type: "exam_total",
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
      type: "exam_total",
      name: "削除対象",
      weight: 10,
    })

    await deleteDataSource(dataSourceResult.id)

    expect(await readDataSourceNames(gradeItemResult.id)).toEqual([])
  })

  it("同一GradeItem内でorderが自動インクリメントされる", async () => {
    const grade = await createTestGrade()
    const gradeItemResult = await createGradeItem({
      gradeId: grade.id,
      name: "項目",
    })

    const dataSource1 = await createDataSource({
      gradeItemId: gradeItemResult.id,
      type: "exam_total",
      name: "A",
      weight: 10,
    })
    const dataSource2 = await createDataSource({
      gradeItemId: gradeItemResult.id,
      type: "exam_total",
      name: "B",
      weight: 20,
    })

    expect(dataSource1.order).toBe(0)
    expect(dataSource2.order).toBe(1)
  })

  it("データソースの並び順を変更できる", async () => {
    const grade = await createTestGrade()
    const gradeItemResult = await createGradeItem({
      gradeId: grade.id,
      name: "項目",
    })

    const dataSource1 = await createDataSource({
      gradeItemId: gradeItemResult.id,
      type: "exam_total",
      name: "A",
      weight: 10,
    })
    const dataSource2 = await createDataSource({
      gradeItemId: gradeItemResult.id,
      type: "exam_total",
      name: "B",
      weight: 20,
    })

    // 順序を入れ替え
    await reorderDataSources([
      { id: dataSource1.id, order: 1 },
      { id: dataSource2.id, order: 0 },
    ])

    expect(await readDataSourceNames(gradeItemResult.id)).toEqual(["B", "A"])
  })
})

describe("GradeItemBoundary CRUD", () => {
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

  it("評価項目の境界を全て削除できる（他の評価項目の境界は残る）", async () => {
    const grade = await createTestGrade()
    const targetItem = await createGradeItem({
      gradeId: grade.id,
      name: "知識・技能",
    })
    const otherItem = await createGradeItem({
      gradeId: grade.id,
      name: "思考・判断・表現",
    })
    for (const gradeItemId of [targetItem.id, otherItem.id]) {
      await createGradeItemBoundary({
        gradeItemId,
        label: "A",
        minPercentage: 80,
        order: 0,
      })
      await createGradeItemBoundary({
        gradeItemId,
        label: "B",
        minPercentage: 60,
        order: 1,
      })
    }

    await deleteGradeItemBoundaries(targetItem.id)

    expect(await readBoundaryLabels(targetItem.id)).toEqual([])
    expect(await readBoundaryLabels(otherItem.id)).toEqual(["A", "B"])
  })

  // 境界は専用APIでなく評価項目の子として降ってくる。境界0本の項目も
  // 「境界の無い評価項目」として必ず並ぶ（設定画面が全項目の編集欄を出せる）
  it("成績算出の詳細が、評価項目ごとに境界を同梱して返す（0本の項目も落とさない）", async () => {
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

    const { gradeItems } = await getGradeById(grade.id)
    expect(
      gradeItems.map((gradeItem) => [
        gradeItem.name,
        gradeItem.boundaries.map((boundary) => boundary.label),
      ])
    ).toEqual([
      ["項目1", ["A"]],
      ["項目2", ["B"]],
      ["項目3", []],
    ])
  })
})

describe("評価項目の削除と制約ルール（issue #1063）", () => {
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
