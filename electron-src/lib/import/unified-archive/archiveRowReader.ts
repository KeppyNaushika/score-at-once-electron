/**
 * 統合アーカイブ（.sao）の archive.db から、取り込む行を読む
 *
 * 列は表ごとに `PRAGMA table_info` で取る（表と列が取り込み先と一致することは、開く側が
 * 現行化の後に確かめてある。docs/unified-archive-design.md §4.1）。値は SQLite に入っている
 * ままで加工しない（時刻は ISO の文字列、真偽は 0 / 1）。取り込み先へもそのまま書くので、
 * 往復で値の形が変わらない。
 *
 * 「別で追加」の id の振り直し（docs §7.2）もここで決める。振り直すのは根の子孫だけで、
 * 共通の実体と、その配下（在籍・小計）と、選べる項目は振り直さない。
 */

import Database from "better-sqlite3"
import * as crypto from "crypto"

import { ARCHIVE_TABLES } from "../../export/unified-archive/archiveTableRegistry"
import { orderArchiveTables } from "./archiveTableOrder"

/** archive.db の1行（列名 → SQLite の値） */
export type ArchiveRowValues = Readonly<Record<string, unknown>>

export interface ArchiveRow {
  readonly id: string
  readonly values: ArchiveRowValues
}

export interface ArchiveTableRows {
  readonly table: string
  readonly columns: readonly string[]
  readonly rows: readonly ArchiveRow[]
}

export interface ArchiveRows {
  /** 行のある表だけを、外部キーの親が先の順に並べたもの */
  readonly tables: readonly ArchiveTableRows[]
  readonly needsDeferredForeignKeys: boolean
}

const quote = (identifier: string): string =>
  `"${identifier.replaceAll('"', '""')}"`

/** archive.db を読み取り専用で開き、登録表に載る全ての表の行を読む */
export function readArchiveRows(databasePath: string): ArchiveRows {
  const archive = new Database(databasePath, {
    readonly: true,
    fileMustExist: true,
  })
  try {
    const tableNames = archive
      .prepare<[], { name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_%' ESCAPE '\\'"
      )
      .all()
      .map((tableRow) => tableRow.name)
    const unknownTables = tableNames.filter((name) => !ARCHIVE_TABLES[name])
    if (unknownTables.length > 0) {
      throw new Error(
        `統合アーカイブの登録表に無い表があります: ${unknownTables.join(", ")}`
      )
    }

    const order = orderArchiveTables(tableNames)
    const tables: ArchiveTableRows[] = []
    for (const table of order.tables) {
      const columns = archive
        .prepare<[], { name: string }>(`PRAGMA table_info(${quote(table)})`)
        .all()
        .map((column) => column.name)
      const rows = archive
        .prepare<[], Record<string, unknown>>(
          `SELECT * FROM ${quote(table)} ORDER BY id`
        )
        .all()
        .map((values): ArchiveRow => {
          const id = values.id
          if (typeof id !== "string") {
            throw new Error(`${table} に id が文字列でない行があります`)
          }
          return { id, values }
        })
      if (rows.length > 0) tables.push({ table, columns, rows })
    }
    return {
      tables,
      needsDeferredForeignKeys: order.needsDeferredForeignKeys,
    }
  } finally {
    archive.close()
  }
}

/**
 * 「別で追加」で振り直す行と、その新しい id を決める（表 → 旧 id → 新 id）。
 *
 * - 根（試験・資料・成績算出・解答用紙定義）は全て振り直す
 * - 配下（owned）と中間テーブル（link）は、参照する先のどれかが振り直されるとき振り直す。
 *   根の子孫は owner を辿って必ずここに当たる。在籍（生徒の配下）と小計（小計グループの
 *   配下）は参照先が共通の実体だけなので振り直さず、共通の実体と同じく「在れば触らない・
 *   無ければ作る」になる（振り直すと、同じ生徒の同じ在籍が2行になる）
 * - 共通の実体は振り直さない
 * - 選べる項目も配下と同じ規則に従う。利用者個人の設定は参照先が利用者（共通の実体）だけ、
 *   組織の設定と監査ログは参照を持たないので振り直されない。AI 採点の記録は採点枠・受験生を
 *   参照するので、試験を振り直せば一緒に振り直る（振り直さないと、同じアーカイブを2回
 *   別で追加したときに2つ目の試験の記録が1つ目と同じ id になる）
 *
 * 表は親が先の順に並んでいるので1巡で決まるが、循環があっても取りこぼさないよう、
 * 増えなくなるまで回す。
 */
export function renumberSeparateRows(
  tables: readonly ArchiveTableRows[]
): Record<string, Record<string, string>> {
  const idMap: Record<string, Record<string, string>> = {}
  const isRenumbered = (table: string, value: unknown): boolean =>
    typeof value === "string" && idMap[table]?.[value] !== undefined

  let changed = true
  while (changed) {
    changed = false
    for (const tableRows of tables) {
      const spec = ARCHIVE_TABLES[tableRows.table]
      if (spec.role === "shared") continue
      const tableIdMap = (idMap[tableRows.table] ??= {})
      for (const row of tableRows.rows) {
        if (tableIdMap[row.id] !== undefined) continue
        const shouldRenumber =
          spec.role === "root" ||
          spec.references.some((reference) =>
            isRenumbered(reference.table, row.values[reference.column])
          )
        if (!shouldRenumber) continue
        tableIdMap[row.id] = crypto.randomUUID()
        changed = true
      }
    }
  }
  return Object.fromEntries(
    Object.entries(idMap).filter(
      ([, tableIdMap]) => Object.keys(tableIdMap).length > 0
    )
  )
}
