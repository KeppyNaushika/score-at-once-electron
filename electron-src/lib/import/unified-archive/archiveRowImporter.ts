/**
 * 統合アーカイブ（.sao）の行を、取り込み先の DB へ書く
 *
 * 表ごとの手書きの処理を持たず、スキーマから回す汎用の書き込み（docs/unified-archive-design.md
 * §7.2）。表を外部キーの親が先の順に回し、各行を id で取り込み先と照らして、3択に従い
 * 作る・置き換える・残す。
 *
 * - 値と時刻の扱いは `importValuePolicy.ts` をそのまま使う（上書きは取り込み時刻、統合は LWW と
 *   元の時刻、別で追加は既存に触らない）。createdAt は既にある行なら動かさない
 * - 置き換えは `UPDATE … SET`。削除して作り直さない（カスケードで子を失う）
 * - 利用者の passcode / passcodeType は書かない。アーカイブ側は空にして書き出している（§5.1）。
 *   新しく作る利用者は passcode NULL・passcodeType 'none'
 * - 監査ログは追記だけ。id で在れば何もしない（§5.5）。作るときも時刻はアーカイブのまま
 *   （いつ操作したかが記録の中身なので、上書きでも取り込み時刻にしない）
 * - 別で追加は、根の子孫の id を振り直し（`renumberSeparateRows`）、登録表の参照の列・
 *   ファイルのパスの列・id を埋め込んだ列（`archiveEmbeddedIds.ts`）を新しい id へ書き換える。
 *   振り直した行は「作る」扱い
 * - 作る・置き換える行が、取り込み先の別 id の行と一意制約でぶつかるなら書かずに止める
 *   （§7.3。解決は段階4）
 *
 * 取り込み先への読み書きは `ArchiveTargetConnection` を通す（本番は Prisma の interactive
 * transaction）。計画と書き込みを同じトランザクションで行い、止めたときは何も書かない。
 */

import type { Prisma } from "@prisma/client"

import type { ImportAction } from "../../../../src/types/importAction.types"
import { ARCHIVE_FILE_COLUMNS } from "../../export/unified-archive/archiveFileCollector"
import { ARCHIVE_TABLES } from "../../export/unified-archive/archiveTableRegistry"
import {
  createImportValuePolicy,
  type ImportValuePolicy,
  replacementUpdatedAt,
} from "../merge/importValuePolicy"
import { embeddedIdColumnsOf, remapEmbeddedIds } from "./archiveEmbeddedIds"
import {
  type ArchiveIdMap,
  flattenArchiveIdMap,
  remapArchiveFilePath,
} from "./archiveFileImporter"
import {
  type ArchiveRow,
  type ArchiveRowValues,
  type ArchiveTableRows,
  readArchiveRows,
  renumberSeparateRows,
} from "./archiveRowReader"
import {
  chunkItems,
  findArchiveUniqueMatches,
  listArchiveUniqueIndexes,
  SQL_VARIABLE_LIMIT,
} from "./archiveUniqueIndexes"
import type { OpenedUnifiedArchive } from "./types"

export type UnifiedArchiveTableCounts = {
  created: number
  replaced: number
  kept: number
}

export interface UnifiedArchiveUniqueConflict {
  readonly table: string
  readonly columns: readonly string[]
  readonly archiveId: string
  readonly existingId: string
  /** archive.migratedRowIds に入っている行か（段階4で案内に使う） */
  readonly migrated: boolean
}

export interface UnifiedArchiveImportPlan {
  readonly action: ImportAction
  /** 行のある表だけ */
  readonly counts: Readonly<Record<string, UnifiedArchiveTableCounts>>
  /** 段階4で解決する。段階3ではあれば実行を拒む */
  readonly uniqueConflicts: readonly UnifiedArchiveUniqueConflict[]
  /** 別で追加で振り直した id（表 → 旧 → 新）。それ以外は空 */
  readonly idMap: ArchiveIdMap
  /** 書き込みは止めないが知らせること（埋め込みの id を書き換えられなかった行など） */
  readonly warnings: readonly string[]
}

/** 一意制約の衝突があるため、何も書かずに止めた */
export class UnifiedArchiveUniqueConflictError extends Error {
  constructor(readonly conflicts: readonly UnifiedArchiveUniqueConflict[]) {
    super(
      `取り込み先に、id が違い一意キーが同じ行があります（${conflicts.length}件）`
    )
    this.name = "UnifiedArchiveUniqueConflictError"
  }
}

/** 取り込み先への読み書き。Prisma の interactive transaction で実装する */
export interface ArchiveTargetConnection {
  /** 型付けは呼び出し側で狭める（unknown で受けて型ガードで絞る） */
  query<Row>(sql: string, params: readonly unknown[]): Promise<Row[]>
  execute(sql: string, params: readonly unknown[]): Promise<number>
}

/** Prisma の interactive transaction を包む */
export function prismaArchiveTarget(
  tx: Prisma.TransactionClient
): ArchiveTargetConnection {
  return {
    query<Row>(sql: string, params: readonly unknown[]) {
      return tx.$queryRawUnsafe<Row[]>(sql, ...params)
    },
    execute(sql: string, params: readonly unknown[]) {
      return tx.$executeRawUnsafe(sql, ...params)
    },
  }
}

// =====================================================================
// 計画
// =====================================================================

type PlannedRowKind = "create" | "replace" | "keep"

interface PlannedRow {
  readonly kind: PlannedRowKind
  /** アーカイブ側の id（振り直す前） */
  readonly archiveId: string
  /** 取り込み先での id（別で追加で振り直したときは新しい id） */
  readonly targetId: string
  /** 書く列と値。作る行は全列、置き換える行は id と SET する列。残す行は空 */
  readonly values: ArchiveRowValues
}

interface PlannedTable {
  readonly table: string
  readonly rows: readonly PlannedRow[]
}

interface PreparedImport {
  readonly plan: UnifiedArchiveImportPlan
  readonly tables: readonly PlannedTable[]
  readonly needsDeferredForeignKeys: boolean
}

/** 書かない利用者の列（§5.1） */
const USER_SECRET_COLUMNS: ReadonlySet<string> = new Set([
  "passcode",
  "passcodeType",
])
/** 追記だけの表（§5.5） */
const APPEND_ONLY_TABLES: ReadonlySet<string> = new Set(["AuditLog"])

/** ISO 8601 の日時の文字列か（同期のトリガーは時刻列にこれ以外を拒む） */
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

const quote = (identifier: string): string =>
  `"${identifier.replaceAll('"', '""')}"`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

/** アーカイブの時刻の値を、importValuePolicy に渡す文字列にする（読めないものは null） */
const archiveTimestampText = (value: unknown): string | null => {
  if (typeof value === "string") return value
  if (typeof value === "number") return new Date(value).toISOString()
  return null
}

/**
 * 決めた時刻を書く文字列にする。アーカイブの値と同じ時刻なら、アーカイブの文字列をそのまま
 * 使う（ISO の書き方の揺れ ─ ミリ秒の有無など ─ で、往復した値が変わらないように）
 */
const timestampTextFor = (decided: Date, archiveValue: unknown): string => {
  const archiveText = archiveTimestampText(archiveValue)
  if (
    archiveText !== null &&
    ISO_DATETIME.test(archiveText) &&
    new Date(archiveText).getTime() === decided.getTime()
  ) {
    return archiveText
  }
  return decided.toISOString()
}

/** 取り込み先の時刻の値（Prisma は Date で返すことも文字列で返すこともある）を Date にする */
const existingTimestamp = (value: unknown): Date => {
  const parsed =
    value instanceof Date
      ? value
      : typeof value === "string" || typeof value === "number"
        ? new Date(value)
        : null
  // 読めない時刻は最も古いものとして扱う（統合ではアーカイブ側が勝つ）
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(0)
}

/** 表の列のうち、ファイルのパスを持つもの */
const fileColumnsOf = (table: string): ReadonlySet<string> =>
  new Set(
    ARCHIVE_FILE_COLUMNS.filter((fileColumn) => fileColumn.table === table).map(
      (fileColumn) => fileColumn.column
    )
  )

/**
 * 別で追加で振り直した id を、行の id・参照の列・ファイルのパスの列・id を埋め込んだ列
 * （`archiveEmbeddedIds.ts`）へ当てる。埋め込みの列が JSON として読めなければ元の値のまま書き、
 * `warnings` に載せる
 */
const remapRowValues = (
  tableRows: ArchiveTableRows,
  row: ArchiveRow,
  idMap: ArchiveIdMap,
  newIdByOldId: ReadonlyMap<string, string>,
  warnings: string[]
): { targetId: string; values: ArchiveRowValues } => {
  if (newIdByOldId.size === 0) return { targetId: row.id, values: row.values }
  const spec = ARCHIVE_TABLES[tableRows.table]
  const fileColumns = fileColumnsOf(tableRows.table)
  const values: Record<string, unknown> = { ...row.values }
  const targetId = idMap[tableRows.table]?.[row.id] ?? row.id
  values.id = targetId
  for (const reference of spec.references) {
    const referencedId = values[reference.column]
    if (typeof referencedId !== "string") continue
    const newId = idMap[reference.table]?.[referencedId]
    if (newId !== undefined) values[reference.column] = newId
  }
  for (const column of fileColumns) {
    const filePath = values[column]
    if (typeof filePath === "string") {
      values[column] = remapArchiveFilePath(filePath, newIdByOldId)
    }
  }
  for (const column of embeddedIdColumnsOf(tableRows.table)) {
    const jsonText = values[column]
    if (typeof jsonText !== "string") continue
    const remapped = remapEmbeddedIds(jsonText, newIdByOldId)
    if (remapped.kind === "ok") {
      values[column] = remapped.text
    } else {
      warnings.push(
        `${tableRows.table}（${row.id}）の ${column} を JSON として読めないため、中の id を振り直さずに書きました`
      )
    }
  }
  return { targetId, values }
}

/** 取り込み先に在る id と、その updatedAt（列が無ければ null） */
const fetchExistingRows = async (
  target: ArchiveTargetConnection,
  table: string,
  ids: readonly string[],
  hasUpdatedAt: boolean
): Promise<Map<string, unknown>> => {
  const existing = new Map<string, unknown>()
  const selectedColumns = hasUpdatedAt ? `id, "updatedAt"` : "id"
  for (const idChunk of chunkItems(ids, SQL_VARIABLE_LIMIT)) {
    const existingRows = await target.query<unknown>(
      `SELECT ${selectedColumns} FROM ${quote(table)} WHERE id IN (${idChunk
        .map(() => "?")
        .join(", ")})`,
      idChunk
    )
    for (const existingRow of existingRows) {
      if (!isRecord(existingRow) || typeof existingRow.id !== "string") continue
      existing.set(
        existingRow.id,
        hasUpdatedAt ? (existingRow.updatedAt ?? null) : null
      )
    }
  }
  return existing
}

/** 新しく作る行の値（時刻は createdTimestamps、利用者の passcode は空） */
const createdRowValues = (
  table: string,
  columns: ReadonlySet<string>,
  values: ArchiveRowValues,
  policy: ImportValuePolicy
): ArchiveRowValues => {
  const created: Record<string, unknown> = { ...values }
  if (!APPEND_ONLY_TABLES.has(table)) {
    const timestamps = policy.createdTimestamps({
      createdAt: archiveTimestampText(values.createdAt),
      updatedAt: archiveTimestampText(values.updatedAt),
    })
    if (columns.has("createdAt")) {
      created.createdAt = timestampTextFor(
        timestamps.createdAt,
        values.createdAt
      )
    }
    if (columns.has("updatedAt")) {
      created.updatedAt = timestampTextFor(
        timestamps.updatedAt,
        values.updatedAt
      )
    }
  }
  if (table === "User") {
    created.passcode = null
    created.passcodeType = "none"
  }
  return created
}

/** 置き換える行の値（id と、SET する列。createdAt と利用者の passcode は含めない） */
const replacedRowValues = (
  table: string,
  values: ArchiveRowValues,
  updatedAtText: string | null
): ArchiveRowValues => {
  const replaced: Record<string, unknown> = {}
  for (const [column, value] of Object.entries(values)) {
    if (column === "createdAt") continue
    if (table === "User" && USER_SECRET_COLUMNS.has(column)) continue
    replaced[column] = value
  }
  if (updatedAtText !== null) replaced.updatedAt = updatedAtText
  return replaced
}

/** 1行をどうするか決める */
const planRow = (
  tableRows: ArchiveTableRows,
  columns: ReadonlySet<string>,
  archiveId: string,
  remapped: { targetId: string; values: ArchiveRowValues },
  existing: Map<string, unknown>,
  policy: ImportValuePolicy
): PlannedRow => {
  const { table } = tableRows
  const { targetId, values } = remapped
  if (!existing.has(targetId)) {
    return {
      kind: "create",
      archiveId,
      targetId,
      values: createdRowValues(table, columns, values, policy),
    }
  }
  const keep: PlannedRow = { kind: "keep", archiveId, targetId, values: {} }
  if (APPEND_ONLY_TABLES.has(table)) return keep
  if (!columns.has("updatedAt")) {
    // 更新時刻の無い表は LWW で比べられない。上書きだけが置き換える（今の schema には無い）
    return policy.action === "overwrite"
      ? {
          kind: "replace",
          archiveId,
          targetId,
          values: replacedRowValues(table, values, null),
        }
      : keep
  }
  const replacedAt = replacementUpdatedAt(
    policy,
    archiveTimestampText(values.updatedAt),
    existingTimestamp(existing.get(targetId))
  )
  if (!replacedAt) return keep
  return {
    kind: "replace",
    archiveId,
    targetId,
    values: replacedRowValues(
      table,
      values,
      timestampTextFor(replacedAt, values.updatedAt)
    ),
  }
}

/** 作る・置き換える行が、取り込み先の別 id の行と一意制約でぶつかるものを集める */
const detectUniqueConflicts = async (
  target: ArchiveTargetConnection,
  plannedTable: PlannedTable,
  migratedIds: ReadonlySet<string>
): Promise<UnifiedArchiveUniqueConflict[]> => {
  const writtenRows = plannedTable.rows.filter((row) => row.kind !== "keep")
  if (writtenRows.length === 0) return []
  const query = (sql: string, params: readonly unknown[]) =>
    target.query<unknown>(sql, params)
  const conflicts: UnifiedArchiveUniqueConflict[] = []
  const seen = new Set<string>()
  for (const uniqueIndex of await listArchiveUniqueIndexes(
    query,
    plannedTable.table
  )) {
    const probes = writtenRows.flatMap((row, probeIndex) => {
      const values = uniqueIndex.columns.map((column) => row.values[column])
      return values.some((value) => value === null || value === undefined)
        ? []
        : [{ probeIndex, values }]
    })
    if (probes.length === 0) continue
    const matches = await findArchiveUniqueMatches(
      query,
      plannedTable.table,
      uniqueIndex,
      probes
    )
    for (const match of matches) {
      const row = writtenRows[match.probeIndex]
      if (!row || match.existingId === row.targetId) continue
      const conflictKey = `${uniqueIndex.name}\u0000${row.archiveId}\u0000${match.existingId}`
      if (seen.has(conflictKey)) continue
      seen.add(conflictKey)
      conflicts.push({
        table: plannedTable.table,
        columns: uniqueIndex.columns,
        archiveId: row.archiveId,
        existingId: match.existingId,
        migrated: migratedIds.has(row.archiveId),
      })
    }
  }
  return conflicts
}

const countRows = (rows: readonly PlannedRow[]): UnifiedArchiveTableCounts => ({
  created: rows.filter((row) => row.kind === "create").length,
  replaced: rows.filter((row) => row.kind === "replace").length,
  kept: rows.filter((row) => row.kind === "keep").length,
})

const prepareImport = async (
  target: ArchiveTargetConnection,
  archive: OpenedUnifiedArchive,
  action: ImportAction,
  importedAt: Date
): Promise<PreparedImport> => {
  const archiveRows = readArchiveRows(archive.databasePath)
  const idMap: ArchiveIdMap =
    action === "separate" ? renumberSeparateRows(archiveRows.tables) : {}
  const newIdByOldId = flattenArchiveIdMap(idMap)
  const policy = createImportValuePolicy(action, importedAt)

  const tables: PlannedTable[] = []
  const counts: Record<string, UnifiedArchiveTableCounts> = {}
  const uniqueConflicts: UnifiedArchiveUniqueConflict[] = []
  const warnings: string[] = []
  for (const tableRows of archiveRows.tables) {
    const columns = new Set(tableRows.columns)
    const remappedRows = tableRows.rows.map((row) => ({
      archiveId: row.id,
      remapped: remapRowValues(tableRows, row, idMap, newIdByOldId, warnings),
    }))
    const existing = await fetchExistingRows(
      target,
      tableRows.table,
      remappedRows.map((remappedRow) => remappedRow.remapped.targetId),
      columns.has("updatedAt")
    )
    const plannedTable: PlannedTable = {
      table: tableRows.table,
      rows: remappedRows.map((remappedRow) =>
        planRow(
          tableRows,
          columns,
          remappedRow.archiveId,
          remappedRow.remapped,
          existing,
          policy
        )
      ),
    }
    tables.push(plannedTable)
    counts[tableRows.table] = countRows(plannedTable.rows)
    uniqueConflicts.push(
      ...(await detectUniqueConflicts(
        target,
        plannedTable,
        new Set(archive.migratedRowIds[tableRows.table] ?? [])
      ))
    )
  }
  return {
    plan: { action, counts, uniqueConflicts, idMap, warnings },
    tables,
    needsDeferredForeignKeys: archiveRows.needsDeferredForeignKeys,
  }
}

/**
 * 取り込んだら何が起きるかを数える（書かない）。一意制約の衝突も載せる。
 * 別で追加の振り直しは呼ぶたびに新しい id になるので、`idMap` は目安（実際の id は
 * `importUnifiedArchiveRows` の戻り値のもの）
 */
export async function planUnifiedArchiveImport(
  target: ArchiveTargetConnection,
  archive: OpenedUnifiedArchive,
  action: ImportAction
): Promise<UnifiedArchiveImportPlan> {
  const prepared = await prepareImport(target, archive, action, new Date())
  return prepared.plan
}

// =====================================================================
// 書き込み
// =====================================================================

const insertRows = async (
  target: ArchiveTargetConnection,
  table: string,
  rows: readonly PlannedRow[]
): Promise<void> => {
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

const updateRows = async (
  target: ArchiveTargetConnection,
  table: string,
  rows: readonly PlannedRow[]
): Promise<void> => {
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

/**
 * アーカイブの行を取り込み先へ書く。`target` は1本のトランザクションであること。
 * 同じトランザクションの中で計画し、一意制約の衝突があれば何も書かずに
 * `UnifiedArchiveUniqueConflictError` を投げる（呼び出し側のトランザクションがロールバックする）
 */
export async function importUnifiedArchiveRows(
  target: ArchiveTargetConnection,
  archive: OpenedUnifiedArchive,
  action: ImportAction,
  importedAt: Date
): Promise<UnifiedArchiveImportPlan> {
  const prepared = await prepareImport(target, archive, action, importedAt)
  if (prepared.plan.uniqueConflicts.length > 0) {
    throw new UnifiedArchiveUniqueConflictError(prepared.plan.uniqueConflicts)
  }
  if (prepared.needsDeferredForeignKeys) {
    await target.execute("PRAGMA defer_foreign_keys = ON", [])
  }
  for (const plannedTable of prepared.tables) {
    await insertRows(
      target,
      plannedTable.table,
      plannedTable.rows.filter((row) => row.kind === "create")
    )
    await updateRows(
      target,
      plannedTable.table,
      plannedTable.rows.filter((row) => row.kind === "replace")
    )
  }
  return prepared.plan
}
