/**
 * migration が「一部だけの DB」でも全体と同じ結果になるかを確かめる検査器
 *
 * 統合アーカイブ（.sao）は、選んだ範囲だけを詰めた DB を書き出し、取り込むときにアプリと
 * 同じ migration を当てて現行化する（docs/unified-archive-design.md §4・§8）。そのため
 * migration は、一部だけの DB に当てても、全体の DB に当ててから同じ範囲を切り出したものと
 * 同じ結果にならなければならない。
 *
 * 比べ方:
 * 1. 全体の DB に migration を当て、範囲の規則で切り出す（＝期待）
 * 2. 当てる前の DB を、期待と同じ id の行だけに絞り、migration を当てる（＝実際）
 * 3. 表ごとに id で突き合わせる。migration が乱数の id で作った行は id が食い違うので、
 *    一意制約の値で組にする（§8 規則4: 行を作ってよいのは一意制約を持つ表だけ）
 *
 * 時刻の列（createdAt / updatedAt）は比べない。当てた時刻が入りうるため。
 */

import Database from "better-sqlite3"
import * as crypto from "crypto"
import * as fs from "fs"
import * as path from "path"

import {
  type ArchiveSelection,
  loadScopeRows,
  resolveArchiveScope,
} from "../../electron-src/lib/export/unified-archive/archiveScopeResolver"
import { ARCHIVE_TABLES } from "../../electron-src/lib/export/unified-archive/archiveTableRegistry"

type SqliteDatabase = InstanceType<typeof Database>

export interface MigrationSource {
  readonly name: string
  readonly sql: string
}

const IGNORED_COLUMNS = new Set(["id", "createdAt", "updatedAt"])

const quote = (identifier: string): string =>
  `"${identifier.replaceAll('"', '""')}"`

/** アプリと同じ当て方（migrationApplier.ts の applyMigrationSql）で当てて記録する */
export function applyMigration(
  db: SqliteDatabase,
  migration: MigrationSource
): void {
  db.pragma("foreign_keys = OFF")
  db.exec(migration.sql)
  db.prepare<[string, string]>(
    `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
     VALUES (?, 'test', CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, 1)`
  ).run(crypto.randomUUID(), migration.name)
}

/** 固定データ（SQL テキスト）から DB を作る */
export function createDatabaseFromDump(
  filePath: string,
  dumpSql: string
): void {
  fs.rmSync(filePath, { force: true })
  const db = new Database(filePath)
  try {
    db.exec(dumpSql)
  } finally {
    db.close()
  }
}

/** DB の適用済み migration に無い、ローカルの migration */
export function pendingMigrations(
  db: SqliteDatabase,
  migrationsDir: string
): MigrationSource[] {
  const applied = new Set(
    db
      .prepare<[], { migration_name: string }>(
        `SELECT "migration_name" FROM "_prisma_migrations"`
      )
      .all()
      .map((row) => row.migration_name)
  )
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !applied.has(entry.name))
    .map((entry) => entry.name)
    .sort()
    .map((name) => ({
      name,
      sql: fs.readFileSync(
        path.join(migrationsDir, name, "migration.sql"),
        "utf-8"
      ),
    }))
}

const tableExists = (db: SqliteDatabase, table: string): boolean =>
  db
    .prepare<[string], { name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?"
    )
    .get(table) !== undefined

const columnsOf = (db: SqliteDatabase, table: string): Set<string> =>
  new Set(
    db
      .prepare<[string], { name: string }>(
        "SELECT name FROM pragma_table_info(?)"
      )
      .all(table)
      .map((column) => column.name)
  )

/** 主キー以外の一意索引の列の組 */
const uniqueKeysOf = (db: SqliteDatabase, table: string): string[][] =>
  db
    .prepare<[string], { name: string; unique: number; origin: string }>(
      'SELECT name, "unique", origin FROM pragma_index_list(?)'
    )
    .all(table)
    .filter((index) => index.unique === 1 && index.origin !== "pk")
    .map((index) =>
      db
        .prepare<[string], { name: string }>(
          "SELECT name FROM pragma_index_info(?) ORDER BY seqno"
        )
        .all(index.name)
        .map((column) => column.name)
    )

type Row = Record<string, unknown>

const rowsById = (
  db: SqliteDatabase,
  table: string,
  ids?: ReadonlySet<string>
): Map<string, Row> => {
  const rows = new Map<string, Row>()
  for (const row of db
    .prepare<[], Row>(`SELECT * FROM ${quote(table)}`)
    .all()) {
    const id = String(row.id)
    if (!ids || ids.has(id)) rows.set(id, row)
  }
  return rows
}

/** 当てる前の DB を、期待の範囲と同じ id の行だけに絞る */
const projectToScope = (
  db: SqliteDatabase,
  scope: ReturnType<typeof resolveArchiveScope>
): void => {
  db.pragma("foreign_keys = OFF")
  db.exec("CREATE TEMP TABLE kept_id (id TEXT PRIMARY KEY)")
  const insertKept = db.prepare<[string]>(
    "INSERT OR IGNORE INTO kept_id (id) VALUES (?)"
  )
  for (const table of Object.keys(ARCHIVE_TABLES)) {
    if (!tableExists(db, table)) continue
    db.exec("DELETE FROM kept_id")
    for (const id of scope.rows.get(table) ?? []) insertKept.run(id)
    db.exec(
      `DELETE FROM ${quote(table)} WHERE id NOT IN (SELECT id FROM kept_id)`
    )
  }
  db.exec("DROP TABLE kept_id")
  for (const reference of scope.nulledReferences) {
    if (!columnsOf(db, reference.table).has(reference.column)) continue
    db.prepare<[string]>(
      `UPDATE ${quote(reference.table)} SET ${quote(reference.column)} = NULL WHERE id = ?`
    ).run(reference.id)
  }
}

/** 期待（全体から切り出した行）と実際（一部に当てた行）を表ごとに突き合わせ、食い違いを返す */
const compareScopedRows = (
  expectedDb: SqliteDatabase,
  expectedScope: ReturnType<typeof resolveArchiveScope>,
  actualDb: SqliteDatabase
): string[] => {
  const differences: string[] = []
  const idPairs = new Map<string, string>()
  const compared: {
    table: string
    expected: Map<string, Row>
    actual: Map<string, Row>
  }[] = []

  // 1. id で組にし、残りを一意制約の値で組にする（乱数の id で作られた行）
  for (const table of Object.keys(ARCHIVE_TABLES)) {
    const expected = rowsById(
      expectedDb,
      table,
      expectedScope.rows.get(table) ?? new Set()
    )
    const actual = rowsById(actualDb, table)
    const unmatchedExpected = [...expected.keys()].filter(
      (id) => !actual.has(id)
    )
    const unmatchedActual = [...actual.keys()].filter((id) => !expected.has(id))
    const keyOf = (row: Row, columns: string[]) =>
      JSON.stringify(columns.map((column) => row[column]))
    for (const uniqueColumns of uniqueKeysOf(expectedDb, table)) {
      for (const actualId of [...unmatchedActual]) {
        const actualRow = actual.get(actualId)
        if (!actualRow) continue
        const candidates = unmatchedExpected.filter((expectedId) => {
          const expectedRow = expected.get(expectedId)
          return (
            expectedRow !== undefined &&
            keyOf(expectedRow, uniqueColumns) ===
              keyOf(actualRow, uniqueColumns)
          )
        })
        if (candidates.length !== 1) continue
        idPairs.set(actualId, candidates[0])
        unmatchedExpected.splice(unmatchedExpected.indexOf(candidates[0]), 1)
        unmatchedActual.splice(unmatchedActual.indexOf(actualId), 1)
      }
    }
    if (unmatchedExpected.length > 0) {
      differences.push(
        `${table}: 全体から切り出すと在るが、一部に当てると無い行 ${unmatchedExpected.length}件`
      )
    }
    if (unmatchedActual.length > 0) {
      differences.push(
        `${table}: 一部に当てると在るが、全体から切り出すと無い行 ${unmatchedActual.length}件`
      )
    }
    compared.push({ table, expected, actual })
  }

  // 2. 組になった行の値を比べる（乱数の id を指す列は、組の相手の id へ読み替える）
  for (const { table, expected, actual } of compared) {
    for (const [actualId, actualRow] of actual) {
      const expectedRow = expected.get(idPairs.get(actualId) ?? actualId)
      if (!expectedRow) continue
      const columns = Object.keys(expectedRow).filter(
        (column) => !IGNORED_COLUMNS.has(column)
      )
      const changed = columns.filter((column) => {
        const actualValue = actualRow[column]
        const translated =
          typeof actualValue === "string"
            ? (idPairs.get(actualValue) ?? actualValue)
            : actualValue
        return (
          JSON.stringify(translated) !== JSON.stringify(expectedRow[column])
        )
      })
      if (changed.length > 0) {
        differences.push(
          `${table}(${actualId}): 値が食い違う列 ${changed.join(", ")}`
        )
      }
    }
  }
  return differences
}

/**
 * `baselineSql` の DB に `migrations` を当てたとき、`selections` のどの範囲でも、
 * 一部だけの DB と全体から切り出した結果が一致するかを確かめる。食い違いの説明を返す
 */
export function checkMigrationsCommute(options: {
  readonly baselineSql: string
  readonly migrations: readonly MigrationSource[]
  readonly selections: readonly ArchiveSelection[]
  readonly workDir: string
}): string[] {
  const fullPath = path.join(options.workDir, "full.db")
  createDatabaseFromDump(fullPath, options.baselineSql)
  const full = new Database(fullPath)
  try {
    for (const migration of options.migrations) applyMigration(full, migration)
  } finally {
    full.close()
  }

  const differences: string[] = []
  options.selections.forEach((selection, selectionIndex) => {
    const migratedFull = new Database(fullPath, { readonly: true })
    const subsetPath = path.join(options.workDir, `subset-${selectionIndex}.db`)
    try {
      const expectedScope = resolveArchiveScope(
        loadScopeRows(migratedFull),
        selection
      )
      createDatabaseFromDump(subsetPath, options.baselineSql)
      const subset = new Database(subsetPath)
      try {
        projectToScope(subset, expectedScope)
        for (const migration of options.migrations) {
          applyMigration(subset, migration)
        }
        differences.push(
          ...compareScopedRows(migratedFull, expectedScope, subset).map(
            (difference) => `範囲${selectionIndex + 1}: ${difference}`
          )
        )
      } finally {
        subset.close()
      }
    } finally {
      migratedFull.close()
    }
  })
  return differences
}
