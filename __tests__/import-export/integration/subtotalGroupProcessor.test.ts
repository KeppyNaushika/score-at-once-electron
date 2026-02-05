/**
 * subtotalGroupProcessor の統合テスト
 *
 * テスト対象: electron-src/lib/import/merge/processors/subtotalGroupProcessor.ts
 * 実際のSQLiteテスト用DBを使用
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import type { IdChangeTarget } from "../../../electron-src/lib/import/merge/types"
import {
  createArchiveSubtotalsData,
  createDecision,
  createEmptyIdMappings,
  createEmptyImportCounts,
  createExtractedArchiveData,
  createFileOverviewData,
  createMatchedItem,
  createPreMatchingResult,
  generateId,
} from "../../helpers/testDataFactory"
import {
  cleanupTestDatabase,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../../helpers/testPrismaClient"

// Prismaクライアントのモック
vi.mock("../../../electron-src/lib/prisma/client", () => {
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

import { processSubtotalGroupIdIntegration } from "../../../electron-src/lib/import/merge/processors/subtotalGroupProcessor"

const prisma = getTestPrismaClient()

describe("processSubtotalGroupIdIntegration", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  // SG-1: ID一致: 既存にマッピング
  it("SG-1: ID一致時に既存データへマッピングされる", async () => {
    const groupId = generateId()

    await prisma.subtotalGroup.create({
      data: { id: groupId, name: "既存グループ" },
    })

    const data = createExtractedArchiveData({
      subtotalsData: createArchiveSubtotalsData([
        { id: groupId, name: "既存グループ" },
      ]),
    })

    const preMatch = createFileOverviewData({
      subtotalGroup: createPreMatchingResult({
        byId: [
          createMatchedItem({
            importId: groupId,
            existingId: groupId,
          }),
        ],
      }),
    })

    const idMappings = createEmptyIdMappings()
    const counts = createEmptyImportCounts()
    const warnings: string[] = []
    const idChangeTargets: IdChangeTarget[] = []

    await prisma.$transaction(async (tx) => {
      await processSubtotalGroupIdIntegration(
        data,
        preMatch,
        { strategy: "by_name", decisions: [] },
        idMappings,
        idChangeTargets,
        counts,
        warnings,
        tx
      )
    })

    expect(idMappings.subtotalGroup[groupId]).toBe(groupId)
  })

  // SG-2: 名前一致: 既存にマッピング
  it("SG-2: 名前一致時に既存データへマッピングされる", async () => {
    const existingId = generateId()
    const importId = generateId()
    const groupName = `名前一致G_${Date.now()}`

    await prisma.subtotalGroup.create({
      data: { id: existingId, name: groupName },
    })

    const data = createExtractedArchiveData({
      subtotalsData: createArchiveSubtotalsData([
        { id: importId, name: groupName },
      ]),
    })

    const preMatch = createFileOverviewData({
      subtotalGroup: createPreMatchingResult({
        byName: [
          createMatchedItem({
            importId,
            existingId,
          }),
        ],
      }),
    })

    const idMappings = createEmptyIdMappings()
    const counts = createEmptyImportCounts()
    const warnings: string[] = []
    const idChangeTargets: IdChangeTarget[] = []

    await prisma.$transaction(async (tx) => {
      await processSubtotalGroupIdIntegration(
        data,
        preMatch,
        { strategy: "by_name", decisions: [] },
        idMappings,
        idChangeTargets,
        counts,
        warnings,
        tx
      )
    })

    expect(idMappings.subtotalGroup[importId]).toBe(existingId)
  })

  // SG-3: マッチなし+create_new: 新規作成
  it("SG-3: マッチなしでcreate_new時に新規グループが作成される", async () => {
    const importId = generateId()
    const groupName = `新規G_${Date.now()}`

    const data = createExtractedArchiveData({
      subtotalsData: createArchiveSubtotalsData([
        { id: importId, name: groupName },
      ]),
    })

    const preMatch = createFileOverviewData({
      subtotalGroup: createPreMatchingResult({
        noMatch: [
          {
            importId,
            importData: { name: groupName },
            displayLabel: groupName,
          },
        ],
      }),
    })

    const idMappings = createEmptyIdMappings()
    const counts = createEmptyImportCounts()
    const warnings: string[] = []
    const idChangeTargets: IdChangeTarget[] = []

    await prisma.$transaction(async (tx) => {
      await processSubtotalGroupIdIntegration(
        data,
        preMatch,
        {
          strategy: "all_new",
          decisions: [
            createDecision({
              importId,
              decisionType: "create_new",
            }),
          ],
        },
        idMappings,
        idChangeTargets,
        counts,
        warnings,
        tx
      )
    })

    expect(idMappings.subtotalGroup[importId]).toBe(importId)
    expect(counts.created.subtotalGroups).toBe(1)

    // DBに存在確認
    const created = await prisma.subtotalGroup.findUnique({
      where: { id: importId },
    })
    expect(created).not.toBeNull()
    expect(created!.name).toBe(groupName)
  })

  // SG-4: use_import_id: ID変更ターゲット追加
  it("SG-4: use_import_id選択時にidChangeTargetに追加される", async () => {
    const existingId = generateId()
    const importId = generateId()
    const groupName = `ID変更G_${Date.now()}`

    await prisma.subtotalGroup.create({
      data: { id: existingId, name: groupName },
    })

    const data = createExtractedArchiveData({
      subtotalsData: createArchiveSubtotalsData([
        { id: importId, name: groupName },
      ]),
    })

    const preMatch = createFileOverviewData({
      subtotalGroup: createPreMatchingResult({
        byName: [
          createMatchedItem({
            importId,
            existingId,
          }),
        ],
      }),
    })

    const idMappings = createEmptyIdMappings()
    const counts = createEmptyImportCounts()
    const warnings: string[] = []
    const idChangeTargets: IdChangeTarget[] = []

    await prisma.$transaction(async (tx) => {
      await processSubtotalGroupIdIntegration(
        data,
        preMatch,
        {
          strategy: "by_name",
          decisions: [
            createDecision({
              importId,
              decisionType: "same_person",
              existingId,
              idChoice: "use_import_id",
            }),
          ],
        },
        idMappings,
        idChangeTargets,
        counts,
        warnings,
        tx
      )
    })

    expect(idMappings.subtotalGroup[importId]).toBe(existingId)
    expect(idChangeTargets.length).toBe(1)
    expect(idChangeTargets[0].category).toBe("subtotalGroup")
    expect(idChangeTargets[0].existingId).toBe(existingId)
    expect(idChangeTargets[0].newId).toBe(importId)
  })
})
