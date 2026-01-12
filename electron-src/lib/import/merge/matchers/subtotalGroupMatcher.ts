/**
 * 小計グループマッチングロジック
 */

import type {
  ImportItem,
  MatchedItem,
  PreMatchingResult,
  SubtotalGroupMatchingMethod,
} from "../../../../../types/projectArchive.types"
import prisma from "../../../prisma/client"
import type { ExtractedArchiveData } from "../../project-archive/archiveExtractor"
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

  for (const importGroup of importData.subtotalsData.subtotalGroups) {
    const displayLabel = importGroup.name
    const importItem: ImportItem = {
      importId: importGroup.id,
      importData: importGroup as unknown as Record<string, unknown>,
      displayLabel,
    }

    // ID照合
    const idMatch = existingById.get(importGroup.id)
    if (idMatch) {
      byId.push({
        importId: importGroup.id,
        existingId: idMatch.id,
        importData: importGroup as unknown as Record<string, unknown>,
        existingData: idMatch as unknown as Record<string, unknown>,
        displayLabel,
        matchReason: "同じパソコンで作成されたデータ",
      })
      continue
    }

    // 名前照合
    const nameMatch = existingByName.get(importGroup.name)
    if (nameMatch) {
      byName.push({
        importId: importGroup.id,
        existingId: nameMatch.id,
        importData: importGroup as unknown as Record<string, unknown>,
        existingData: nameMatch as unknown as Record<string, unknown>,
        displayLabel,
        matchReason: "グループ名が一致",
      })
      continue
    }

    noMatch.push(importItem)
  }

  return {
    byId,
    byName,
    noMatch,
  }
}
