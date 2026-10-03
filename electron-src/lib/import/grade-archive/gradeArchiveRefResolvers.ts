/**
 * 成績算出アーカイブの外部参照（小計・採点領域・資料）を、取り込み先の実 id へ解決する。
 *
 * どれもアーカイブに含まれない実体なので作れない。uuid 一次 → 名前・ラベル二次で
 * 既存へ当て、当たらなければマップに入れない（参照している行の側で落とす・外す）。
 */

import type { Prisma } from "@prisma/client"

import type { GradeChainTransformResult } from "../grade-transformers/types"
import { describeAmbiguity, pickOldest } from "../humanKeyMatching"

/** アーカイブ内 uuid → 取り込み先の実 id */
export type IdMap = Map<string, string>

/** 現行の版へ正規化した成績算出アーカイブ */
export type LatestGradeArchiveData = GradeChainTransformResult["data"]

/**
 * 小計を当てる（uuid 一次、当該試験内の名前二次）。名前は試験の中でも一意ではない
 * （小計名の `@@unique` は 2026-08-23 に外した）ので、名前で複数当たったら
 * いちばん古い行を採り、件数を伝える
 */
export async function resolveSubtotalIds(
  tx: Prisma.TransactionClient,
  archive: LatestGradeArchiveData,
  examIdMap: IdMap,
  warnings: string[]
): Promise<IdMap> {
  const subtotalIdMap: IdMap = new Map()
  for (const subtotalRef of archive.subtotalRefs) {
    const byId = await tx.subtotal.findUnique({
      where: { id: subtotalRef.id },
    })
    if (byId) {
      subtotalIdMap.set(subtotalRef.id, byId.id)
      continue
    }
    const examId = examIdMap.get(subtotalRef.examId)
    if (!examId) continue
    const sameNameSubtotals = await tx.subtotal.findMany({
      where: {
        name: subtotalRef.name,
        subtotalGroup: { examSubtotalGroups: { some: { examId } } },
      },
    })
    const byName = pickOldest(sameNameSubtotals)
    if (!byName) continue
    subtotalIdMap.set(subtotalRef.id, byName.id)
    const ambiguity = describeAmbiguity(
      `小計「${subtotalRef.name}」`,
      sameNameSubtotals.length,
      `作成 ${byName.createdAt.toISOString().slice(0, 10)}`
    )
    if (ambiguity) warnings.push(ambiguity)
  }
  return subtotalIdMap
}

/** 採点領域を当てる（uuid 一次、当該試験内のラベル二次） */
export async function resolveCropRegionIds(
  tx: Prisma.TransactionClient,
  archive: LatestGradeArchiveData,
  examIdMap: IdMap
): Promise<IdMap> {
  const cropRegionIdMap: IdMap = new Map()
  for (const cropRegionRef of archive.cropRegionRefs) {
    const byId = await tx.cropRegion.findUnique({
      where: { id: cropRegionRef.id },
    })
    if (byId) {
      cropRegionIdMap.set(cropRegionRef.id, byId.id)
      continue
    }
    const examId = examIdMap.get(cropRegionRef.examId)
    if (!examId) continue
    const byLabel = await tx.cropRegion.findFirst({
      where: { label: cropRegionRef.label, examPage: { examId } },
    })
    if (byLabel) cropRegionIdMap.set(cropRegionRef.id, byLabel.id)
  }
  return cropRegionIdMap
}

/**
 * 資料そのものを当てる（coursework_total 型の参照解決用）。
 *
 * @param courseworkItemIdMap 内包資料の取り込みで決まった評価項目の対応
 */
export async function resolveCourseworkIds(
  tx: Prisma.TransactionClient,
  archive: LatestGradeArchiveData,
  courseworkItemIdMap: IdMap
): Promise<IdMap> {
  // 資料そのものの参照（coursework_total 型）は資料を直接引いて解決する。
  // 評価項目経由でしか作らないと、評価項目が0件の資料への参照が
  // 取り込み先に実在していても解決できず「参照なし」で作られてしまう。
  /** アーカイブ資料uuid → 実 Coursework.id（coursework_total 型の参照解決用） */
  const courseworkIdMap: IdMap = new Map()
  for (const archiveCoursework of archive.courseworkArchive.courseworks) {
    const byId = await tx.coursework.findUnique({
      where: { id: archiveCoursework.id },
    })
    if (byId) {
      courseworkIdMap.set(archiveCoursework.id, byId.id)
      continue
    }
    const byName = await tx.coursework.findFirst({
      where: { name: archiveCoursework.name },
    })
    if (byName) courseworkIdMap.set(archiveCoursework.id, byName.id)
  }
  // 評価項目から親を辿れるものは、そちらの結果を優先する
  // （ユーザーがウィザードで別の資料へ寄せた場合に追従する）
  for (const [archiveItemId, actualItemId] of courseworkItemIdMap) {
    const archiveItem = archive.courseworkArchive.courseworkItems.find(
      (item) => item.id === archiveItemId
    )
    if (!archiveItem) continue
    const actualItem = await tx.courseworkItem.findUnique({
      where: { id: actualItemId },
    })
    if (actualItem) {
      courseworkIdMap.set(archiveItem.courseworkId, actualItem.courseworkId)
    }
  }
  return courseworkIdMap
}
