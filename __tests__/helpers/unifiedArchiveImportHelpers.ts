/**
 * 統合アーカイブ（.sao）の取り込みのテストで共有する、DB の読み方と取り込みの呼び方
 *
 * 行の取り込みのテスト（unifiedArchiveImport.test.ts）と、書き出し → 開く → 取り込むの
 * 端から端のテスト（unifiedArchiveRoundTrip.test.ts）の両方が使う。
 */

import type { PrismaClient } from "@prisma/client"
import AdmZip from "adm-zip"
import Database from "better-sqlite3"
import * as crypto from "crypto"
import * as fs from "fs"
import * as path from "path"

import { ARCHIVE_TABLES } from "../../electron-src/lib/export/unified-archive/archiveTableRegistry"
import { collectArchiveGradeImpactSource } from "../../electron-src/lib/import/unified-archive/archiveGradeImpactSource"
import {
  analyzeUnifiedArchiveImport,
  importUnifiedArchiveRows,
  prismaArchiveTransaction,
} from "../../electron-src/lib/import/unified-archive/archiveRowImporter"
import type {
  OpenedUnifiedArchive,
  UnifiedArchiveImportDecisions,
} from "../../electron-src/lib/import/unified-archive/types"
import type { ImportAction } from "../../src/types/importAction.types"
import {
  UNIFIED_ARCHIVE_DATABASE_NAME,
  UNIFIED_ARCHIVE_FILES_DIR,
} from "../../src/types/unifiedArchive.types"

/** 表名 → 行（全列） */
export type TableRows = Map<string, Record<string, unknown>[]>

/** 取り込み先に書かない列（docs §5.1）。比べるときは除く */
const USER_SECRET_COLUMNS = new Set(["passcode", "passcodeType"])

/** 取り込みのトランザクションの時間切れ（Prisma の既定の5秒では足りない） */
const IMPORT_TRANSACTION_TIMEOUT_MS = 60_000

const quote = (identifier: string): string =>
  `"${identifier.replaceAll('"', '""')}"`

export const withDatabase = <Result>(
  databasePath: string,
  read: (db: Database.Database) => Result
): Result => {
  const db = new Database(databasePath, { readonly: true, fileMustExist: true })
  try {
    return read(db)
  } finally {
    db.close()
  }
}

/** アプリの表の名前（sqlite_ と _ で始まる表は除く） */
const applicationTables = (db: Database.Database): string[] =>
  db
    .prepare<[], { name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_%' ESCAPE '\\' ORDER BY name"
    )
    .all()
    .map((tableRow) => tableRow.name)

/** DB の表ごとの id（行のある表だけ） */
export const readTableIds = (databasePath: string): Map<string, string[]> =>
  withDatabase(databasePath, (db) => {
    const idsByTable = new Map<string, string[]>()
    for (const table of applicationTables(db)) {
      const ids = db
        .prepare<[], { id: string }>(
          `SELECT id FROM ${quote(table)} ORDER BY id`
        )
        .all()
        .map((idRow) => idRow.id)
      if (ids.length > 0) idsByTable.set(table, ids)
    }
    return idsByTable
  })

/** 表ごとに指定した id の行を全列で読む（利用者の passcode は除く） */
export const readRowsByIds = (
  databasePath: string,
  idsByTable: ReadonlyMap<string, string[]>
): TableRows =>
  withDatabase(databasePath, (db) => {
    const rowsByTable: TableRows = new Map()
    for (const [table, ids] of idsByTable) {
      const placeholders = ids.map(() => "?").join(", ")
      const rows = db
        .prepare<string[], Record<string, unknown>>(
          `SELECT * FROM ${quote(table)} WHERE id IN (${placeholders}) ORDER BY id`
        )
        .all(...ids)
        .map((row) =>
          table === "User"
            ? Object.fromEntries(
                Object.entries(row).filter(
                  ([column]) => !USER_SECRET_COLUMNS.has(column)
                )
              )
            : row
        )
      rowsByTable.set(table, rows)
    }
    return rowsByTable
  })

/** DB の表ごとの行数（行の無い表も 0 で載せる） */
export const countTableRows = (databasePath: string): Map<string, number> =>
  withDatabase(databasePath, (db) => {
    const counts = new Map<string, number>()
    for (const table of applicationTables(db)) {
      const countRow = db
        .prepare<[], { count: number }>(
          `SELECT COUNT(*) AS count FROM ${quote(table)}`
        )
        .get()
      counts.set(table, countRow?.count ?? 0)
    }
    return counts
  })

/** 外部キーが閉じていない箇所（DB の制約と登録表の参照の両方）。閉じていれば空 */
export const findDanglingReferences = (databasePath: string): string[] =>
  withDatabase(databasePath, (db) => {
    const violations = db
      .prepare<[], { table: string; parent: string }>(
        "PRAGMA foreign_key_check"
      )
      .all()
      .map((violation) => `${violation.table} → ${violation.parent}`)
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
          violations.push(`${table}.${reference.column}: ${dangling.count}件`)
        }
      }
    }
    return violations
  })

const FILES_PREFIX = `${UNIFIED_ARCHIVE_FILES_DIR}/`

/**
 * ZIP を `workDirectory` の下へ展開して、取り込みに渡す形にする（開く側の守りと現行化は
 * 通さない）
 */
export const openArchiveForTest = (
  zipPath: string,
  manifest: OpenedUnifiedArchive["manifest"],
  workDirectory: string
): OpenedUnifiedArchive => {
  const openedDirectory = path.join(
    workDirectory,
    `opened-${crypto.randomUUID()}`
  )
  const filesDirectory = path.join(openedDirectory, UNIFIED_ARCHIVE_FILES_DIR)
  fs.mkdirSync(filesDirectory, { recursive: true })
  const databasePath = path.join(openedDirectory, UNIFIED_ARCHIVE_DATABASE_NAME)
  for (const entry of new AdmZip(zipPath).getEntries()) {
    if (entry.isDirectory) continue
    if (entry.entryName === UNIFIED_ARCHIVE_DATABASE_NAME) {
      fs.writeFileSync(databasePath, entry.getData())
    } else if (entry.entryName.startsWith(FILES_PREFIX)) {
      const relativePath = entry.entryName.slice(FILES_PREFIX.length)
      const filePath = path.join(filesDirectory, ...relativePath.split("/"))
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, entry.getData())
    }
  }
  return {
    manifest,
    databasePath,
    filesDirectory,
    appliedMigrations: [],
    migratedRowIds: {},
  }
}

/** 1本のトランザクションで行を取り込む */
export const importArchiveRows = (
  prisma: PrismaClient,
  archive: OpenedUnifiedArchive,
  action: ImportAction,
  importedAt: Date,
  decisions: UnifiedArchiveImportDecisions = {}
) =>
  prismaArchiveTransaction(
    prisma,
    IMPORT_TRANSACTION_TIMEOUT_MS
  )((target) =>
    importUnifiedArchiveRows(target, archive, action, importedAt, decisions)
  )

/**
 * 書いてからロールバックする試し取り込み。成績算出への影響の手がかりも、IPC の試し取り込みと
 * 同じく読む
 */
export const analyzeArchiveImportWithGradeImpact = (
  prisma: PrismaClient,
  archive: OpenedUnifiedArchive,
  action: ImportAction,
  importedAt: Date,
  decisions: UnifiedArchiveImportDecisions = {}
) =>
  analyzeUnifiedArchiveImport(
    prismaArchiveTransaction(prisma, IMPORT_TRANSACTION_TIMEOUT_MS),
    archive,
    action,
    decisions,
    importedAt,
    collectArchiveGradeImpactSource
  )

/** 書いてからロールバックする試し取り込みの、本番と同じ計算の結果 */
export const analyzeArchiveImport = async (
  prisma: PrismaClient,
  archive: OpenedUnifiedArchive,
  action: ImportAction,
  importedAt: Date,
  decisions: UnifiedArchiveImportDecisions = {}
) =>
  (
    await analyzeArchiveImportWithGradeImpact(
      prisma,
      archive,
      action,
      importedAt,
      decisions
    )
  ).result
