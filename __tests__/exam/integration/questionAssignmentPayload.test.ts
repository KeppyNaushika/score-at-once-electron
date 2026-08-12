/**
 * 設問割り当ての供給形の統合テスト
 *
 * 割り当ては用途で2つに分かれる。
 *
 * - 04 設問グループの割り当てマトリクス: どの小計に紐づくか（subtotalId）だけを読む。
 *   割り当ては採点領域に同梱されて届くので、領域ごとの追加クエリを立てない
 * - 小計点の算出: 各小計の設問割り当てを辿る必要があり、グラフごと要る
 *
 * 同じ include を共有すると前者が後者の都合を払う。分かれていることを固定する。
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

import { getCropRegionsByExamId } from "@/electron-src/lib/prisma/cropRegion"
import { getCropSubtotalsForScoring } from "@/electron-src/lib/prisma/cropSubtotal"
import { getActiveSubtotalGroupsForExam } from "@/electron-src/lib/prisma/subtotalGroup"

import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

/** 既存の割り当てを消してから、全設問を1つの小計へ割り当て直す */
async function assignQuestions(subtotalId: string, cropRegionIds: string[]) {
  await testPrisma.cropSubtotal.deleteMany({
    where: { cropRegionId: { in: cropRegionIds } },
  })
  for (const cropRegionId of cropRegionIds) {
    await testPrisma.cropSubtotal.create({
      data: {
        id: crypto.randomUUID(),
        cropRegionId,
        subtotalId,
        assignmentType: "QUESTION_ASSIGNMENT",
      },
    })
  }
}

describe("設問割り当ての供給形", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  it("04 の割り当ては採点領域に同梱されて届き、割り当てグラフは含まない", async () => {
    const fixture = await createFullTestExam(testPrisma, {})
    const [subtotal] = fixture.subtotals
    const cropRegionIds = fixture.cropRegions.map((cropRegion) => cropRegion.id)
    await assignQuestions(subtotal.id, cropRegionIds)

    const cropRegions = await getCropRegionsByExamId(fixture.exam.id)

    const assigned = cropRegions.filter(
      (cropRegion) => cropRegion.cropSubtotals.length > 0
    )
    expect(assigned.length).toBe(cropRegionIds.length)
    for (const cropRegion of assigned) {
      for (const cropSubtotal of cropRegion.cropSubtotals) {
        // 04 が読むのはこの2つだけ（種類で絞って subtotalId を集める）
        expect(cropSubtotal.assignmentType).toBe("QUESTION_ASSIGNMENT")
        expect(typeof cropSubtotal.subtotalId).toBe("string")
        // 採点用の割り当てグラフは 04 へ送らない
        expect(
          (cropSubtotal.subtotal as unknown as Record<string, unknown>)
            .cropSubtotals
        ).toBeUndefined()
      }
    }
  })

  it("小計点の算出は割り当てを設問領域と所属試験ごと受け取る", async () => {
    const fixture = await createFullTestExam(testPrisma, {})
    const [subtotal] = fixture.subtotals
    const cropRegionIds = fixture.cropRegions.map((cropRegion) => cropRegion.id)
    await assignQuestions(subtotal.id, cropRegionIds)

    const cropSubtotals = await getCropSubtotalsForScoring(cropRegionIds[0])

    const target = cropSubtotals.find(
      (cropSubtotal) => cropSubtotal.subtotalId === subtotal.id
    )
    expect(target).toBeDefined()
    expect(target!.subtotal.cropSubtotals.length).toBe(cropRegionIds.length)
    for (const assignment of target!.subtotal.cropSubtotals) {
      // 配点も所属試験もこの行から読める（追加クエリを立てない）
      expect(assignment.cropRegion.points).toBe(10)
      expect(assignment.cropRegion.examPage.examId).toBe(fixture.exam.id)
    }
  })

  it("試験の小計グループは各小計に割り当てを同梱して返す", async () => {
    const fixture = await createFullTestExam(testPrisma, {})
    const [subtotal] = fixture.subtotals
    const cropRegionIds = fixture.cropRegions.map((cropRegion) => cropRegion.id)
    await assignQuestions(subtotal.id, cropRegionIds)

    const result = await getActiveSubtotalGroupsForExam(fixture.exam.id)

    const subtotals = result.flatMap(
      (examSubtotalGroup) => examSubtotalGroup.subtotalGroup.subtotals
    )
    const target = subtotals.find((candidate) => candidate.id === subtotal.id)
    expect(target).toBeDefined()
    expect(target!.cropSubtotals.length).toBe(cropRegionIds.length)

    // 割り当てを持たない小計は空配列（undefined ではない）
    for (const other of subtotals.filter(
      (candidate) => candidate.id !== subtotal.id
    )) {
      expect(other.cropSubtotals).toEqual([])
    }
  })

  it("QUESTION_ASSIGNMENT 以外の紐付けは割り当てに数えない", async () => {
    const fixture = await createFullTestExam(testPrisma, {})
    // 小計点領域の定義（SUBTOTAL_DEFINITION）は設問の割り当てではない
    await testPrisma.cropSubtotal.updateMany({
      data: { assignmentType: "SUBTOTAL_DEFINITION" },
    })

    const result = await getActiveSubtotalGroupsForExam(fixture.exam.id)

    const subtotals = result.flatMap(
      (examSubtotalGroup) => examSubtotalGroup.subtotalGroup.subtotals
    )
    for (const subtotal of subtotals) {
      expect(subtotal.cropSubtotals).toEqual([])
    }
  })
})
