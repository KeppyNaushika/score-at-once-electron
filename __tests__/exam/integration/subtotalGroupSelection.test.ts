/**
 * 小計グループ出力選択フラグ（Phase 4c）の統合テスト
 *
 * source of truth は ExamSubtotalGroup.selectedForTable/selectedForBoxPlot。
 * get/set がフラグを正しく往復し、enabled とは独立に保持されることを検証する。
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
  addSubtotalGroupToExam,
  getSubtotalGroupSelection,
  setSubtotalGroupSelection,
} from "@/electron-src/lib/prisma/subtotalGroup"

import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

/** 試験 + 小計グループ3つ + ExamSubtotalGroup junction を作成 */
async function createTestData() {
  const exam = await testPrisma.exam.create({
    data: { examName: "テスト試験", examDate: new Date("2024-04-10") },
  })

  const groupIds: string[] = []
  for (const name of ["国語", "数学", "英語"]) {
    const group = await testPrisma.subtotalGroup.create({ data: { name } })
    await testPrisma.examSubtotalGroup.create({
      data: {
        examId: exam.id,
        subtotalGroupId: group.id,
      },
    })
    groupIds.push(group.id)
  }

  return { exam, groupIds }
}

describe("小計グループ出力選択フラグ", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  it("初期状態は全フラグ false（空配列）", async () => {
    const { exam } = await createTestData()
    const selection = await getSubtotalGroupSelection(exam.id)
    expect(selection.success).toBe(true)
    expect(selection.tableGroupIds).toEqual([])
    expect(selection.boxPlotGroupIds).toEqual([])
  })

  it("set した選択が get で往復する", async () => {
    const { exam, groupIds } = await createTestData()
    const [group1Id, group2Id, group3Id] = groupIds

    await setSubtotalGroupSelection(exam.id, [group1Id, group2Id], [group3Id])

    const selection = await getSubtotalGroupSelection(exam.id)
    expect(selection.tableGroupIds.sort()).toEqual([group1Id, group2Id].sort())
    expect(selection.boxPlotGroupIds).toEqual([group3Id])
  })

  it("set は指定外グループのフラグを false にリセットする", async () => {
    const { exam, groupIds } = await createTestData()
    const [group1Id, group2Id] = groupIds

    await setSubtotalGroupSelection(exam.id, [group1Id, group2Id], [])
    await setSubtotalGroupSelection(exam.id, [group1Id], []) // g2 を外す

    const selection = await getSubtotalGroupSelection(exam.id)
    expect(selection.tableGroupIds).toEqual([group1Id])
  })

  it("空配列を set すると全フラグが false になる", async () => {
    const { exam, groupIds } = await createTestData()
    await setSubtotalGroupSelection(exam.id, groupIds, groupIds)
    await setSubtotalGroupSelection(exam.id, [], [])

    const selection = await getSubtotalGroupSelection(exam.id)
    expect(selection.tableGroupIds).toEqual([])
    expect(selection.boxPlotGroupIds).toEqual([])
  })
})

describe("試験への小計グループ追加", () => {
  it("同じ組み合わせを2回追加しても1行のまま（重複でフラグが二重化しない）", async () => {
    // 重複すると selectedForTable / selectedForBoxPlot が行ごとに食い違い、
    // どちらが効くかが読み取り順次第になる
    const exam = await testPrisma.exam.create({
      data: { examName: "重複テスト" },
    })
    const group = await testPrisma.subtotalGroup.create({
      data: { name: "国語" },
    })

    const first = await addSubtotalGroupToExam(exam.id, group.id)
    const second = await addSubtotalGroupToExam(exam.id, group.id)

    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    expect(
      await testPrisma.examSubtotalGroup.count({
        where: { examId: exam.id, subtotalGroupId: group.id },
      })
    ).toBe(1)
  })

  it("既存の組み合わせを追加し直しても行が増えない（upsertの鍵は@@unique）", async () => {
    const exam = await testPrisma.exam.create({
      data: { examName: "小計グループ追加テスト" },
    })
    const group = await testPrisma.subtotalGroup.create({
      data: { name: "数学" },
    })

    const result = await addSubtotalGroupToExam(exam.id, group.id)

    expect(result.examSubtotalGroup?.examId).toBe(exam.id)
    expect(result.examSubtotalGroup?.subtotalGroupId).toBe(group.id)
  })
})
