/**
 * 統合アーカイブ（.sao）を開き、守りを通し、中の DB を現行化する
 *
 * 設計は docs/unified-archive-design.md §4.1・§7.1 の1。アーカイブは外から来たファイルなので、
 * ZIP の項目名・manifest・DB のスキーマを1つずつ確かめてから触る。中の DB は呼び出し側が
 * 用意した一時ディレクトリへ展開した複製だけを書き換える（元の .sao には触らない）。
 *
 * electron（app・dataManager）には依存しない。migration の場所と、表・列を比べる相手の DB は
 * 呼び出し側が渡す。書き込み（取り込み先への反映）は `archiveRowImporter.ts` の仕事。
 */

import AdmZip from "adm-zip"
import Database from "better-sqlite3"
import * as fs from "fs"
import * as path from "path"

import {
  UNIFIED_ARCHIVE_DATABASE_NAME,
  UNIFIED_ARCHIVE_FILES_DIR,
  UNIFIED_ARCHIVE_MANIFEST_NAME,
  type UnifiedArchiveManifest,
} from "../../../../src/types/unifiedArchive.types"
import { ARCHIVE_TABLES } from "../../export/unified-archive/archiveTableRegistry"
import {
  applyMigrationSql,
  listAppliedMigrationNames,
  listLocalMigrationNames,
  recordAppliedMigration,
} from "../../prisma/schema/migrationApplier"
import { hasTable, type SqliteDatabase } from "../../prisma/sqliteSchemaUtils"
import { parseUnifiedArchiveManifest } from "./archiveManifestParser"
import type { OpenedUnifiedArchive } from "./types"

export type UnifiedArchiveOpenErrorKind =
  /** ZIP でない・manifest.json か archive.db が無い・ZIP の外へ出る名前・想定外の項目 */
  | "notArchive"
  /** manifest の形が違う */
  | "invalidManifest"
  /** format が違う、formatVersion がアプリの知る版より新しい */
  | "unsupportedFormat"
  /** archive.db にアプリが知らない migration が当たっている */
  | "newerSchema"
  /** integrity_check が ok でない、DB として読めない */
  | "corrupt"
  /** テーブル・索引以外（トリガー・ビュー）がある */
  | "unsafeSchema"
  /** 現行化できない、現行化後の表・列が参照 DB と違う、外部キーが閉じていない */
  | "schemaMismatch"

const OPEN_ERROR_MESSAGES: Record<UnifiedArchiveOpenErrorKind, string> = {
  notArchive: "統合アーカイブのファイルではありません",
  invalidManifest: "アーカイブの manifest.json の形が正しくありません",
  unsupportedFormat: "このアプリでは読めない形式のアーカイブです",
  newerSchema:
    "このアーカイブは新しいバージョンのアプリで書き出されています。アプリを更新してから開いてください",
  corrupt: "アーカイブのデータベースが壊れています",
  unsafeSchema:
    "アーカイブのデータベースに、想定外のトリガーかビューがあります",
  schemaMismatch:
    "アーカイブのデータベースを、このアプリのスキーマに揃えられませんでした",
}

export class UnifiedArchiveOpenError extends Error {
  readonly kind: UnifiedArchiveOpenErrorKind
  readonly details: readonly string[]

  constructor(kind: UnifiedArchiveOpenErrorKind, details: readonly string[]) {
    super(
      details.length > 0
        ? `${OPEN_ERROR_MESSAGES[kind]}（${details.join(" / ")}）`
        : OPEN_ERROR_MESSAGES[kind]
    )
    this.name = "UnifiedArchiveOpenError"
    this.kind = kind
    this.details = details
  }
}

export interface OpenUnifiedArchiveOptions {
  archivePath: string
  /** 展開先。空か無いこと。呼び出し側が用意し、呼び出し側が消す */
  workDirectory: string
  /** アプリ同梱の prisma/migrations */
  migrationsDir: string
  /** 表・列を比べる相手（本番は取り込み先のライブ DB）。読み取り専用で開く */
  referenceDatabasePath: string
}

const quote = (identifier: string): string =>
  `"${identifier.replaceAll('"', '""')}"`

const errorMessageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

// ── 1. ZIP ────────────────────────────────────────────────

/** ZIP の項目名を区切りごとに分ける。外へ出うる・想定外の名前なら理由を返す */
const splitEntryName = (
  entryName: string
): { segments: string[] } | { problem: string } => {
  if (entryName.includes("\\")) return { problem: "「\\」を含む" }
  if (entryName.includes("\0")) return { problem: "NUL を含む" }
  if (entryName.startsWith("/") || /^[A-Za-z]:/.test(entryName)) {
    return { problem: "絶対パス" }
  }
  // ディレクトリの項目は末尾が "/"
  const segments = entryName.replace(/\/$/, "").split("/")
  if (
    segments.some(
      (segment) => segment === "" || segment === "." || segment === ".."
    )
  ) {
    return { problem: "空・「.」・「..」の区切りを含む" }
  }
  return { segments }
}

const isExpectedEntry = (segments: readonly string[], isDirectory: boolean) => {
  const [head, ...rest] = segments
  if (head === UNIFIED_ARCHIVE_FILES_DIR) return isDirectory || rest.length > 0
  return (
    !isDirectory &&
    rest.length === 0 &&
    (head === UNIFIED_ARCHIVE_MANIFEST_NAME ||
      head === UNIFIED_ARCHIVE_DATABASE_NAME)
  )
}

/** ZIP の項目を確かめてから展開する。展開先から外へ出るものは1つも書かない */
const extractArchive = (archivePath: string, workDirectory: string): void => {
  let entries: AdmZip.IZipEntry[]
  try {
    entries = new AdmZip(archivePath).getEntries()
  } catch (error) {
    throw new UnifiedArchiveOpenError("notArchive", [errorMessageOf(error)])
  }

  const problems: string[] = []
  const seenNames = new Set<string>()
  const filesToWrite: { entry: AdmZip.IZipEntry; segments: string[] }[] = []
  for (const entry of entries) {
    const split = splitEntryName(entry.entryName)
    if ("problem" in split) {
      problems.push(`${entry.entryName}: ${split.problem}`)
      continue
    }
    if (!isExpectedEntry(split.segments, entry.isDirectory)) {
      problems.push(`${entry.entryName}: 想定外の項目`)
      continue
    }
    const normalizedName = split.segments.join("/")
    if (seenNames.has(normalizedName)) {
      problems.push(`${entry.entryName}: 同じ名前の項目が複数ある`)
      continue
    }
    seenNames.add(normalizedName)
    if (!entry.isDirectory)
      filesToWrite.push({ entry, segments: split.segments })
  }
  for (const requiredName of [
    UNIFIED_ARCHIVE_MANIFEST_NAME,
    UNIFIED_ARCHIVE_DATABASE_NAME,
  ]) {
    if (!seenNames.has(requiredName)) problems.push(`${requiredName} が無い`)
  }
  if (problems.length > 0) {
    throw new UnifiedArchiveOpenError("notArchive", problems)
  }

  const root = path.resolve(workDirectory)
  for (const { entry, segments } of filesToWrite) {
    const targetPath = path.resolve(root, ...segments)
    const relativePath = path.relative(root, targetPath)
    // 名前の検査で弾いているが、書く直前にもう一度確かめる
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new UnifiedArchiveOpenError("notArchive", [
        `${entry.entryName}: 展開先の外を指す`,
      ])
    }
    let content: Buffer
    try {
      content = entry.getData()
    } catch (error) {
      throw new UnifiedArchiveOpenError("notArchive", [
        `${entry.entryName}: ${errorMessageOf(error)}`,
      ])
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.writeFileSync(targetPath, content, { flag: "wx" })
  }
}

// ── 2. manifest ───────────────────────────────────────────

const readManifest = (manifestPath: string): UnifiedArchiveManifest => {
  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))
  } catch (error) {
    throw new UnifiedArchiveOpenError("invalidManifest", [
      `JSON として読めない: ${errorMessageOf(error)}`,
    ])
  }
  const parsed = parseUnifiedArchiveManifest(parsedJson)
  if (parsed.kind !== "parsed") {
    throw new UnifiedArchiveOpenError(parsed.kind, parsed.details)
  }
  return parsed.manifest
}

// ── 3〜4. スキーマの守りと壊れの検査 ─────────────────────

const assertOnlyTablesAndIndexes = (db: SqliteDatabase): void => {
  const unsafeObjects = db
    .prepare<[], { type: string; name: string }>(
      "SELECT type, name FROM sqlite_master WHERE type NOT IN ('table', 'index')"
    )
    .all()
  if (unsafeObjects.length > 0) {
    throw new UnifiedArchiveOpenError(
      "unsafeSchema",
      unsafeObjects.map((object) => `${object.type} ${object.name}`)
    )
  }
}

const assertIntegrity = (db: SqliteDatabase): void => {
  const results = db
    .prepare<[], { integrity_check: string }>("PRAGMA integrity_check")
    .all()
    .map((row) => row.integrity_check)
  if (results.length !== 1 || results[0] !== "ok") {
    throw new UnifiedArchiveOpenError("corrupt", results)
  }
}

/**
 * DB として読めないファイル（SQLITE_NOTADB・SQLITE_CORRUPT）は、どの検査で出ても「壊れている」。
 * 守りの検査そのものが投げた `UnifiedArchiveOpenError` はそのまま通す
 */
const asCorruptUnlessOpenError = (error: unknown): Error => {
  if (error instanceof UnifiedArchiveOpenError) return error
  return new UnifiedArchiveOpenError("corrupt", [errorMessageOf(error)])
}

// ── 5〜6. 版の確認と現行化 ───────────────────────────────

const assertKnownMigrations = (
  db: SqliteDatabase,
  localNames: readonly string[]
): Set<string> => {
  if (!hasTable(db, "_prisma_migrations")) {
    throw new UnifiedArchiveOpenError("notArchive", [
      "archive.db に _prisma_migrations が無い",
    ])
  }
  const appliedNames = listAppliedMigrationNames(db)
  const localNameSet = new Set(localNames)
  // アプリの最新より新しい名前だけを未知とする（起動時の `assertDatabaseNotNewerThanApp` と同じ規則）。
  // それより古い未知の名前は、後で改名された migration の適用記録が残ったもの
  // （実データに 20260725140000_drop_crop_region_marking_override → 160000 がある）で、
  // そのアプリの DB 自体が起動できている以上、版としては古い側にある
  const latestLocalName = localNames.at(-1) ?? ""
  const unknownNames = [...appliedNames]
    .filter((name) => !localNameSet.has(name) && name > latestLocalName)
    .sort()
  if (unknownNames.length > 0) {
    throw new UnifiedArchiveOpenError("newerSchema", unknownNames)
  }
  return appliedNames
}

const hasIdColumn = (db: SqliteDatabase, table: string): boolean =>
  db
    .prepare<[string], { name: string }>(
      "SELECT name FROM pragma_table_info(?) WHERE name = 'id'"
    )
    .get(table) !== undefined

/** 登録表の各表の id の集合。表（か id 列）が無ければ空 */
const readRegisteredIds = (db: SqliteDatabase): Map<string, Set<string>> => {
  const idsByTable = new Map<string, Set<string>>()
  for (const table of Object.keys(ARCHIVE_TABLES)) {
    if (!hasTable(db, table) || !hasIdColumn(db, table)) {
      idsByTable.set(table, new Set())
      continue
    }
    const ids = db
      .prepare<[], { id: string }>(`SELECT id FROM ${quote(table)}`)
      .all()
      .map((row) => String(row.id))
    idsByTable.set(table, new Set(ids))
  }
  return idsByTable
}

/** 現行化の前後の id 集合の差（生まれた行）。行の生まれていない表は載せない */
const diffRegisteredIds = (
  before: ReadonlyMap<string, ReadonlySet<string>>,
  after: ReadonlyMap<string, ReadonlySet<string>>
): Record<string, string[]> => {
  const migratedRowIds: Record<string, string[]> = {}
  for (const [table, afterIds] of after) {
    const beforeIds = before.get(table) ?? new Set<string>()
    const createdIds = [...afterIds].filter((id) => !beforeIds.has(id)).sort()
    if (createdIds.length > 0) migratedRowIds[table] = createdIds
  }
  return migratedRowIds
}

/** 不足ぶんの migration を名前順に、アプリ起動時と同じ当て方で当てる */
const applyPendingMigrations = (
  db: SqliteDatabase,
  migrationsDir: string,
  localNames: readonly string[],
  appliedNames: ReadonlySet<string>
): string[] => {
  const pendingNames = localNames.filter(
    (name) =>
      !appliedNames.has(name) &&
      fs.existsSync(path.join(migrationsDir, name, "migration.sql"))
  )
  for (const name of pendingNames) {
    const sql = fs.readFileSync(
      path.join(migrationsDir, name, "migration.sql"),
      "utf-8"
    )
    const startedAt = new Date().toISOString()
    try {
      applyMigrationSql(db, sql)
      recordAppliedMigration(db, name, sql, startedAt)
    } catch (error) {
      throw new UnifiedArchiveOpenError("schemaMismatch", [
        `migration ${name} を当てられない: ${errorMessageOf(error)}`,
      ])
    }
  }
  return pendingNames
}

// ── 7. 参照 DB との一致 ──────────────────────────────────

/** `_` で始まらない・`sqlite_` で始まらない表の、表名 → 列名の集合 */
const readApplicationColumns = (
  db: SqliteDatabase
): Map<string, Set<string>> => {
  const tableNames = db
    .prepare<[], { name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' AND name NOT LIKE '\\_%' ESCAPE '\\'"
    )
    .all()
    .map((tableRow) => tableRow.name)
  const columnsByTable = new Map<string, Set<string>>()
  for (const tableName of tableNames) {
    const columnNames = db
      .prepare<[string], { name: string }>(
        "SELECT name FROM pragma_table_info(?)"
      )
      .all(tableName)
      .map((column) => column.name)
    columnsByTable.set(tableName, new Set(columnNames))
  }
  return columnsByTable
}

const readReferenceColumns = (
  referenceDatabasePath: string
): Map<string, Set<string>> => {
  const reference = new Database(referenceDatabasePath, {
    readonly: true,
    fileMustExist: true,
  })
  try {
    return readApplicationColumns(reference)
  } finally {
    reference.close()
  }
}

const describeSchemaDifferences = (
  archiveColumns: ReadonlyMap<string, ReadonlySet<string>>,
  referenceColumns: ReadonlyMap<string, ReadonlySet<string>>
): string[] => {
  const differences: string[] = []
  for (const [table, columns] of referenceColumns) {
    const archiveTableColumns = archiveColumns.get(table)
    if (!archiveTableColumns) {
      differences.push(`表 ${table} がアーカイブに無い`)
      continue
    }
    for (const column of columns) {
      if (!archiveTableColumns.has(column)) {
        differences.push(`列 ${table}.${column} がアーカイブに無い`)
      }
    }
    for (const column of archiveTableColumns) {
      if (!columns.has(column)) {
        differences.push(`列 ${table}.${column} が取り込み先に無い`)
      }
    }
  }
  for (const table of archiveColumns.keys()) {
    if (!referenceColumns.has(table)) {
      differences.push(`表 ${table} が取り込み先に無い`)
    }
  }
  return differences
}

/** 外部キーの違反を、表 → 参照先ごとの件数にまとめる */
const describeForeignKeyViolations = (db: SqliteDatabase): string[] => {
  const violationCounts = new Map<string, number>()
  for (const violation of db
    .prepare<[], { table: string; parent: string }>("PRAGMA foreign_key_check")
    .all()) {
    const key = `${violation.table} → ${violation.parent}`
    violationCounts.set(key, (violationCounts.get(key) ?? 0) + 1)
  }
  return [...violationCounts].map(
    ([key, count]) => `外部キーの違反 ${key}: ${count}件`
  )
}

// ── 全体 ─────────────────────────────────────────────────

/**
 * 統合アーカイブを `workDirectory` へ展開し、守り（§4.1）を通して中の DB を現行化する。
 * 守りに掛かれば `UnifiedArchiveOpenError` を投げる（展開したものは呼び出し側が消す）
 */
export function openUnifiedArchive(
  options: OpenUnifiedArchiveOptions
): OpenedUnifiedArchive {
  const { workDirectory, migrationsDir } = options
  fs.mkdirSync(workDirectory, { recursive: true })
  if (fs.readdirSync(workDirectory).length > 0) {
    throw new Error(`展開先が空ではありません: ${workDirectory}`)
  }

  extractArchive(options.archivePath, workDirectory)
  const manifest = readManifest(
    path.join(workDirectory, UNIFIED_ARCHIVE_MANIFEST_NAME)
  )
  const filesDirectory = path.join(workDirectory, UNIFIED_ARCHIVE_FILES_DIR)
  fs.mkdirSync(filesDirectory, { recursive: true })

  const databasePath = path.join(workDirectory, UNIFIED_ARCHIVE_DATABASE_NAME)
  const localNames = listLocalMigrationNames(migrationsDir)
  const db = new Database(databasePath, { fileMustExist: true })
  try {
    let appliedNames: Set<string>
    let idsBefore: Map<string, Set<string>>
    try {
      // スキーマに埋め込まれた関数を、読むだけで走らせない
      db.pragma("trusted_schema = OFF")
      assertOnlyTablesAndIndexes(db)
      assertIntegrity(db)
      appliedNames = assertKnownMigrations(db, localNames)
      idsBefore = readRegisteredIds(db)
    } catch (error) {
      throw asCorruptUnlessOpenError(error)
    }

    const appliedMigrations = applyPendingMigrations(
      db,
      migrationsDir,
      localNames,
      appliedNames
    )
    const migratedRowIds = diffRegisteredIds(idsBefore, readRegisteredIds(db))

    const mismatches = [
      ...describeSchemaDifferences(
        readApplicationColumns(db),
        readReferenceColumns(options.referenceDatabasePath)
      ),
      ...describeForeignKeyViolations(db),
    ]
    if (mismatches.length > 0) {
      throw new UnifiedArchiveOpenError("schemaMismatch", mismatches)
    }

    return {
      manifest,
      databasePath,
      filesDirectory,
      appliedMigrations,
      migratedRowIds,
    }
  } finally {
    db.close()
  }
}
