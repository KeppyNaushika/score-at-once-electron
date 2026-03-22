/**
 * 小計グループマッチングロジック
 */

import type {
  ImportItem,
  MatchedItem,
  PreMatchingResult,
  SubtotalGroupMatchingMethod,
  SubtotalInfo,
} from "../../../../../src/types/examArchive.types"
import prisma from "../../../prisma/client"
import type { ExtractedArchiveData } from "../../exam-archive/archiveExtractor"
import type { MatchResult, SubtotalGroupData } from "./types"

/**
 * 小計グループデータのマッチングを実行
 *
 * 照合の流れ:
 * 1. まずUUIDで照合
 * 2. UUIDが一致しない場合、methodで指定された二次照合を実行
 */
export async function matchSubtotalGroups(
  importData: ExtractedArchiveData,
  method: SubtotalGroupMatchingMethod
): Promise<MatchResult<SubtotalGroupData>[]> {
  const results: MatchResult<SubtotalGroupData>[] = []

  const existingGroups = await prisma.subtotalGroup.findMany()

  for (const importGroup of importData.subtotalsData.subtotalGroups) {
    let matchedGroup: (typeof existingGroups)[0] | null = null
    let isExactMatch = false

    // Step 1: UUIDで照合
    const uuidMatch = existingGroups.find((g) => g.id === importGroup.id)
    if (uuidMatch) {
      matchedGroup = uuidMatch
      isExactMatch = true
    }

    // Step 2: UUIDが一致しない場合、二次照合を実行
    if (!matchedGroup && method !== "none") {
      switch (method) {
        case "name":
          matchedGroup =
            existingGroups.find((g) => g.name === importGroup.name) ?? null
          break
      }
    }

    results.push({
      importData: {
        id: importGroup.id,
        name: importGroup.name,
        updatedAt: importGroup.updatedAt,
      },
      existingData: matchedGroup
        ? {
            id: matchedGroup.id,
            name: matchedGroup.name,
            updatedAt: matchedGroup.updatedAt,
          }
        : null,
      matchType: matchedGroup ? (isExactMatch ? "exact" : "fuzzy") : "new",
    })
  }

  return results
}

/**
 * 小計グループの事前照合
 */
export async function preMatchSubtotalGroups(
  importData: ExtractedArchiveData
): Promise<PreMatchingResult> {
  const existingGroups = await prisma.subtotalGroup.findMany()

  const byId: MatchedItem[] = []
  const byName: MatchedItem[] = []
  const noMatch: ImportItem[] = []

  const existingById = new Map(existingGroups.map((g) => [g.id, g]))
  const existingByName = new Map(existingGroups.map((g) => [g.name, g]))

  // インポートデータからグループ別にSubtotalを収集
  const importSubtotalsByGroup = buildImportSubtotalsByGroup(importData)

  // 既存グループのSubtotal一覧を一括取得
  const existingGroupIds = existingGroups.map((g) => g.id)
  const existingSubtotals =
    existingGroupIds.length > 0
      ? await prisma.subtotal.findMany({
          where: { subtotalGroupId: { in: existingGroupIds } },
          orderBy: { order: "asc" },
        })
      : []
  const existingSubtotalsByGroup = new Map<string, SubtotalInfo[]>()
  for (const s of existingSubtotals) {
    const list = existingSubtotalsByGroup.get(s.subtotalGroupId) ?? []
    list.push({ id: s.id, name: s.name, order: s.order })
    existingSubtotalsByGroup.set(s.subtotalGroupId, list)
  }

  for (const importGroup of importData.subtotalsData.subtotalGroups) {
    const displayLabel = importGroup.name
    const importSubs = importSubtotalsByGroup.get(importGroup.id)

    // ID照合
    const idMatch = existingById.get(importGroup.id)
    if (idMatch) {
      byId.push({
        importId: importGroup.id,
        existingId: idMatch.id,
        importData: importGroup,
        existingData: idMatch,
        displayLabel,
        matchReason: "同じパソコンで作成されたデータ",
        additionalInfo: {
          importSubtotals: importSubs,
          existingSubtotals: existingSubtotalsByGroup.get(idMatch.id),
        },
      })
      continue
    }

    // 名前照合
    const nameMatch = existingByName.get(importGroup.name)
    if (nameMatch) {
      byName.push({
        importId: importGroup.id,
        existingId: nameMatch.id,
        importData: importGroup,
        existingData: nameMatch,
        displayLabel,
        matchReason: "グループ名が一致",
        additionalInfo: {
          importSubtotals: importSubs,
          existingSubtotals: existingSubtotalsByGroup.get(nameMatch.id),
        },
      })
      continue
    }

    noMatch.push({
      importId: importGroup.id,
      importData: importGroup,
      displayLabel,
      additionalInfo: {
        importSubtotals: importSubs,
      },
    })
  }

  // 全既存グループ情報を返す（手動紐づけ用）
  const allExistingItems = existingGroups.map((g) => ({
    id: g.id,
    name: g.name,
    subtotals: existingSubtotalsByGroup.get(g.id),
  }))

  return {
    byId,
    byName,
    noMatch,
    allExistingItems,
  }
}

/**
 * インポートデータからグループ別にSubtotal情報をマップに変換
 */
function buildImportSubtotalsByGroup(
  importData: ExtractedArchiveData
): Map<string, SubtotalInfo[]> {
  const map = new Map<string, SubtotalInfo[]>()
  for (const s of importData.subtotalsData.subtotals) {
    const list = map.get(s.subtotalGroupId) ?? []
    list.push({ id: s.id, name: s.name, order: s.order })
    map.set(s.subtotalGroupId, list)
  }
  // order順にソート
  for (const list of map.values()) {
    list.sort((a, b) => a.order - b.order)
  }
  return map
}
