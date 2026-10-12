/**
 * 統合アーカイブ（.sao）の行の値が、列の型（Prisma のスキーマの型）に合うかを確かめる
 *
 * SQLite の表は STRICT でないので、宣言した型と違う値も入る（文字列の列に数値や BLOB、真偽の列に
 * 文字列）。アプリの書く値だけを通すため、開く側（`archiveOpener.ts`）が現行化の後に呼ぶ。
 * 外れた値が1つでもあればアーカイブごと断る。
 *
 * 列の型は `archiveColumnTypes.ts`（schema.prisma から生成）から引く。受け付ける値の形は、
 * 書き出しが DB の中身をそのまま写す（`archiveDatabaseWriter.ts`）ので、アプリの DB に入る形に
 * 合わせる。アプリは Prisma のアダプタ（@prisma/adapter-better-sqlite3）を通して書く:
 *
 * - String: 文字列
 * - Int・BigInt: 整数
 * - Float・Decimal: 整数か実数（アダプタは Decimal を数値で書く。DECIMAL・REAL の列は数値の
 *   文字列も数値にして持つ）。無限大は断る
 * - Boolean: 0 か 1（アダプタは真偽を 1 / 0 で書く。migration の `DEFAULT true` も 1 になる）
 * - DateTime: `YYYY-MM-DD` で始まる文字列（ISO 8601。migration の CURRENT_TIMESTAMP も通る）か、
 *   整数（ミリ秒。アダプタは数値の時刻も読める。取り込みも `archiveRowPlanning.ts` で扱える）
 * - Json: 文字列 / Bytes: BLOB
 *
 * NULL は、型の末尾が "?" の列だけに許す。
 */

import { hasTable, type SqliteDatabase } from "../../prisma/sqliteSchemaUtils"
import {
  ARCHIVE_COLUMN_TYPES,
  type ArchiveColumnType,
  type ArchiveScalarType,
} from "./archiveColumnTypes"

const quote = (identifier: string): string =>
  `"${identifier.replaceAll('"', '""')}"`

/** 時刻の文字列の頭（`YYYY-MM-DD`） */
const DATE_PREFIX_GLOB = "'[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*'"

/** 数値の列に許さない実数（SQLite の 9e999 は無限大） */
const isInfinite = (quotedColumn: string): string =>
  `(typeof(${quotedColumn}) = 'real' AND ${quotedColumn} IN (9e999, -9e999))`

/** NULL でない値が型に合わないときに真になる SQL の式（引数は引用済みの列名） */
const MISMATCH_CONDITIONS: Readonly<
  Record<ArchiveScalarType, (quotedColumn: string) => string>
> = {
  String: (quotedColumn) => `typeof(${quotedColumn}) <> 'text'`,
  Json: (quotedColumn) => `typeof(${quotedColumn}) <> 'text'`,
  Int: (quotedColumn) => `typeof(${quotedColumn}) <> 'integer'`,
  BigInt: (quotedColumn) => `typeof(${quotedColumn}) <> 'integer'`,
  Float: (quotedColumn) =>
    `(typeof(${quotedColumn}) NOT IN ('integer', 'real') OR ${isInfinite(quotedColumn)})`,
  Decimal: (quotedColumn) =>
    `(typeof(${quotedColumn}) NOT IN ('integer', 'real') OR ${isInfinite(quotedColumn)})`,
  Boolean: (quotedColumn) =>
    `(typeof(${quotedColumn}) <> 'integer' OR ${quotedColumn} NOT IN (0, 1))`,
  DateTime: (quotedColumn) =>
    `NOT (typeof(${quotedColumn}) = 'integer' OR (typeof(${quotedColumn}) = 'text' AND ${quotedColumn} GLOB ${DATE_PREFIX_GLOB}))`,
  Bytes: (quotedColumn) => `typeof(${quotedColumn}) <> 'blob'`,
}

/** 列の型を、スカラー型と NULL を許すかに分けたもの（全ての型を書き並べ、型検査で漏れを止める） */
const COLUMN_TYPE_PARTS: Readonly<
  Record<
    ArchiveColumnType,
    { readonly scalarType: ArchiveScalarType; readonly nullable: boolean }
  >
> = {
  String: { scalarType: "String", nullable: false },
  "String?": { scalarType: "String", nullable: true },
  Int: { scalarType: "Int", nullable: false },
  "Int?": { scalarType: "Int", nullable: true },
  BigInt: { scalarType: "BigInt", nullable: false },
  "BigInt?": { scalarType: "BigInt", nullable: true },
  Float: { scalarType: "Float", nullable: false },
  "Float?": { scalarType: "Float", nullable: true },
  Decimal: { scalarType: "Decimal", nullable: false },
  "Decimal?": { scalarType: "Decimal", nullable: true },
  Boolean: { scalarType: "Boolean", nullable: false },
  "Boolean?": { scalarType: "Boolean", nullable: true },
  DateTime: { scalarType: "DateTime", nullable: false },
  "DateTime?": { scalarType: "DateTime", nullable: true },
  Json: { scalarType: "Json", nullable: false },
  "Json?": { scalarType: "Json", nullable: true },
  Bytes: { scalarType: "Bytes", nullable: false },
  "Bytes?": { scalarType: "Bytes", nullable: true },
}

/**
 * 列の値が型に合わないときに 1、合うときに 0 になる SQL の式（NULL は型が "?" で終わるときだけ合う）
 */
export function columnTypeMismatchSql(
  column: string,
  columnType: ArchiveColumnType
): string {
  const { scalarType, nullable } = COLUMN_TYPE_PARTS[columnType]
  const quotedColumn = quote(column)
  return `CASE WHEN ${quotedColumn} IS NULL THEN ${nullable ? 0 : 1} WHEN ${MISMATCH_CONDITIONS[scalarType](quotedColumn)} THEN 1 ELSE 0 END`
}

/** 表の列名の集合 */
const columnsOf = (db: SqliteDatabase, table: string): Set<string> =>
  new Set(
    db
      .prepare<[string], { name: string }>(
        "SELECT name FROM pragma_table_info(?)"
      )
      .all(table)
      .map((column) => column.name)
  )

/** 型に合わない値の件数を `表.列` ごとに返す（列の型の一覧に載る表・列だけを見る） */
function findMistypedValues(
  db: SqliteDatabase
): Map<string, { columnType: ArchiveColumnType; count: number }> {
  const problems = new Map<
    string,
    { columnType: ArchiveColumnType; count: number }
  >()
  for (const [table, columnTypes] of Object.entries(ARCHIVE_COLUMN_TYPES)) {
    if (!hasTable(db, table)) continue
    const presentColumns = columnsOf(db, table)
    const checkedColumns = Object.entries(columnTypes).filter(([column]) =>
      presentColumns.has(column)
    )
    if (checkedColumns.length === 0) continue
    // 表ごとに1回だけ走査する（列ごとの件数を1行で受け取る）
    const counts = db
      .prepare<[], Record<string, number | null>>(
        `SELECT ${checkedColumns
          .map(
            ([column, columnType], columnIndex) =>
              `SUM(${columnTypeMismatchSql(column, columnType)}) AS "c${columnIndex}"`
          )
          .join(", ")} FROM ${quote(table)}`
      )
      .get()
    checkedColumns.forEach(([column, columnType], columnIndex) => {
      const count = counts?.[`c${columnIndex}`] ?? 0
      if (count > 0) problems.set(`${table}.${column}`, { columnType, count })
    })
  }
  return problems
}

/**
 * archive.db の行の値を列の型と照らし、合わないものを人に見せる文で返す（無ければ空）。
 * 値そのものは載せない（外から来た値をそのまま画面に出さない）
 */
export function describeMistypedArchiveValues(db: SqliteDatabase): string[] {
  return [...findMistypedValues(db)].map(
    ([columnName, { columnType, count }]) =>
      `${columnName}: 列の型（${columnType}）に合わない値 ${count}件`
  )
}
