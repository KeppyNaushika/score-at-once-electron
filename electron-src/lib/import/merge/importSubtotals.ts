/**
 * ID統合インポート: 小計（Subtotal）と設問-小計紐づけ（CropSubtotal）の処理
 *
 * 小計は「明示マッピング」「__new__（新規強制）」「名前ベース自動マッチ」の順で解決する。
 * グループがスキップされた配下の小計・関連データ欠落の紐づけは警告として集約する。
 */

import * as crypto from "crypto"

import type { ExtractedArchiveData } from "../exam-archive/archiveExtractor"
import type { ImportValuePolicy } from "./importValuePolicy"
import { replacementUpdatedAt } from "./importValuePolicy"
import type { IdMappings, PrismaTransaction } from "./types"

export async function processSubtotals(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  warnings: string[],
  policy: ImportValuePolicy,
  tx: PrismaTransaction,
  subtotalMappings?: Record<string, string>
): Promise<{ groupIdsWithNewSubtotal: Set<string> }> {
  // スキップされた小計をグループ別に集計
  const skippedByGroup: Record<string, string[]> = {}
  // 行が増えたグループだけ、あとで並び順を詰め直す
  const groupIdsWithNewSubtotal = new Set<string>()

  for (const subtotal of data.subtotalsData.subtotals) {
    const newGroupId = idMappings.subtotalGroup[subtotal.subtotalGroupId]
    if (!newGroupId) {
      // グループがスキップされた → 配下の小計もスキップ
      const groupName =
        data.subtotalsData.subtotalGroups.find(
          (subtotalGroup) => subtotalGroup.id === subtotal.subtotalGroupId
        )?.name ?? subtotal.subtotalGroupId
      if (!skippedByGroup[groupName]) skippedByGroup[groupName] = []
      skippedByGroup[groupName].push(subtotal.name)
      continue
    }

    // 1. 明示的なマッピングがあれば使う
    const explicitTarget = subtotalMappings?.[subtotal.id]
    if (explicitTarget && explicitTarget !== "__new__") {
      // 既存の小計項目に直接結びつけ
      idMappings.subtotal[subtotal.id] = explicitTarget
      continue
    }

    // 2. "__new__" の場合は新規作成を強制
    if (explicitTarget === "__new__") {
      await createNewSubtotal(subtotal, newGroupId, idMappings, policy, tx)
      groupIdsWithNewSubtotal.add(newGroupId)
      continue
    }

    // 3. マッピング未設定（デフォルト動作: 従来の名前ベース自動マッチ）
    const existing = await tx.subtotal.findFirst({
      where: { subtotalGroupId: newGroupId, name: subtotal.name },
    })

    const existingSubtotal =
      existing ?? (await tx.subtotal.findUnique({ where: { id: subtotal.id } }))

    if (existingSubtotal) {
      idMappings.subtotal[subtotal.id] = existingSubtotal.id
      const updatedAt = replacementUpdatedAt(
        policy,
        subtotal.updatedAt,
        existingSubtotal.updatedAt
      )
      if (updatedAt) {
        await tx.subtotal.update({
          where: { id: existingSubtotal.id },
          data: {
            name: subtotal.name,
            // 並び順は取り込みの最後に詰め直す（reorderAfterImport）
            order: subtotal.order,
            updatedAt,
          },
        })
      }
    } else {
      await tx.subtotal.create({
        data: {
          id: subtotal.id,
          name: subtotal.name,
          subtotalGroupId: newGroupId,
          order: subtotal.order,
          ...policy.createdTimestamps(subtotal),
        },
      })
      idMappings.subtotal[subtotal.id] = subtotal.id
      groupIdsWithNewSubtotal.add(newGroupId)
    }
  }

  // スキップされた小計の警告を出力
  for (const [groupName, subtotalNames] of Object.entries(skippedByGroup)) {
    warnings.push(
      `小計グループ「${groupName}」がスキップされたため、配下の小計項目（${subtotalNames.join("、")}）もスキップされました`
    )
  }

  return { groupIdsWithNewSubtotal }
}

/**
 * 小計項目を新規作成（名前重複時はサフィックス付き）
 */
async function createNewSubtotal(
  subtotal: ExtractedArchiveData["subtotalsData"]["subtotals"][0],
  newGroupId: string,
  idMappings: IdMappings,
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<void> {
  // 同名の小計が既にあるかチェック
  const existingWithName = await tx.subtotal.findFirst({
    where: { subtotalGroupId: newGroupId, name: subtotal.name },
  })

  let finalName = subtotal.name
  if (existingWithName) {
    // サフィックス付きで新規作成
    for (let i = 2; i <= 100; i++) {
      const candidate = `${subtotal.name} (${i})`
      const dup = await tx.subtotal.findFirst({
        where: { subtotalGroupId: newGroupId, name: candidate },
      })
      if (!dup) {
        finalName = candidate
        break
      }
    }
  }

  const existingById = await tx.subtotal.findUnique({
    where: { id: subtotal.id },
  })
  const newId = existingById ? crypto.randomUUID() : subtotal.id

  await tx.subtotal.create({
    data: {
      id: newId,
      name: finalName,
      subtotalGroupId: newGroupId,
      order: subtotal.order,
      ...policy.createdTimestamps(subtotal),
    },
  })
  idMappings.subtotal[subtotal.id] = newId
}

export async function processCropSubtotals(
  data: ExtractedArchiveData,
  isExamIdMatch: boolean,
  idMappings: IdMappings,
  warnings: string[],
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<void> {
  let skippedCount = 0

  for (const cropSubtotal of data.subtotalsData.cropSubtotals) {
    const newRegionId = idMappings.cropRegion[cropSubtotal.cropRegionId]
    const newSubtotalId = idMappings.subtotal[cropSubtotal.subtotalId]
    if (newRegionId && newSubtotalId) {
      if (isExamIdMatch) {
        const existing = await tx.cropSubtotal.findFirst({
          where: { cropRegionId: newRegionId, subtotalId: newSubtotalId },
        })
        if (existing) {
          idMappings.cropSubtotal[cropSubtotal.id] = existing.id
          continue
        }
      }

      const existingById = await tx.cropSubtotal.findUnique({
        where: { id: cropSubtotal.id },
      })
      if (existingById) {
        idMappings.cropSubtotal[cropSubtotal.id] = cropSubtotal.id
        const updatedAt = replacementUpdatedAt(
          policy,
          cropSubtotal.updatedAt,
          existingById.updatedAt
        )
        if (updatedAt) {
          await tx.cropSubtotal.update({
            where: { id: existingById.id },
            data: {
              assignmentType: cropSubtotal.assignmentType,
              updatedAt,
            },
          })
        }
      } else {
        await tx.cropSubtotal.create({
          data: {
            id: cropSubtotal.id,
            cropRegionId: newRegionId,
            subtotalId: newSubtotalId,
            assignmentType: cropSubtotal.assignmentType,
            ...policy.createdTimestamps(cropSubtotal),
          },
        })
        idMappings.cropSubtotal[cropSubtotal.id] = cropSubtotal.id
      }
    } else {
      skippedCount++
    }
  }

  if (skippedCount > 0) {
    warnings.push(
      `${skippedCount}件の設問-小計の紐づけがスキップされました（関連データがインポートされなかったため）`
    )
  }
}
