/**
 * 統合アーカイブ（.sao）の中身の DB を書く
 *
 * 元の DB を `VACUUM INTO` で複製し、範囲（`archiveScopeResolver.ts`）に入らない行を消す。
 * スキーマは元の DB と同じで、`_prisma_migrations` も残す（取り込み側はこれで版を知り、
 * 足りない migration を当てる。docs/unified-archive-design.md §4）。
 *
 * 書いた DB の外部キーが閉じていなければ失敗させる。規則の漏れを黙って行を落として
 * 隠さないため（docs §5.4）。
 */

import Database from "better-sqlite3"
import * as fs from "fs"

import type { SqliteDatabase } from "../../prisma/sqliteSchemaUtils"
import type { ArchiveScope } from "./archiveScopeResolver"
import { ARCHIVE_TABLES } from "./archiveTableRegistry"

/** 書き出しに残す、`_` で始まる表（同期の内部表などは捨てる） */
const KEPT_INTERNAL_TABLES = new Set(["_prisma_migrations"])

const quote = (identifier: string): string =>
  `"${identifier.replaceAll('"', '""')}"`

/** 同期のトリガー・ビュー・内部表を取り除く（行を消す前に。トリガーが帳簿へ書くため） */
const dropNonApplicationObjects = (db: SqliteDatabase): void => {
  const objects = db
    .prepare<[], { type: string; name: string }>(
      "SELECT type, name FROM sqlite_master WHERE type IN ('trigger', 'view', 'table')"
    )
    .all()
  for (const object of objects) {
    if (object.type === "trigger") {
      db.exec(`DROP TRIGGER IF EXISTS ${quote(object.name)}`)
    } else if (object.type === "view") {
      db.exec(`DROP VIEW IF EXISTS ${quote(object.name)}`)
    }
  }
  for (const object of objects) {
    if (object.type !== "table") continue
    if (object.name.startsWith("sqlite_")) continue
    if (object.name.startsWith("_") && !KEPT_INTERNAL_TABLES.has(object.name)) {
      db.exec(`DROP TABLE IF EXISTS ${quote(object.name)}`)
    }
  }
}

/** 登録表に無いアプリの表があれば止める（何を入れるかが決まっていない） */
const assertAllTablesRegistered = (db: SqliteDatabase): void => {
  const unknownTables = db
    .prepare<[], { name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_%' ESCAPE '\\'"
    )
    .all()
    .map((tableRow) => tableRow.name)
    .filter((name) => !ARCHIVE_TABLES[name])
  if (unknownTables.length > 0) {
    throw new Error(
      `統合アーカイブの登録表に無い表があります: ${unknownTables.join(", ")}`
    )
  }
}

/** 範囲に入らない行を消し、外れた先を指す任意の参照を NULL にする */
const keepOnlyScopedRows = (db: SqliteDatabase, scope: ArchiveScope): void => {
  db.exec("CREATE TEMP TABLE kept_id (id TEXT PRIMARY KEY)")
  const insertKept = db.prepare<[string]>(
    "INSERT OR IGNORE INTO kept_id (id) VALUES (?)"
  )
  for (const table of Object.keys(ARCHIVE_TABLES)) {
    db.exec("DELETE FROM kept_id")
    for (const id of scope.rows.get(table) ?? []) insertKept.run(id)
    db.exec(
      `DELETE FROM ${quote(table)} WHERE id NOT IN (SELECT id FROM kept_id)`
    )
  }
  db.exec("DROP TABLE kept_id")
  for (const reference of scope.nulledReferences) {
    db.prepare<[string]>(
      `UPDATE ${quote(reference.table)} SET ${quote(reference.column)} = NULL WHERE id = ?`
    ).run(reference.id)
  }
}

/**
 * 利用者の passcode を空にする（docs §5.1）。アーカイブは端末の外へ渡るファイルなので、
 * 照合に使う値を載せない。取り込み側は既存の利用者の passcode を書き換えない（段階3。docs §7）。
 * updatedAt は変えない（取り込みの LWW を、書き出したことで動かさないため）
 */
const clearUserPasscodes = (db: SqliteDatabase): void => {
  db.exec(`UPDATE "User" SET passcode = NULL, passcodeType = 'none'`)
}

/**
 * 外部キーが閉じていることを確かめる。DB の制約（`foreign_key_check`）に加えて、登録表の
 * 参照でも確かめる（DB の制約は schema とずれうる。GradeDataSource の資料への参照は
 * 20261004130000 で直すまで本番だけ制約が無かった）
 */
const assertReferencesClosed = (db: SqliteDatabase): void => {
  const constraintViolations = db
    .prepare<[], { table: string; parent: string }>("PRAGMA foreign_key_check")
    .all()
  const registryViolations: string[] = []
  for (const [table, spec] of Object.entries(ARCHIVE_TABLES)) {
    for (const reference of spec.references) {
      const dangling = db
        .prepare<[], { count: number }>(
          `SELECT COUNT(*) AS count FROM ${quote(table)} AS child
           WHERE child.${quote(reference.column)} IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM ${quote(reference.table)} AS parent
                             WHERE parent.id = child.${quote(reference.column)})`
        )
        .get()
      if (dangling && dangling.count > 0) {
        registryViolations.push(
          `${table}.${reference.column} → ${reference.table}: ${dangling.count}件`
        )
      }
    }
  }
  if (constraintViolations.length > 0 || registryViolations.length > 0) {
    const constraintSummary = constraintViolations
      .map((violation) => `${violation.table} → ${violation.parent}`)
      .slice(0, 10)
    throw new Error(
      `書き出した DB の外部キーが閉じていません: ${[
        ...constraintSummary,
        ...registryViolations,
      ].join(" / ")}`
    )
  }
}

/**
 * `sourcePath` の DB から、`scope` に入る行だけを持つ DB を `outputPath` に書く。
 * `outputPath` が既にあれば失敗する（上書きしない）。
 */
export function writeArchiveDatabase(
  sourcePath: string,
  outputPath: string,
  scope: ArchiveScope
): void {
  if (fs.existsSync(outputPath)) {
    throw new Error(`書き出し先が既にあります: ${outputPath}`)
  }
  const source = new Database(sourcePath, {
    readonly: true,
    fileMustExist: true,
  })
  try {
    source.prepare<[string]>("VACUUM INTO ?").run(outputPath)
  } finally {
    source.close()
  }

  const archive = new Database(outputPath)
  try {
    archive.pragma("journal_mode = DELETE")
    archive.pragma("foreign_keys = OFF")
    dropNonApplicationObjects(archive)
    assertAllTablesRegistered(archive)
    archive.transaction(() => {
      keepOnlyScopedRows(archive, scope)
      clearUserPasscodes(archive)
    })()
    assertReferencesClosed(archive)
    archive.exec("VACUUM")
  } catch (error) {
    archive.close()
    fs.rmSync(outputPath, { force: true })
    throw error
  }
  archive.close()
}
