/**
 * ID統合インポート: 小計（Subtotal）と設問-小計紐づけ（CropSubtotal）の処理
 *
 * 小計は「明示マッピング」「__new__（新規強制）」「名前ベース自動マッチ」の順で解決する。
 * グループがスキップされた配下の小計・関連データ欠落の紐づけは警告として集約する。
 */

import * as crypto from "crypto"

import type { ExtractedArchiveData } from "../exam-archive/archiveExtractor"
import { describeAmbiguity, pickOldest } from "../humanKeyMatching"
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
): Promise<{ groupIdsWithOrderWritten: Set<string> }> {
  // スキップされた小計をグループ別に集計
  const skippedByGroup: Record<string, string[]> = {}
  // 並び順の列に書き込んだグループだけ、あとで詰め直す。**作成だけでなく更新も数える** —
  // 上書き／統合は既存の小計の order も書き換えるので、行が増えなくても番号は重なる
  const groupIdsWithOrderWritten = new Set<string>()

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
      groupIdsWithOrderWritten.add(newGroupId)
      continue
    }

    // 3. マッピング未設定（デフォルト動作: 従来の名前ベース自動マッチ）
    //
    // 小計名は 2026-08-23 に `@@unique([subtotalGroupId, name])` を外した
    // （`20260823120000_subtotal_uniques_by_uuid`）ので、同じグループに同名が2つ
    // 並びうる。どれに結び付けるかは名前からは決まらないので、いちばん古い行を採り、
    // 候補が2件以上あったことは必ず伝える（humanKeyMatching の決まりに従う）。
    const sameNameSubtotals = await tx.subtotal.findMany({
      where: { subtotalGroupId: newGroupId, name: subtotal.name },
    })
    const existing = pickOldest(sameNameSubtotals)
    if (existing) {
      const ambiguity = describeAmbiguity(
        `小計「${subtotal.name}」`,
        sameNameSubtotals.length,
        `作成 ${existing.createdAt.toISOString().slice(0, 10)}`
      )
      if (ambiguity) warnings.push(ambiguity)
    }

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
        groupIdsWithOrderWritten.add(newGroupId)
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
      groupIdsWithOrderWritten.add(newGroupId)
    }
  }

  // スキップされた小計の警告を出力
  for (const [groupName, subtotalNames] of Object.entries(skippedByGroup)) {
    warnings.push(
      `小計グループ「${groupName}」がスキップされたため、配下の小計項目（${subtotalNames.join("、")}）もスキップされました`
    )
  }

  return { groupIdsWithOrderWritten }
}

/**
 * 小計項目を新規作成（名前重複時はサフィックス付き）。
 *
 * 名前をずらすのは、取り込みが「同名＝同一」と決めていないことを利用者が画面の上で
 * 見分けられるようにするためで、制約を満たすためではない（`(subtotalGroupId, name)` の
 * unique は 2026-08-23 に外した）。有無を見るだけなので findFirst でよい。
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

/**
 * 設問-小計の紐付けを取り込む。
 *
 * **突き合わせは `(cropRegionId, subtotalId, assignmentType)`。** この組は unique なので
 * （`20260823120000_subtotal_uniques_by_uuid`）、同じ組の行を作ろうとすれば必ず失敗する。
 * 同じ試験へ取り込むときの既存はもちろん、**アーカイブ自身が同じ組を2行持っている場合**
 * （制約を張る前の DB を同期した端末で書き出したもの）もここで1行へ落とす。
 *
 * id で引くより先に組で引くのは、行の同一性が組の側にあるため。同じ組の行が既に在れば、
 * それがこの割り当てであって、id が違っても別の事実ではない。
 */
export async function processCropSubtotals(
  data: ExtractedArchiveData,
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
      const existingByAssignment = await tx.cropSubtotal.findUnique({
        where: {
          cropRegionId_subtotalId_assignmentType: {
            cropRegionId: newRegionId,
            subtotalId: newSubtotalId,
            assignmentType: cropSubtotal.assignmentType,
          },
        },
      })
      if (existingByAssignment) {
        idMappings.cropSubtotal[cropSubtotal.id] = existingByAssignment.id
        continue
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
