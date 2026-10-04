/**
 * 統合アーカイブ（.sao）の1表分の行が、一意制約でどの行とぶつかるかを調べる
 *
 * `archiveTableResolver.ts` が衝突を決めるのに使う。取り込み先の行とのぶつかりは
 * `archiveUniqueIndexes.ts` で SQLite に比べさせる。書く行どうし（アーカイブの中）のぶつかりは、
 * 参照を書き換えた結果として生まれるもので、ここで値を比べる。
 */

import type {
  ArchiveTargetConnection,
  UnifiedArchiveUnresolvableReason,
} from "./archiveRowImporter"
import type { PlannedRow, RemappedArchiveRow } from "./archiveRowPlanning"
import {
  type ArchiveUniqueIndex,
  findArchiveUniqueMatches,
} from "./archiveUniqueIndexes"

/**
 * 同じ表の中で一意キーが同じになる値の組か。値はどれもアーカイブの同じ列から読み、参照は
 * 取り込み先の id に書き換えたもの（同じ列の値どうしなので、型の揃った比べ方でよい）
 */
const uniqueKeyOf = (
  values: Readonly<Record<string, unknown>>,
  uniqueIndex: ArchiveUniqueIndex
): string | null => {
  const keyParts: string[] = []
  for (const column of uniqueIndex.columns) {
    const columnValue = values[column]
    // NULL は一意制約にかからない
    if (columnValue === null || columnValue === undefined) return null
    keyParts.push(`${typeof columnValue}:${String(columnValue)}`)
  }
  return JSON.stringify(keyParts)
}

/** 書く行の一意キーで、取り込み先の別の id の行を引く（行の位置 → 既存の id → 索引の列） */
export const findCollisions = async (
  target: ArchiveTargetConnection,
  table: string,
  uniqueIndexes: readonly ArchiveUniqueIndex[],
  probedRows: readonly RemappedArchiveRow[]
): Promise<Map<number, Map<string, readonly string[]>>> => {
  const query = (sql: string, params: readonly unknown[]) =>
    target.query<unknown>(sql, params)
  const collisions = new Map<number, Map<string, readonly string[]>>()
  for (const uniqueIndex of uniqueIndexes) {
    const probes = probedRows.flatMap((row, probeIndex) => {
      const values = uniqueIndex.columns.map((column) => row.values[column])
      return values.some((value) => value === null || value === undefined)
        ? []
        : [{ probeIndex, values }]
    })
    if (probes.length === 0) continue
    for (const match of await findArchiveUniqueMatches(
      query,
      table,
      uniqueIndex,
      probes
    )) {
      const row = probedRows[match.probeIndex]
      if (!row || match.existingId === row.targetId) continue
      let rowCollisions = collisions.get(match.probeIndex)
      if (!rowCollisions) {
        rowCollisions = new Map()
        collisions.set(match.probeIndex, rowCollisions)
      }
      if (!rowCollisions.has(match.existingId)) {
        rowCollisions.set(match.existingId, uniqueIndex.columns)
      }
    }
  }
  return collisions
}

/** 書く行（作る・置き換える）どうしが、同じ一意キーになるものを集める */
export const findDuplicatesInArchive = (
  table: string,
  uniqueIndexes: readonly ArchiveUniqueIndex[],
  plans: readonly PlannedRow[],
  valuesByArchiveId: ReadonlyMap<string, Readonly<Record<string, unknown>>>
): UnifiedArchiveUnresolvableReason[] => {
  const reasons: UnifiedArchiveUnresolvableReason[] = []
  const writtenPlans = plans.filter((plan) => plan.kind !== "keep")
  for (const uniqueIndex of uniqueIndexes) {
    const archiveIdsByKey = new Map<string, string[]>()
    for (const plan of writtenPlans) {
      const values = valuesByArchiveId.get(plan.archiveId)
      const key = values ? uniqueKeyOf(values, uniqueIndex) : null
      if (key === null) continue
      archiveIdsByKey.set(key, [
        ...(archiveIdsByKey.get(key) ?? []),
        plan.archiveId,
      ])
    }
    for (const archiveIds of archiveIdsByKey.values()) {
      if (archiveIds.length < 2) continue
      reasons.push({
        kind: "duplicateInArchive",
        table,
        columns: uniqueIndex.columns,
        archiveIds,
        existingIds: [],
      })
    }
  }
  return reasons
}
