/**
 * 出力で使う比較の選択（GradeExportComparison）の読み書きの統合テスト
 *
 * 固定したいこと:
 * - 行が無い比較は既定で出す（行を作るのは切り替えたときだけ）
 * - 同じ比較を何度切り替えても行は1つ（`@@unique([gradeId, gradeComparisonId])` が鍵）
 * - 別の成績算出の比較は書けない（どこからも見えない行を作らない）
 * - 比較・成績算出を消すと選択も消える。成績算出の複製では選択も写る
 *
 * IPC の境界ごと呼ぶ（`grade:getExportComparisons` / `grade:setExportComparison`）。
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../../electron-src/lib/prisma/client", async () => {
  const { getTestPrismaClient } = await import("../../helpers/testPrismaClient")
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

import { gradeHandlers } from "@/electron-src/ipc-handlers/gradeHandlers"
import { duplicateGrade } from "@/electron-src/lib/prisma/gradeDuplicate"
import { DEFAULT_EXPORT_COMPARISON_ENABLED } from "@/types/gradeExport.types"

import { captureIpcHandler } from "../../helpers/ipcHandlerHarness"
import {
  cleanupTestDatabase,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../../helpers/testPrismaClient"

const prisma = getTestPrismaClient()

const getExportComparisons = captureIpcHandler(
  gradeHandlers,
  "grade:getExportComparisons"
)
const setExportComparison = captureIpcHandler(
  gradeHandlers,
  "grade:setExportComparison"
)

/** 1学期・2学期の成績算出と、2学期の評価項目に付けた比較2つ */
async function createComparedGrades() {
  const firstTerm = await prisma.grade.create({ data: { name: "1学期" } })
  const firstTermItem = await prisma.gradeItem.create({
    data: { gradeId: firstTerm.id, name: "知識・技能" },
  })
  const secondTerm = await prisma.grade.create({ data: { name: "2学期" } })
  const knowledgeItem = await prisma.gradeItem.create({
    data: { gradeId: secondTerm.id, name: "知識・技能", order: 0 },
  })
  const thinkingItem = await prisma.gradeItem.create({
    data: { gradeId: secondTerm.id, name: "思考・判断・表現", order: 1 },
  })
  const comparisonWithFirstTerm = await prisma.gradeComparison.create({
    data: {
      gradeItemId: knowledgeItem.id,
      comparedGradeItemId: firstTermItem.id,
      order: 0,
    },
  })
  const comparisonWithinGrade = await prisma.gradeComparison.create({
    data: {
      gradeItemId: knowledgeItem.id,
      comparedGradeItemId: thinkingItem.id,
      order: 1,
    },
  })
  return {
    firstTerm,
    secondTerm,
    comparisonWithFirstTerm,
    comparisonWithinGrade,
  }
}

beforeEach(async () => {
  await cleanupTestDatabase()
})

afterAll(async () => {
  await disconnectTestPrisma()
})

describe("出力で使う比較の選択", () => {
  it("行が無い比較は既定で出す（何も書かれていない）", async () => {
    const { secondTerm } = await createComparedGrades()

    expect(DEFAULT_EXPORT_COMPARISON_ENABLED).toBe(true)
    expect(await getExportComparisons(secondTerm.id)).toEqual([])
  })

  it("外すと enabled=false の行ができ、戻しても行は1つのまま", async () => {
    const { secondTerm, comparisonWithFirstTerm } = await createComparedGrades()

    await setExportComparison({
      gradeId: secondTerm.id,
      gradeComparisonId: comparisonWithFirstTerm.id,
      enabled: false,
    })
    expect(await getExportComparisons(secondTerm.id)).toEqual([
      expect.objectContaining({
        gradeId: secondTerm.id,
        gradeComparisonId: comparisonWithFirstTerm.id,
        enabled: false,
      }),
    ])

    await setExportComparison({
      gradeId: secondTerm.id,
      gradeComparisonId: comparisonWithFirstTerm.id,
      enabled: true,
    })
    const rows = await prisma.gradeExportComparison.findMany({
      where: { gradeId: secondTerm.id },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].enabled).toBe(true)
  })

  it("切り替えは操作履歴に残り、成績算出ごとに1行へまとまる", async () => {
    const { secondTerm, comparisonWithFirstTerm, comparisonWithinGrade } =
      await createComparedGrades()

    await setExportComparison({
      gradeId: secondTerm.id,
      gradeComparisonId: comparisonWithFirstTerm.id,
      enabled: false,
    })
    await setExportComparison({
      gradeId: secondTerm.id,
      gradeComparisonId: comparisonWithinGrade.id,
      enabled: false,
    })

    const logs = await prisma.auditLog.findMany({
      where: { action: "grade.export_comparison.update" },
    })
    expect(logs).toHaveLength(1)
    expect(logs[0].scopeId).toBe(secondTerm.id)
    expect(logs[0].metadata).toContain("1学期 > 知識・技能")
    expect(logs[0].metadata).toContain("思考・判断・表現")
  })

  it("既定と同じ値を書いても操作履歴は残さない", async () => {
    const { secondTerm, comparisonWithFirstTerm } = await createComparedGrades()

    await setExportComparison({
      gradeId: secondTerm.id,
      gradeComparisonId: comparisonWithFirstTerm.id,
      enabled: DEFAULT_EXPORT_COMPARISON_ENABLED,
    })

    expect(
      await prisma.auditLog.count({
        where: { action: "grade.export_comparison.update" },
      })
    ).toBe(0)
  })

  it("別の成績算出の比較は書けない", async () => {
    const { firstTerm, comparisonWithFirstTerm } = await createComparedGrades()

    await expect(
      setExportComparison({
        gradeId: firstTerm.id,
        gradeComparisonId: comparisonWithFirstTerm.id,
        enabled: false,
      })
    ).rejects.toThrow("この成績算出の比較ではありません")
    expect(await prisma.gradeExportComparison.count()).toBe(0)
  })

  it("比較を消すと選択も消える", async () => {
    const { secondTerm, comparisonWithFirstTerm } = await createComparedGrades()
    await setExportComparison({
      gradeId: secondTerm.id,
      gradeComparisonId: comparisonWithFirstTerm.id,
      enabled: false,
    })

    await prisma.gradeComparison.delete({
      where: { id: comparisonWithFirstTerm.id },
    })

    expect(await getExportComparisons(secondTerm.id)).toEqual([])
  })

  it("成績算出を複製すると、選択も新しい比較へ写る", async () => {
    const { secondTerm, comparisonWithFirstTerm, comparisonWithinGrade } =
      await createComparedGrades()
    await setExportComparison({
      gradeId: secondTerm.id,
      gradeComparisonId: comparisonWithFirstTerm.id,
      enabled: false,
    })

    const copy = await duplicateGrade(secondTerm.id)
    if (!copy) throw new Error("複製できなかった")

    const copiedComparisons = await prisma.gradeComparison.findMany({
      where: { gradeItem: { gradeId: copy.id } },
      include: { comparedGradeItem: true, exportSelections: true },
      orderBy: { order: "asc" },
    })
    expect(copiedComparisons).toHaveLength(2)
    // 1学期との比較は外したまま、同じ成績算出の中の比較は行が無い（既定で出す）
    const [copiedWithFirstTerm, copiedWithinGrade] = copiedComparisons
    expect(copiedWithFirstTerm.id).not.toBe(comparisonWithFirstTerm.id)
    expect(copiedWithFirstTerm.exportSelections).toEqual([
      expect.objectContaining({ gradeId: copy.id, enabled: false }),
    ])
    expect(copiedWithinGrade.id).not.toBe(comparisonWithinGrade.id)
    expect(copiedWithinGrade.comparedGradeItem.gradeId).toBe(copy.id)
    expect(copiedWithinGrade.exportSelections).toEqual([])
    // 複製元の選択はそのまま
    expect(await getExportComparisons(secondTerm.id)).toHaveLength(1)
  })

  it("成績算出を消すと選択も消える", async () => {
    const { secondTerm, comparisonWithFirstTerm } = await createComparedGrades()
    await setExportComparison({
      gradeId: secondTerm.id,
      gradeComparisonId: comparisonWithFirstTerm.id,
      enabled: false,
    })

    await prisma.grade.delete({ where: { id: secondTerm.id } })

    expect(await prisma.gradeExportComparison.count()).toBe(0)
  })
})
