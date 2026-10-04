/**
 * Coursework の評価項目（CourseworkItem）の Prisma 操作関数
 *
 * 文字評価の刻み（CourseworkLetterScale）はここでは書かない。`courseworkLetterScale.ts` の
 * 1行ずつの経路が持つ。
 */

import type { InputMode } from "../../../src/types/coursework.types"
import { toInputMode } from "../../../src/types/coursework.types"
import { recordAuditLog } from "./auditLog"
import {
  resolveCourseworkScope,
  resolveCourseworkScopeByItem,
} from "./auditScope"
import prisma from "./client"
import { serializePrisma } from "./serializePrisma"

/**
 * 評価項目の `inputMode` を union へ倒す（SQLite に enum が無いので列は String）。
 * 境界の1箇所でだけ変換し、renderer は union として扱う。
 */
export const withInputMode = <Item extends { inputMode: string }>(
  item: Item
): Omit<Item, "inputMode"> & { inputMode: InputMode } => ({
  ...item,
  inputMode: toInputMode(item.inputMode),
})

/** 評価項目を作成 */
export async function createCourseworkItem(data: {
  courseworkId: string
  name: string
  maxScore: number
  inputMode?: string
  letterScales?: { label: string; score: number; order: number }[]
}) {
  const maxOrder = await prisma.courseworkItem.aggregate({
    where: { courseworkId: data.courseworkId },
    _max: { order: true },
  })
  const nextOrder = (maxOrder._max.order ?? -1) + 1

  const item = await prisma.courseworkItem.create({
    data: {
      courseworkId: data.courseworkId,
      name: data.name,
      maxScore: data.maxScore,
      order: nextOrder,
      ...(data.inputMode !== undefined && { inputMode: data.inputMode }),
      ...(data.letterScales !== undefined &&
        data.letterScales.length > 0 && {
          letterScales: {
            create: data.letterScales.map((letterScale) => ({
              label: letterScale.label,
              score: letterScale.score,
              order: letterScale.order,
            })),
          },
        }),
    },
    include: { letterScales: { orderBy: { order: "asc" } } },
  })

  const scope = await resolveCourseworkScope(data.courseworkId)
  await recordAuditLog({
    action: "coursework.item.create",
    entityType: "CourseworkItem",
    entityId: item.id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    target: data.name,
  })

  return withInputMode(serializePrisma(item))
}

/**
 * 評価項目そのものを更新する。
 *
 * **文字評価の刻みはここで書かない。** 刻みは `courseworkLetterScale.ts` の
 * 1行ずつの経路が持つ。かつてここが刻みの配列を受け取り `deleteMany` →
 * `create` していたため、項目名を1文字直すだけで全行の id が振り直されていた。
 */
export async function updateCourseworkItem(
  id: string,
  data: {
    name?: string
    maxScore?: number
    inputMode?: string
  }
) {
  const item = await prisma.courseworkItem.update({
    where: { id },
    data,
    include: { letterScales: { orderBy: { order: "asc" } } },
  })

  const scope = await resolveCourseworkScopeByItem(id)
  await recordAuditLog({
    action: "coursework.item.update",
    entityType: "CourseworkItem",
    entityId: id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    target: item.name,
  })

  return withInputMode(serializePrisma(item))
}

/**
 * 評価項目を削除。
 *
 * 成績算出から使われていても消せる（確認画面が前もって影響を見せる）。評価項目を
 * そのまま使うデータソースは `onDelete: SetNull` で参照先が空になり、資料合計を
 * 使うデータソースは合計が変わる。
 */
export async function deleteCourseworkItem(id: string): Promise<void> {
  const before = await prisma.courseworkItem.findUnique({
    where: { id },
  })
  const scope = await resolveCourseworkScopeByItem(id)

  await prisma.courseworkItem.delete({ where: { id } })

  await recordAuditLog({
    action: "coursework.item.delete",
    entityType: "CourseworkItem",
    entityId: id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    target: before?.name ?? null,
  })
}

/** 評価項目の並び順を更新 */
export async function reorderCourseworkItems(
  items: { id: string; order: number }[]
) {
  await prisma.$transaction(
    items.map((item) =>
      prisma.courseworkItem.update({
        where: { id: item.id },
        data: { order: item.order },
      })
    )
  )
}
