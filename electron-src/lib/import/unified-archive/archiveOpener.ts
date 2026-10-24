/**
 * 統合アーカイブ（.sao）を開き、守りを通し、中の DB を現行化する
 *
 * 設計は docs/unified-archive-design.md §4.1・§7.1 の1。アーカイブは外から来たファイルなので、
 * ZIP の項目名・manifest・DB のスキーマを1つずつ確かめてから触る。中の DB はメモリ上で
 * 確かめて現行化し、済んだものだけを呼び出し側が用意した一時ディレクトリへ書く（元の .sao には
 * 触らない）。ZIP は `archiveZipReader.ts`、DB の読み書きは `archiveDatabaseImage.ts` で、
 * デスクトップ版と web 版で同じコードが動く。
 *
 * electron（app・dataManager）には依存しない。migration の場所と、表・列を比べる相手の DB は
 * 呼び出し側が渡す。書き込み（取り込み先への反映）は `archiveRowImporter.ts` の仕事。
 */

import Database from "better-sqlite3"
import * as fsPromises from "fs/promises"
import * as path from "path"

import {
  UNIFIED_ARCHIVE_DATABASE_NAME,
  UNIFIED_ARCHIVE_FILES_DIR,
  UNIFIED_ARCHIVE_MANIFEST_NAME,
  type UnifiedArchiveManifest,
} from "../../../../src/types/unifiedArchive.types"
import {
  openDatabaseImage,
  writeDatabaseFile,
} from "../../export/unified-archive/archiveDatabaseImage"
import { ARCHIVE_TABLES } from "../../export/unified-archive/archiveTableRegistry"
import { BUNDLED_MIGRATIONS } from "../../prisma/schema/bundledMigrations"
import {
  applyMigrationSql,
  listAppliedMigrationNames,
  listLocalMigrationNames,
  type MigrationScript,
  recordAppliedMigration,
  sortMigrationsByName,
} from "../../prisma/schema/migrationApplier"
import { hasTable, type SqliteDatabase } from "../../prisma/sqliteSchemaUtils"
import { describeMistypedArchiveValues } from "./archiveColumnTypeGuards"
import { measureAvailableBytes } from "./archiveFreeSpace"
import { parseUnifiedArchiveManifest } from "./archiveManifestParser"
import { describeUnacceptableArchiveValues } from "./archiveValueGuards"
import {
  type ArchiveZip,
  type ArchiveZipEntry,
  ArchiveZipLimitError,
  type ArchiveZipLimits,
  DEFAULT_ARCHIVE_ZIP_LIMITS,
  formatByteSize,
  openArchiveZip,
} from "./archiveZipReader"
import type { OpenedUnifiedArchive } from "./types"

export type UnifiedArchiveOpenErrorKind =
  /** ZIP でない・manifest.json か archive.db が無い・ZIP の外へ出る名前・想定外の項目 */
  | "notArchive"
  /** 項目の数・伸張後の大きさ・縮み方が上限を超える（`archiveZipReader.ts` の上限） */
  | "tooLarge"
  /** 展開に要る大きさが、展開先の空きより大きい */
  | "insufficientSpace"
  /** manifest の形が違う */
  | "invalidManifest"
  /** format が違う、formatVersion がアプリの知る版より新しい */
  | "unsupportedFormat"
  /** archive.db にアプリが知らない migration が当たっている */
  | "newerSchema"
  /** integrity_check が ok でない、DB として読めない */
  | "corrupt"
  /** テーブル・索引以外（トリガー・ビュー）・仮想テーブル・生成列や隠し列がある */
  | "unsafeSchema"
  /** 現行化できない、現行化後の表・列が参照 DB と違う、外部キーが閉じていない */
  | "schemaMismatch"
  /** id かファイルのパスの値が、アプリの書く形でない（`archiveValueGuards.ts`） */
  | "unsafeValues"
  /** 列の型（Prisma のスキーマの型）に合わない値がある（`archiveColumnTypeGuards.ts`） */
  | "mistypedValues"

const OPEN_ERROR_MESSAGES: Record<UnifiedArchiveOpenErrorKind, string> = {
  notArchive: "統合アーカイブのファイルではありません",
  tooLarge: "アーカイブが大きすぎるか、中身の大きさが不自然です",
  insufficientSpace: "アーカイブを展開するための空き容量が足りません",
  invalidManifest: "アーカイブの manifest.json の形が正しくありません",
  unsupportedFormat: "このアプリでは読めない形式のアーカイブです",
  newerSchema:
    "このアーカイブは新しいバージョンのアプリで書き出されています。アプリを更新してから開いてください",
  corrupt: "アーカイブのデータベースが壊れています",
  unsafeSchema:
    "アーカイブのデータベースに、想定外のトリガー・ビュー・仮想テーブル・生成列があります",
  schemaMismatch:
    "アーカイブのデータベースを、このアプリのスキーマに揃えられませんでした",
  unsafeValues:
    "アーカイブのデータベースに、このアプリが書き出さない形の id かファイルの場所があります",
  mistypedValues: "アーカイブのデータベースに、列の型に合わない値があります",
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

interface OpenUnifiedArchiveOptions {
  archivePath: string
  /** 展開先。空か無いこと。呼び出し側が用意し、呼び出し側が消す */
  workDirectory: string
  /** 当てるマイグレーション。省略するとアプリに束ねた一覧（テストは合成したものを渡す） */
  migrations?: readonly MigrationScript[]
  /** 表・列を比べる相手（本番は取り込み先のライブ DB）。読み取り専用で開く */
  referenceDatabasePath: string
  /** ZIP の大きさの上限。省略すると既定（テストは小さくして確かめる） */
  zipLimits?: ArchiveZipLimits
  /** 展開先の空きを測る。省略すると `archiveFreeSpace.ts`（テストは差し替える） */
  measureAvailableBytes?: (directory: string) => Promise<number | null>
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

/**
 * ZIP の項目を確かめてから展開する。展開先から外へ出るものは1つも書かない。
 * archive.db は書かずに中身を返す（確かめて現行化してから書く）
 */
const extractArchive = async (
  archivePath: string,
  workDirectory: string,
  zipLimits: ArchiveZipLimits,
  measureSpace: (directory: string) => Promise<number | null>
): Promise<Uint8Array> => {
  let archiveZip: ArchiveZip
  try {
    archiveZip = await openArchiveZip(archivePath, zipLimits)
  } catch (error) {
    if (error instanceof ArchiveZipLimitError) {
      throw new UnifiedArchiveOpenError("tooLarge", [error.message])
    }
    throw new UnifiedArchiveOpenError("notArchive", [errorMessageOf(error)])
  }
  try {
    return await extractEntries(archiveZip, workDirectory, measureSpace)
  } finally {
    await archiveZip.close()
  }
}

/**
 * 展開に要る大きさ（記録された伸張後の大きさの合計）が、展開先の空きに収まることを確かめる。
 * archive.db はメモリで現行化してから書くが、同じだけ要るので合計に含める。測れなければ断らない
 */
const assertEnoughSpace = async (
  archiveZip: ArchiveZip,
  workDirectory: string,
  measureSpace: (directory: string) => Promise<number | null>
): Promise<void> => {
  const availableBytes = await measureSpace(workDirectory)
  if (
    availableBytes !== null &&
    archiveZip.totalUncompressedBytes > availableBytes
  ) {
    throw new UnifiedArchiveOpenError("insufficientSpace", [
      `展開に約${formatByteSize(archiveZip.totalUncompressedBytes)}必要で、空きは約${formatByteSize(availableBytes)}`,
    ])
  }
}

const extractEntries = async (
  archiveZip: ArchiveZip,
  workDirectory: string,
  measureSpace: (directory: string) => Promise<number | null>
): Promise<Uint8Array> => {
  const { entries } = archiveZip
  const problems: string[] = []
  const seenNames = new Set<string>()
  const filesToWrite: { entry: ArchiveZipEntry; segments: string[] }[] = []
  for (const entry of entries) {
    const split = splitEntryName(entry.name)
    if ("problem" in split) {
      problems.push(`${entry.name}: ${split.problem}`)
      continue
    }
    if (!isExpectedEntry(split.segments, entry.isDirectory)) {
      problems.push(`${entry.name}: 想定外の項目`)
      continue
    }
    const normalizedName = split.segments.join("/")
    if (seenNames.has(normalizedName)) {
      problems.push(`${entry.name}: 同じ名前の項目が複数ある`)
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
  // 1つも伸ばす前に、空きと比べる
  await assertEnoughSpace(archiveZip, workDirectory, measureSpace)

  const root = path.resolve(workDirectory)
  let databaseImage: Uint8Array | null = null
  for (const { entry, segments } of filesToWrite) {
    const targetPath = path.resolve(root, ...segments)
    const relativePath = path.relative(root, targetPath)
    // 名前の検査で弾いているが、書く直前にもう一度確かめる
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new UnifiedArchiveOpenError("notArchive", [
        `${entry.name}: 展開先の外を指す`,
      ])
    }
    let content: Uint8Array
    try {
      content = await entry.read()
    } catch (error) {
      throw new UnifiedArchiveOpenError("notArchive", [
        `${entry.name}: ${errorMessageOf(error)}`,
      ])
    }
    if (segments.join("/") === UNIFIED_ARCHIVE_DATABASE_NAME) {
      databaseImage = content
      continue
    }
    await fsPromises.mkdir(path.dirname(targetPath), { recursive: true })
    await fsPromises.writeFile(targetPath, content, { flag: "wx" })
  }
  if (databaseImage === null) {
    throw new UnifiedArchiveOpenError("notArchive", [
      `${UNIFIED_ARCHIVE_DATABASE_NAME} が無い`,
    ])
  }
  return databaseImage
}

// ── 2. manifest ───────────────────────────────────────────

const readManifest = async (
  manifestPath: string
): Promise<UnifiedArchiveManifest> => {
  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(await fsPromises.readFile(manifestPath, "utf-8"))
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

/**
 * スキーマが普通の表と索引だけでできていることを確かめる（integrity_check より前に呼ぶ。
 * 仮想テーブルは、検査や読み出しのときに拡張のコードを動かしうる）。
 *
 * - トリガー・ビューを断る
 * - 仮想テーブルを断る（CREATE VIRTUAL TABLE で作られ、ページを持たない）
 * - 生成列・隠し列（`pragma_table_xinfo` の hidden が 0 でない列）を断る。アプリの
 *   スキーマには無く、値が式から作られる
 */
const assertOnlyTablesAndIndexes = (db: SqliteDatabase): void => {
  const unsafeObjects = db
    .prepare<[], { type: string; name: string }>(
      "SELECT type, name FROM sqlite_master WHERE type NOT IN ('table', 'index')"
    )
    .all()
    .map((object) => `${object.type} ${object.name}`)
  const virtualTables = db
    .prepare<[], { name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND (rootpage = 0 OR sql LIKE 'CREATE VIRTUAL TABLE%')"
    )
    .all()
    .map((table) => `virtual table ${table.name}`)
  if (unsafeObjects.length > 0 || virtualTables.length > 0) {
    throw new UnifiedArchiveOpenError("unsafeSchema", [
      ...unsafeObjects,
      ...virtualTables,
    ])
  }
  const hiddenColumns = db
    .prepare<[], { tableName: string; columnName: string }>(
      `SELECT master.name AS tableName, columnInfo.name AS columnName
       FROM sqlite_master AS master, pragma_table_xinfo(master.name) AS columnInfo
       WHERE master.type = 'table' AND columnInfo.hidden <> 0`
    )
    .all()
    .map((column) => `hidden column ${column.tableName}.${column.columnName}`)
  if (hiddenColumns.length > 0) {
    throw new UnifiedArchiveOpenError("unsafeSchema", hiddenColumns)
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
  migrations: readonly MigrationScript[],
  appliedNames: ReadonlySet<string>
): string[] => {
  const pendingMigrations = sortMigrationsByName(migrations).filter(
    (migration) => !appliedNames.has(migration.name)
  )
  for (const { name, sql } of pendingMigrations) {
    const startedAt = new Date().toISOString()
    try {
      applyMigrationSql(db, sql)
      recordAppliedMigration(db, name, sql, startedAt)
    } catch (error) {
      throw new UnifiedArchiveOpenError("schemaMismatch", [
        `migration ${name} を適用できない: ${errorMessageOf(error)}`,
      ])
    }
  }
  return pendingMigrations.map((migration) => migration.name)
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

/**
 * 登録表（`archiveTableRegistry.ts`）に無い表の名前（現行化の後に見る）。`_prisma_migrations` と
 * SQLite 自身の表（`sqlite_` で始まる）だけは許す。`_` で始まる表は参照 DB との比較
 * （`readApplicationColumns`）に載らないので、ここで断る
 */
const describeUnregisteredTables = (db: SqliteDatabase): string[] =>
  db
    .prepare<[], { name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\'"
    )
    .all()
    .map((tableRow) => tableRow.name)
    .filter((name) => name !== "_prisma_migrations" && !ARCHIVE_TABLES[name])
    .map((name) => `表 ${name} が登録表に無い`)

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
export async function openUnifiedArchive(
  options: OpenUnifiedArchiveOptions
): Promise<OpenedUnifiedArchive> {
  const { workDirectory } = options
  const migrations = options.migrations ?? BUNDLED_MIGRATIONS
  await fsPromises.mkdir(workDirectory, { recursive: true })
  if ((await fsPromises.readdir(workDirectory)).length > 0) {
    throw new Error(`展開先が空ではありません: ${workDirectory}`)
  }

  const databaseImage = await extractArchive(
    options.archivePath,
    workDirectory,
    options.zipLimits ?? DEFAULT_ARCHIVE_ZIP_LIMITS,
    options.measureAvailableBytes ?? measureAvailableBytes
  )
  const manifest = await readManifest(
    path.join(workDirectory, UNIFIED_ARCHIVE_MANIFEST_NAME)
  )
  const filesDirectory = path.join(workDirectory, UNIFIED_ARCHIVE_FILES_DIR)
  await fsPromises.mkdir(filesDirectory, { recursive: true })

  const databasePath = path.join(workDirectory, UNIFIED_ARCHIVE_DATABASE_NAME)
  const localNames = listLocalMigrationNames(migrations)
  let db: SqliteDatabase
  try {
    db = openDatabaseImage(databaseImage, { readonly: false })
  } catch (error) {
    throw asCorruptUnlessOpenError(error)
  }
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
      migrations,
      appliedNames
    )
    const migratedRowIds = diffRegisteredIds(idsBefore, readRegisteredIds(db))

    const mismatches = [
      ...describeUnregisteredTables(db),
      ...describeSchemaDifferences(
        readApplicationColumns(db),
        readReferenceColumns(options.referenceDatabasePath)
      ),
      ...describeForeignKeyViolations(db),
    ]
    if (mismatches.length > 0) {
      throw new UnifiedArchiveOpenError("schemaMismatch", mismatches)
    }

    // 行の値の守り。id とファイルのパスは、取り込み・差し替え・削除でデータフォルダの中の
    // 場所を決めるので、アプリの書く形のものだけを通す（現行化の後の値で確かめる）
    const unacceptableValues = describeUnacceptableArchiveValues(db)
    if (unacceptableValues.length > 0) {
      throw new UnifiedArchiveOpenError("unsafeValues", unacceptableValues)
    }
    // 列の型の守り。SQLite の表は STRICT でないので、型の違う値も入る
    const mistypedValues = describeMistypedArchiveValues(db)
    if (mistypedValues.length > 0) {
      throw new UnifiedArchiveOpenError("mistypedValues", mistypedValues)
    }

    await writeDatabaseFile(db, databasePath, { exclusive: true })
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
