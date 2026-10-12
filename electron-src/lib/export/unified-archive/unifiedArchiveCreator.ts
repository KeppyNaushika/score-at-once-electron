/**
 * 統合アーカイブ（.sao）を書き出す
 *
 * 範囲を決め（`archiveScopeResolver.ts`）、範囲の行だけを持つ DB をメモリ上に作り
 * （`archiveDatabaseWriter.ts`）、その DB が指すファイルと manifest.json を ZIP に詰める
 * （`archiveZipWriter.ts`）。ZIP の形は docs/unified-archive-design.md §4。
 *
 * デスクトップ版（main の作業者）と web 版（Worker）で同じコードが動く。ファイルは
 * `fs/promises` だけで読み書きし、作業用の一時ファイルは作らない。
 *
 * electron（app・dataManager）には依存しない。DB とデータディレクトリの場所、アプリの版は
 * 呼び出し側が渡す。
 */

import Database from "better-sqlite3"
import * as fsPromises from "fs/promises"
import * as path from "path"

import {
  UNIFIED_ARCHIVE_DATABASE_NAME,
  UNIFIED_ARCHIVE_FORMAT,
  UNIFIED_ARCHIVE_FORMAT_VERSION,
  UNIFIED_ARCHIVE_MANIFEST_NAME,
  type UnifiedArchiveManifest,
  type UnifiedArchiveMissingFile,
} from "../../../../src/types/unifiedArchive.types"
import { pathExists } from "../../pathExists"
import { hasTable, type SqliteDatabase } from "../../prisma/sqliteSchemaUtils"
import { buildArchiveDatabase } from "./archiveDatabaseWriter"
import {
  collectArchiveFilePaths,
  resolveArchiveFile,
} from "./archiveFileCollector"
import {
  type ArchiveScope,
  type ArchiveSelection,
  loadScopeRows,
  resolveArchiveScope,
} from "./archiveScopeResolver"
import { createArchiveZipWriter } from "./archiveZipWriter"

export type UnifiedArchiveExportPhase =
  "resolvingScope" | "writingDatabase" | "packing"

export interface CreateUnifiedArchiveOptions {
  sourceDatabasePath: string
  /** DB のファイルパス（imagePath など）の基点 */
  dataDirectory: string
  /** 既にあれば失敗する（上書きしない） */
  outputPath: string
  selection: ArchiveSelection
  exportedByUserId: string | null
  appVersion: string
  onProgress?: (phase: UnifiedArchiveExportPhase) => void
  /** テスト用。既定は現在時刻 */
  now?: () => Date
}

export interface UnifiedArchiveExportResult {
  outputPath: string
  manifest: UnifiedArchiveManifest
}

/** ZIP に詰めるファイル1つ */
interface PackedFile {
  readonly absolutePath: string
  readonly zipPath: string
}

/** 書き出した archive.db から読む、manifest とファイルの材料 */
interface ArchiveDatabaseContents {
  readonly lastMigration: string | null
  readonly rowCounts: Record<string, number>
  readonly filePaths: string[]
}

const quote = (identifier: string): string =>
  `"${identifier.replaceAll('"', '""')}"`

/** 元の DB を読むだけの接続で開き、範囲を決める */
const resolveScopeFromSource = (
  sourceDatabasePath: string,
  selection: ArchiveSelection
): ArchiveScope => {
  const source = new Database(sourceDatabasePath, {
    readonly: true,
    fileMustExist: true,
  })
  try {
    return resolveArchiveScope(loadScopeRows(source), selection)
  } finally {
    source.close()
  }
}

/**
 * 適用済みの最後の migration 名。`migrationDeployer` の適用済み判定（rolled_back_at IS NULL）に
 * 加えて、終わっていないもの（finished_at IS NULL）も除く
 */
const readLastMigration = (db: SqliteDatabase): string | null => {
  if (!hasTable(db, "_prisma_migrations")) return null
  const latest = db
    .prepare<[], { migrationName: string | null }>(
      `SELECT MAX("migration_name") AS migrationName FROM "_prisma_migrations"
       WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL`
    )
    .get()
  return latest?.migrationName ?? null
}

/** 表ごとの行数（0 の表と `_prisma_migrations` は載せない） */
const readRowCounts = (db: SqliteDatabase): Record<string, number> => {
  const tableNames = db
    .prepare<[], { name: string }>(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations'
       ORDER BY name`
    )
    .all()
    .map((tableRow) => tableRow.name)
  const rowCounts: Record<string, number> = {}
  for (const tableName of tableNames) {
    const counted = db
      .prepare<[], { count: number }>(
        `SELECT COUNT(*) AS count FROM ${quote(tableName)}`
      )
      .get()
    if (counted && counted.count > 0) rowCounts[tableName] = counted.count
  }
  return rowCounts
}

const readArchiveDatabase = (
  archive: SqliteDatabase
): ArchiveDatabaseContents => ({
  lastMigration: readLastMigration(archive),
  rowCounts: readRowCounts(archive),
  filePaths: collectArchiveFilePaths(archive),
})

/**
 * DB が指すファイルを、同梱するものと欠けているものに分ける。欠けていても書き出しは続け、
 * 結果と manifest で知らせる（今の5種と同じ）。別の書き方で同じファイルを指すパスは1つにまとめる
 */
const resolveFiles = async (
  dataDirectory: string,
  filePaths: readonly string[]
): Promise<{ packed: PackedFile[]; missing: UnifiedArchiveMissingFile[] }> => {
  const packedByZipPath = new Map<string, PackedFile>()
  const missing: UnifiedArchiveMissingFile[] = []
  for (const filePath of filePaths) {
    const resolved = resolveArchiveFile(dataDirectory, filePath)
    if (resolved.kind === "outsideDataDirectory") {
      missing.push({ path: filePath, reason: "outsideDataDirectory" })
      continue
    }
    const fileStat = await fsPromises
      .stat(resolved.absolutePath)
      .catch(() => null)
    if (!fileStat?.isFile()) {
      missing.push({ path: filePath, reason: "notFound" })
      continue
    }
    packedByZipPath.set(resolved.zipPath, {
      absolutePath: resolved.absolutePath,
      zipPath: resolved.zipPath,
    })
  }
  return { packed: [...packedByZipPath.values()], missing }
}

/** 空の配列を落とし、読み取り専用の配列を書き換えられる写しにする */
const nonEmptyIdLists = (
  idsByTable: Readonly<Record<string, readonly string[] | undefined>>
): Record<string, string[]> => {
  const idLists: Record<string, string[]> = {}
  for (const [table, ids] of Object.entries(idsByTable)) {
    if (ids && ids.length > 0) idLists[table] = [...ids]
  }
  return idLists
}

const buildManifest = (
  options: CreateUnifiedArchiveOptions,
  scope: ArchiveScope,
  contents: ArchiveDatabaseContents,
  files: { packed: PackedFile[]; missing: UnifiedArchiveMissingFile[] },
  exportedAt: Date
): UnifiedArchiveManifest => {
  const { selection } = options
  return {
    format: UNIFIED_ARCHIVE_FORMAT,
    formatVersion: UNIFIED_ARCHIVE_FORMAT_VERSION,
    appVersion: options.appVersion,
    lastMigration: contents.lastMigration,
    exportedAt: exportedAt.toISOString(),
    exportedByUserId: options.exportedByUserId,
    selection: {
      roots: nonEmptyIdLists(selection.roots),
      shared: nonEmptyIdLists(selection.shared ?? {}),
      scoring: selection.scoring ?? { kind: "all" },
      includeAnswers: selection.includeAnswers ?? true,
      optionalItems: [...(selection.optionalItems ?? [])],
    },
    exclusions: {
      requested: nonEmptyIdLists(selection.exclusions ?? {}),
      excludedRowCounts: { ...scope.excludedRowCounts },
    },
    rowCounts: contents.rowCounts,
    files: { count: files.packed.length, missing: files.missing },
  }
}

/**
 * ZIP を書く。失敗したら作りかけの出力を消してから投げる。出力は `wx` で作り、
 * 確かめたあとに別の誰かが置いたファイルを上書きしない（その場合は消しもしない）
 */
const packArchive = async (
  outputPath: string,
  manifest: UnifiedArchiveManifest,
  databaseImage: Uint8Array,
  packedFiles: readonly PackedFile[]
): Promise<void> => {
  const writer = await createArchiveZipWriter(outputPath)
  try {
    await writer.add(
      UNIFIED_ARCHIVE_MANIFEST_NAME,
      Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
      "deflate"
    )
    await writer.add(UNIFIED_ARCHIVE_DATABASE_NAME, databaseImage, "deflate")
    for (const packedFile of packedFiles) {
      // 画像は既に圧縮されているので、縮めずに入れる。同梱するファイルは確かめてあるので、
      // ここで読めない（消えた等）なら manifest と食い違う。書き出しを失敗させる
      await writer.add(
        packedFile.zipPath,
        await fsPromises.readFile(packedFile.absolutePath),
        "store"
      )
    }
    await writer.finish()
  } catch (error) {
    await writer.discard().catch(() => undefined)
    await fsPromises.rm(outputPath, { force: true }).catch(() => undefined)
    throw error
  }
}

/**
 * 選んだ範囲の統合アーカイブを `outputPath` に書き出す。
 * 範囲が成り立たない（外せないものを外した）ときは `ArchiveScopeError` をそのまま投げる。
 */
export async function createUnifiedArchive(
  options: CreateUnifiedArchiveOptions
): Promise<UnifiedArchiveExportResult> {
  const { outputPath, onProgress } = options
  if (await pathExists(outputPath)) {
    throw new Error(`書き出し先が既にあります: ${outputPath}`)
  }
  await fsPromises.mkdir(path.dirname(outputPath), { recursive: true })

  onProgress?.("resolvingScope")
  const scope = resolveScopeFromSource(
    options.sourceDatabasePath,
    options.selection
  )

  onProgress?.("writingDatabase")
  const archive = buildArchiveDatabase(options.sourceDatabasePath, scope)
  let contents: ArchiveDatabaseContents
  let databaseImage: Buffer
  try {
    contents = readArchiveDatabase(archive)
    databaseImage = archive.serialize()
  } finally {
    archive.close()
  }
  const files = await resolveFiles(options.dataDirectory, contents.filePaths)
  const exportedAt = (options.now ?? (() => new Date()))()
  const manifest = buildManifest(options, scope, contents, files, exportedAt)

  onProgress?.("packing")
  await packArchive(outputPath, manifest, databaseImage, files.packed)
  return { outputPath, manifest }
}
