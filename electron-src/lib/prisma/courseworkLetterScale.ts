/**
 * CourseworkLetterScale（文字評価の刻み）のPrisma操作関数
 *
 * 「A=100, B=80, C=60」のような、文字評価と点数の対応表の1行。
 *
 * **書き込みは1行ずつ。** かつては `updateCourseworkItem` の引数として刻みの配列が
 * 載っており、項目名を1文字直すだけでも `deleteMany` → `create` で全行の id が
 * 振り直されていた。id が変わると、NAS 同期では削除と挿入として伝わって他端末の
 * 編集を巻き添えにし、アーカイブの id 一次照合も同一行と見なせなくなる。
 *
 * 取得の関数は無い。刻みは評価項目の子として同梱され、`getCourseworkById` が
 * 行のまま返す。
 *
 * ラベルは `@@unique([courseworkItemId, label])`。重複するラベルは書けないので、
 * 呼び出し側は重複しない状態でだけ書く（renderer 側で入力中の文字を保持し、
 * 重複している間は書かない）。
 */

import type { Prisma } from "@prisma/client"

import { recordAuditLog } from "./auditLog"
import { resolveCourseworkScopeByItem } from "./auditScope"
import prisma from "./client"
import { serializePrisma } from "./serializePrisma"

/** 刻みを1行足す */
export async function createCourseworkLetterScale(data: {
  courseworkItemId: string
  label: string
  score: number
  order: number
}) {
  const letterScale = await prisma.courseworkLetterScale.create({ data })

  const scope = await resolveCourseworkScopeByItem(data.courseworkItemId)
  await recordAuditLog({
    action: "coursework.letterScale.create",
    entityType: "CourseworkLetterScale",
    entityId: letterScale.id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    target: letterScale.label,
  })

  return serializePrisma(letterScale)
}

/** 刻み1行のラベルまたは点数を変える */
export async function updateCourseworkLetterScale(
  id: string,
  data: { label?: string; score?: number }
) {
  const letterScale = await prisma.courseworkLetterScale.update({
    where: { id },
    data,
  })

  const scope = await resolveCourseworkScopeByItem(letterScale.courseworkItemId)
  await recordAuditLog({
    action: "coursework.letterScale.update",
    entityType: "CourseworkLetterScale",
    entityId: letterScale.id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    target: letterScale.label,
  })

  return serializePrisma(letterScale)
}

/** 刻みを1行消す */
export async function deleteCourseworkLetterScale(id: string) {
  const letterScale = await prisma.courseworkLetterScale.delete({
    where: { id },
  })

  const scope = await resolveCourseworkScopeByItem(letterScale.courseworkItemId)
  await recordAuditLog({
    action: "coursework.letterScale.delete",
    entityType: "CourseworkLetterScale",
    entityId: id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    target: letterScale.label,
  })
}

/**
 * 刻みの並び順を入れ替える。
 *
 * 並べ替えは N 行が全部か無しかなので、ここだけトランザクションで包む
 * （`docs/coding-style.md` の「日常の書き込みに `$transaction` を使わない」の例外）。
 */
export async function reorderCourseworkLetterScales(
  items: { id: string; order: number }[]
) {
  if (items.length === 0) return

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const item of items) {
      await tx.courseworkLetterScale.update({
        where: { id: item.id },
        data: { order: item.order },
      })
    }
  })
}
