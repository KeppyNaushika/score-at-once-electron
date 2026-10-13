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
import { describeCandidateCount, groupByHumanKey } from "../../humanKeyMatching"

/**
 * 小計グループの事前照合
 *
 * - 取り込み先に同じ id のグループがあれば、それが同じグループ（byId）。照合はしない
 * - id で一致しなかったグループは、グループ名で既存のグループを引く。候補からは、別の
 *   アーカイブのグループが id で取った既存のグループを除く
 */
export async function preMatchSubtotalGroups(
  importData: ExtractedArchiveData
): Promise<PreMatchingResult> {
  // 使っている試験は、同じ名前のグループを見分けるため
  const existingGroups = await prisma.subtotalGroup.findMany({
    include: { examSubtotalGroups: { include: { exam: true } } },
  })
  const importGroups = importData.subtotalsData.subtotalGroups
  const importGroupIds = new Set(importGroups.map((group) => group.id))

  const byId: MatchedItem[] = []
  const byName: MatchedItem[] = []
  const noMatch: ImportItem[] = []

  const existingById = new Map(existingGroups.map((group) => [group.id, group]))
  // グループ名は unique ではないので、名前で引くと複数当たりうる。候補は
  // humanKeyMatching の決まりで古い順に並び、先頭を既定の結び付け先にする
  const claimableGroups = existingGroups.filter(
    (group) => !importGroupIds.has(group.id)
  )
  const existingByName = groupByHumanKey(claimableGroups, (group) => group.name)

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
    list.push({
      id: subtotal.id,
      name: subtotal.name,
      order: subtotal.order,
      createdAt: subtotal.createdAt.toISOString(),
    })
    existingSubtotalsByGroup.set(subtotal.subtotalGroupId, list)
  }

  for (const importGroup of importGroups) {
    const displayLabel = importGroup.name
    const importSubs = importSubtotalsByGroup.get(importGroup.id)

    const idMatch = existingById.get(importGroup.id)
    if (idMatch) {
      byId.push({
        importId: importGroup.id,
        existingId: idMatch.id,
        importData: importGroup,
        existingData: idMatch,
        candidates: [{ existingId: idMatch.id, existingData: idMatch }],
        displayLabel,
        matchReason: "同じPCで作成されたデータ",
        additionalInfo: {
          importSubtotals: importSubs,
          existingSubtotals: existingSubtotalsByGroup.get(idMatch.id),
        },
      })
      continue
    }

    const nameCandidates = existingByName.get(importGroup.name) ?? []
    if (nameCandidates.length > 0) {
      byName.push({
        importId: importGroup.id,
        existingId: nameCandidates[0].id,
        importData: importGroup,
        existingData: nameCandidates[0],
        candidates: nameCandidates.map((candidate) => ({
          existingId: candidate.id,
          existingData: candidate,
        })),
        displayLabel,
        matchReason: describeCandidateCount(
          "グループ名が一致",
          nameCandidates.length
        ),
        additionalInfo: {
          importSubtotals: importSubs,
          existingSubtotals: existingSubtotalsByGroup.get(nameCandidates[0].id),
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

  return {
    byId,
    byName,
    noMatch,
    // 手で紐づけるときの選択肢
    allExistingItems: claimableGroups.map((group) => ({
      id: group.id,
      existingData: group,
      subtotals: existingSubtotalsByGroup.get(group.id),
    })),
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
    list.push({
      id: subtotal.id,
      name: subtotal.name,
      order: subtotal.order,
      createdAt: subtotal.createdAt,
    })
    map.set(subtotal.subtotalGroupId, list)
  }
  // order順にソート
  for (const list of map.values()) {
    list.sort((subtotalA, subtotalB) => subtotalA.order - subtotalB.order)
  }
  return map
}
