/**
 * 小計グループマッチングロジック
 */

import type {
  ImportItem,
  MatchedItem,
  PreMatchingResult,
  SubtotalInfo,
} from "../../../../../src/types/examArchive.types"
import prisma from "../../../prisma/client"
import type { ExtractedArchiveData } from "../../exam-archive/archiveExtractor"

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

  const existingById = new Map(existingGroups.map((group) => [group.id, group]))
  const existingByName = new Map(
    existingGroups.map((group) => [group.name, group])
  )

  // インポートデータからグループ別にSubtotalを収集
  const importSubtotalsByGroup = buildImportSubtotalsByGroup(importData)

  // 既存グループのSubtotal一覧を一括取得
  const existingGroupIds = existingGroups.map((group) => group.id)
  const existingSubtotals =
    existingGroupIds.length > 0
      ? await prisma.subtotal.findMany({
          where: { subtotalGroupId: { in: existingGroupIds } },
          orderBy: { order: "asc" },
        })
      : []
  const existingSubtotalsByGroup = new Map<string, SubtotalInfo[]>()
  for (const subtotal of existingSubtotals) {
    const list = existingSubtotalsByGroup.get(subtotal.subtotalGroupId) ?? []
    list.push({ id: subtotal.id, name: subtotal.name, order: subtotal.order })
    existingSubtotalsByGroup.set(subtotal.subtotalGroupId, list)
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
  const allExistingItems = existingGroups.map((group) => ({
    id: group.id,
    name: group.name,
    subtotals: existingSubtotalsByGroup.get(group.id),
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
  for (const subtotal of importData.subtotalsData.subtotals) {
    const list = map.get(subtotal.subtotalGroupId) ?? []
    list.push({ id: subtotal.id, name: subtotal.name, order: subtotal.order })
    map.set(subtotal.subtotalGroupId, list)
  }
  // order順にソート
  for (const list of map.values()) {
    list.sort((subtotalA, subtotalB) => subtotalA.order - subtotalB.order)
  }
  return map
}
