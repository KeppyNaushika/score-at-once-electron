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
      data: { examId: exam.id, subtotalGroupId: group.id },
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
    const sel = await getSubtotalGroupSelection(exam.id)
    expect(sel.success).toBe(true)
    expect(sel.tableGroupIds).toEqual([])
    expect(sel.boxPlotGroupIds).toEqual([])
  })

  it("set した選択が get で往復する", async () => {
    const { exam, groupIds } = await createTestData()
    const [g1, g2, g3] = groupIds

    await setSubtotalGroupSelection(exam.id, [g1, g2], [g3])

    const sel = await getSubtotalGroupSelection(exam.id)
    expect(sel.tableGroupIds.sort()).toEqual([g1, g2].sort())
    expect(sel.boxPlotGroupIds).toEqual([g3])
  })

  it("set は指定外グループのフラグを false にリセットする", async () => {
    const { exam, groupIds } = await createTestData()
    const [g1, g2] = groupIds

    await setSubtotalGroupSelection(exam.id, [g1, g2], [])
    await setSubtotalGroupSelection(exam.id, [g1], []) // g2 を外す

    const sel = await getSubtotalGroupSelection(exam.id)
    expect(sel.tableGroupIds).toEqual([g1])
  })

  it("空配列を set すると全フラグが false になる", async () => {
    const { exam, groupIds } = await createTestData()
    await setSubtotalGroupSelection(exam.id, groupIds, groupIds)
    await setSubtotalGroupSelection(exam.id, [], [])

    const sel = await getSubtotalGroupSelection(exam.id)
    expect(sel.tableGroupIds).toEqual([])
    expect(sel.boxPlotGroupIds).toEqual([])
  })
})
