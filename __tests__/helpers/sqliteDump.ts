/**
 * SQLite の DB を、スキーマと行を含む SQL テキストへ書き出す（固定データをリポジトリに
 * 置くため。バイナリの DB より差分が読める）
 */

import type Database from "better-sqlite3"

type SqliteDatabase = InstanceType<typeof Database>

const quoteIdentifier = (identifier: string): string =>
  `"${identifier.replaceAll('"', '""')}"`

const toSqlLiteral = (value: unknown): string => {
  if (value === null || value === undefined) return "NULL"
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value)
  }
  if (Buffer.isBuffer(value)) return `X'${value.toString("hex")}'`
  return `'${String(value).replaceAll("'", "''")}'`
}

/** スキーマ（表・索引）と全行を、そのまま流せる SQL にする */
export function dumpDatabase(db: SqliteDatabase): string {
  const objects = db
    .prepare<[], { type: string; name: string; sql: string | null }>(
      "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name"
    )
    .all()
  const lines: string[] = ["PRAGMA foreign_keys=OFF;", "BEGIN;"]
  for (const object of objects) {
    lines.push(`${object.sql};`)
  }
  for (const object of objects) {
    if (object.type !== "table") continue
    const rows = db
      .prepare<[], Record<string, unknown>>(
        `SELECT * FROM ${quoteIdentifier(object.name)} ORDER BY rowid`
      )
      .all()
    for (const row of rows) {
      const columns = Object.keys(row).map(quoteIdentifier).join(", ")
      const values = Object.values(row).map(toSqlLiteral).join(", ")
      lines.push(
        `INSERT INTO ${quoteIdentifier(object.name)} (${columns}) VALUES (${values});`
      )
    }
  }
  lines.push("COMMIT;")
  return `${lines.join("\n")}\n`
}
