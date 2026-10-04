/**
 * 取り込み先の表への、行単位の読み書き（id で引く・作る・置き換える）
 *
 * 統合アーカイブ（.sao）の取り込み（`archiveRowImporter.ts`）が、決めた行を書くのに使う。
 * 値は SQLite に入っているままで加工しない。
 */

import type { ArchiveTargetConnection } from "./archiveRowImporter"
import type { PlannedRow } from "./archiveRowPlanning"
import { chunkItems, SQL_VARIABLE_LIMIT } from "./archiveUniqueIndexes"

/** 取り込み先の1行（列名 → 値） */
export type TargetRow = Readonly<Record<string, unknown>>

const quote = (identifier: string): string =>
  `"${identifier.replaceAll('"', '""')}"`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

/** 取り込み先に在る行を全列で引く（id → 行） */
export async function fetchTargetRows(
  target: ArchiveTargetConnection,
  table: string,
  ids: Iterable<string>
): Promise<Map<string, TargetRow>> {
  const rowsById = new Map<string, TargetRow>()
  for (const idChunk of chunkItems([...new Set(ids)], SQL_VARIABLE_LIMIT)) {
    const targetRows = await target.query<unknown>(
      `SELECT * FROM ${quote(table)} WHERE id IN (${idChunk
        .map(() => "?")
        .join(", ")})`,
      idChunk
    )
    for (const targetRow of targetRows) {
      if (!isRecord(targetRow) || typeof targetRow.id !== "string") continue
      rowsById.set(targetRow.id, targetRow)
    }
  }
  return rowsById
}

/** 作る行を INSERT する（同じ表の行は同じ列を持つ） */
export async function insertPlannedRows(
  target: ArchiveTargetConnection,
  table: string,
  rows: readonly PlannedRow[]
): Promise<void> {
  if (rows.length === 0) return
  const columns = Object.keys(rows[0].values)
  const rowsPerStatement = Math.max(
    1,
    Math.floor(SQL_VARIABLE_LIMIT / columns.length)
  )
  const rowPlaceholder = `(${columns.map(() => "?").join(", ")})`
  for (const rowChunk of chunkItems(rows, rowsPerStatement)) {
    await target.execute(
      `INSERT INTO ${quote(table)} (${columns.map(quote).join(", ")}) VALUES ${rowChunk
        .map(() => rowPlaceholder)
        .join(", ")}`,
      rowChunk.flatMap((row) => columns.map((column) => row.values[column]))
    )
  }
}

/** 置き換える行を UPDATE する（削除して作り直さない。カスケードで子を失う） */
export async function updatePlannedRows(
  target: ArchiveTargetConnection,
  table: string,
  rows: readonly PlannedRow[]
): Promise<void> {
  for (const row of rows) {
    const setColumns = Object.keys(row.values).filter(
      (column) => column !== "id"
    )
    if (setColumns.length === 0) continue
    await target.execute(
      `UPDATE ${quote(table)} SET ${setColumns
        .map((column) => `${quote(column)} = ?`)
        .join(", ")} WHERE id = ?`,
      [...setColumns.map((column) => row.values[column]), row.targetId]
    )
  }
}
