/**
 * importSubtotals（小計の取り込み）の統合テスト
 *
 * テスト対象: electron-src/lib/import/merge/importSubtotals.ts
 * 実際のSQLiteテスト用DBを使用
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import { createEmptyIdMappings } from "../../../electron-src/lib/import/merge/types"
import {
  createArchiveSubtotalsData,
  createExtractedArchiveData,
  generateId,
} from "../../helpers/testDataFactory"
import {
  cleanupTestDatabase,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../../helpers/testPrismaClient"

vi.mock("../../../electron-src/lib/prisma/client", () => {
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

import { processSubtotals } from "../../../electron-src/lib/import/merge/importSubtotals"
import { createImportValuePolicy } from "../../../electron-src/lib/import/merge/importValuePolicy"

const prisma = getTestPrismaClient()

describe("processSubtotals", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  it("新規作成を選んだ小計は、同じグループに同名があっても名前を変えずにアーカイブの id で作る", async () => {
    const groupId = generateId()
    const existingSubtotalId = generateId()
    const importSubtotalId = generateId()

    await prisma.subtotalGroup.create({
      data: { id: groupId, name: "グループ" },
    })
    await prisma.subtotal.create({
      data: {
        id: existingSubtotalId,
        name: "前半",
        subtotalGroupId: groupId,
        order: 0,
      },
    })

    const data = createExtractedArchiveData({
      subtotalsData: createArchiveSubtotalsData([
        {
          id: groupId,
          name: "グループ",
          subtotals: [{ id: importSubtotalId, name: "前半" }],
        },
      ]),
    })
    const idMappings = createEmptyIdMappings()
    idMappings.subtotalGroup[groupId] = groupId
    const warnings: string[] = []

    await prisma.$transaction(async (tx) => {
      await processSubtotals(
        data,
        idMappings,
        warnings,
        createImportValuePolicy("merge"),
        tx,
        { [importSubtotalId]: "__new__" }
      )
    })

    expect(idMappings.subtotal[importSubtotalId]).toBe(importSubtotalId)
    // 同じ名前の小計が2つ並ぶ（既存は書き換えない）
    const sameName = await prisma.subtotal.findMany({
      where: { subtotalGroupId: groupId, name: "前半" },
    })
    expect(sameName.map((subtotal) => subtotal.id).sort()).toEqual(
      [existingSubtotalId, importSubtotalId].sort()
    )
  })
})
