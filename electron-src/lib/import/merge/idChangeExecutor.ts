/**
 * ID変更処理
 *
 * 照合で「同じもの・ファイルの id に合わせる」を選んだとき、取り込みを取り込み先の id で
 * 終えてから、取り込み先の行の id をファイルの id へ変える（Stage 2）。
 *
 * 付け替えは統合アーカイブ（.sao）と同じ `renameTargetRow` で行う: 行は `UPDATE … SET id`、
 * それを参照する子の外部キー・JSON に埋め込んだ id・監査ログも UPDATE で付け替える。
 * **削除して作り直さない**（旧方式は delete + 再作成で、移し替え漏れの子をカスケードで失った）。
 * 付け替えの途中は親子が一時的にずれるので、外部キーの検査はコミットまで遅らせる。
 */

import { renameTargetRow } from "../unified-archive/archiveIdRenamer"
import { prismaArchiveTarget } from "../unified-archive/archiveRowImporter"
import type { IdChangeTarget, IdMappings, PrismaTransaction } from "./types"

/** 付け替える表と、警告に出す呼び名 */
const RENAMED_TABLES: Record<
  IdChangeTarget["category"],
  { table: string; label: string }
> = {
  student: { table: "Student", label: "生徒" },
  classroom: { table: "Classroom", label: "学級" },
  subtotalGroup: { table: "SubtotalGroup", label: "小計点グループ" },
}

const quote = (identifier: string): string =>
  `"${identifier.replaceAll('"', '""')}"`

/**
 * ID変更処理を実行
 *
 * Stage 1 と同じトランザクションの末尾で呼ぶ。付け替え先の id が既に使われている・
 * 付け替える行が無いときは付け替えず、警告に残す（取り込みは取り込み先の id のまま成立している）。
 */
export async function executeIdChanges(
  targets: IdChangeTarget[],
  idMappings: IdMappings,
  warnings: string[],
  tx: PrismaTransaction
): Promise<void> {
  if (targets.length === 0) return
  const target = prismaArchiveTarget(tx)
  await target.execute("PRAGMA defer_foreign_keys = ON", [])

  for (const idChangeTarget of targets) {
    const { table, label } = RENAMED_TABLES[idChangeTarget.category]
    const { existingId, newId } = idChangeTarget
    if (existingId === newId) continue

    const presentRows = await target.query<{ id: string }>(
      `SELECT id FROM ${quote(table)} WHERE id IN (?, ?)`,
      [existingId, newId]
    )
    const presentIds = new Set(presentRows.map((presentRow) => presentRow.id))
    if (!presentIds.has(existingId)) {
      warnings.push(
        `${label}（${existingId}）が見つからないため、ファイルの id（${newId}）に合わせられませんでした`
      )
      continue
    }
    if (presentIds.has(newId)) {
      warnings.push(
        `ファイルの id（${newId}）が既にこのPCの別の${label}で使われているため、${label}（${existingId}）はこのPCの id のままにしました`
      )
      continue
    }

    await renameTargetRow(target, table, existingId, newId, warnings)

    const mapping = idMappings[idChangeTarget.category]
    for (const [importId, mappedId] of Object.entries(mapping)) {
      if (mappedId === existingId) mapping[importId] = newId
    }
  }
}
