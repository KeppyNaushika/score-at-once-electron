/**
 * Worker 側の `better-sqlite3`。アプリの DB（`appDatabase.ts` の sqlite-wasm の接続）を、
 * main のコードが使う範囲の better-sqlite3 の形に包む。
 *
 * これで次がデスクトップ版と同じコードのまま動く:
 * - Prisma のアダプタ `@prisma/adapter-better-sqlite3`（値の変換・エラーの対応付けを含む）と、
 *   それを包む `electron-src/lib/prisma/sqliteConnection.ts`（成績算出のロックの関所・recursive_triggers）
 * - 初期スキーマ（`schemaBootstrap.ts`）・マイグレーション（`migrationDeployer.ts`）と、
 *   その記録（`_prisma_migrations`）
 *
 * 包むのは使われ方の部分集合だけ: `new Database(path | buffer)`・`prepare`（`bind`/`run`/`get`/
 * `all`/`raw`/`pluck`/`columns`/`reader`）・`exec`・`pragma`・`transaction`・`serialize`・`close`。
 *
 * パスで開けるのはアプリの DB と `:memory:` だけ。ほかのファイルは OPFS にあって同期では
 * 読めないので、呼び出し側が `fs/promises` で中身を読み、better-sqlite3 と同じく中身（Buffer）から
 * メモリ上の DB として開く（`new Database(buffer)`。書き戻すなら `serialize()` を fs で書く）。
 * 統合アーカイブ（`.sao`）の archive.db はこの形で開く（`archiveDatabaseImage.ts`）。
 * それ以外のパス（同期の写しなど）は開く時点で断る。
 *
 * エラーは better-sqlite3 の `SqliteError` と同じ形（`code` に拡張コードの名前、`message` に
 * SQLite の文言）にする。Prisma のアダプタはこの2つで違反の種類を見分ける。
 */
import type {
  BindableValue,
  Database as WasmDatabase,
  PreparedStatement,
  SqlValue,
} from "@sqlite.org/sqlite-wasm"
import { Buffer } from "buffer"

import { getAppDatabaseHost, isAppDatabasePath } from "./appDatabase"

/** better-sqlite3 の `SqliteError` */
class SqliteError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = "SqliteError"
    this.code = code
  }
}

/** better-sqlite3 の `stmt.columns()` の1列 */
interface ColumnDefinition {
  name: string
  column: string | null
  table: string | null
  database: string | null
  type: string | null
}

/** better-sqlite3 の `stmt.run()` の結果 */
interface RunResult {
  changes: number
  lastInsertRowid: number | bigint
}

/** 名前付きの引数（`{ name: value }`。SQL 側は `@name` `:name` `$name` のどれか） */
type NamedParameters = Record<string, BindableValue>

/** `run`/`get`/`all`/`bind` が受け取る引数（配列は1段だけ開く。better-sqlite3 と同じ） */
type StatementParameter =
  BindableValue | readonly BindableValue[] | NamedParameters

type ResultRow = Record<string, unknown>

const NAMED_PARAMETER_PREFIXES = ["@", ":", "$"]

/** sqlite-wasm の例外が持つ結果コード */
const resultCodeOf = (error: unknown): number | null =>
  error instanceof Error &&
  "resultCode" in error &&
  typeof error.resultCode === "number"
    ? error.resultCode
    : null

/**
 * sqlite-wasm の例外を better-sqlite3 の `SqliteError` にする。
 * 文言の頭の「SQLITE_XXX: sqlite3 result code N: 」は sqlite-wasm が足したものなので外す
 */
const toSqliteError = (error: unknown): unknown => {
  const resultCode = resultCodeOf(error)
  if (resultCode === null || !(error instanceof Error)) return error
  const { capi } = getAppDatabaseHost().sqlite3
  const code =
    capi.sqlite3_js_rc_str(resultCode) ?? `UNKNOWN_SQLITE_ERROR_${resultCode}`
  const message = error.message.replace(
    /^SQLITE_[A-Z_]+: sqlite3 result code \d+: /,
    ""
  )
  return new SqliteError(message, code)
}

const isNamedParameters = (
  parameter: StatementParameter
): parameter is NamedParameters =>
  typeof parameter === "object" &&
  parameter !== null &&
  !Array.isArray(parameter) &&
  !ArrayBuffer.isView(parameter) &&
  !(parameter instanceof ArrayBuffer)

/** 引数を sqlite-wasm の `bind` の形にする。何も無ければ null */
const toBinding = (
  statement: PreparedStatement,
  parameters: readonly StatementParameter[]
): BindableValue[] | Record<string, BindableValue> | null => {
  const [onlyParameter] = parameters
  if (parameters.length === 1 && isNamedParameters(onlyParameter)) {
    return Object.fromEntries(
      Object.entries(onlyParameter).map(([name, parameterValue]) => {
        const prefixedName =
          NAMED_PARAMETER_PREFIXES.map((prefix) => prefix + name).find(
            (candidate) => statement.getParamIndex(candidate) !== undefined
          ) ?? `:${name}`
        return [prefixedName, parameterValue]
      })
    )
  }
  const positional = parameters.flatMap((parameter) =>
    Array.isArray(parameter) ? parameter : [parameter]
  )
  return positional.length === 0 ? null : positional
}

/**
 * 結果の列の名前。sqlite-wasm の `getColumnNames()` は列の無い文（CREATE・INSERT など）で
 * 「Column index 0 is out of range」を投げるので、列の数から読む
 */
const columnNamesOf = (statement: PreparedStatement): string[] =>
  Array.from({ length: statement.columnCount }, (_unused, columnIndex) =>
    statement.getColumnName(columnIndex)
  )

/** sqlite-wasm の行の値を better-sqlite3 の値にする（BLOB は Buffer） */
const toResultValue = (cellValue: SqlValue): unknown =>
  cellValue instanceof Uint8Array
    ? Buffer.from(cellValue.buffer, cellValue.byteOffset, cellValue.byteLength)
    : cellValue

class Statement {
  readonly source: string
  /** 結果の列を持つ文か（better-sqlite3 の `stmt.reader`） */
  readonly reader: boolean
  private readonly columnDefinitions: ColumnDefinition[]
  private boundParameters: readonly StatementParameter[] | null = null
  private rawMode = false
  private pluckMode = false

  constructor(
    private readonly connection: Database,
    source: string
  ) {
    this.source = source
    // 文の誤りは prepare の時点で投げる（better-sqlite3 と同じ）。列の形もここで読む
    this.columnDefinitions = connection.withStatement(source, (statement) => {
      const { capi } = getAppDatabaseHost().sqlite3
      return columnNamesOf(statement).map((columnName, columnIndex) => ({
        name: columnName,
        column: null,
        table: null,
        database: null,
        type: capi.sqlite3_column_decltype(statement, columnIndex),
      }))
    })
    this.reader = this.columnDefinitions.length > 0
  }

  /** 引数を固定する。better-sqlite3 と同じく、固定したあとは実行時に渡せない */
  bind(...parameters: StatementParameter[]): this {
    if (this.boundParameters !== null) {
      throw new TypeError(
        "The bind() method can only be invoked once per statement object"
      )
    }
    this.boundParameters = parameters
    return this
  }

  raw(toggle = true): this {
    this.rawMode = toggle
    return this
  }

  pluck(toggle = true): this {
    this.pluckMode = toggle
    return this
  }

  columns(): ColumnDefinition[] {
    return this.columnDefinitions.map((definition) => ({ ...definition }))
  }

  run(...parameters: StatementParameter[]): RunResult {
    return this.execute(parameters, (statement) => {
      while (statement.step()) {
        // RETURNING の行は読み捨てる
      }
      return this.connection.lastRunResult()
    })
  }

  get(...parameters: StatementParameter[]): unknown {
    this.assertReader("get")
    return this.execute(parameters, (statement) =>
      statement.step() ? this.shapeRow(statement) : undefined
    )
  }

  all(...parameters: StatementParameter[]): unknown[] {
    this.assertReader("all")
    return this.execute(parameters, (statement) => {
      const rows: unknown[] = []
      while (statement.step()) rows.push(this.shapeRow(statement))
      return rows
    })
  }

  *iterate(...parameters: StatementParameter[]): Generator<unknown> {
    yield* this.all(...parameters)
  }

  private assertReader(methodName: string): void {
    if (!this.reader) {
      throw new TypeError(
        `This statement does not return data. Use run() instead (${methodName})`
      )
    }
  }

  private execute<Result>(
    parameters: readonly StatementParameter[],
    consume: (statement: PreparedStatement) => Result
  ): Result {
    if (this.boundParameters !== null && parameters.length > 0) {
      throw new TypeError("This statement already has bound parameters")
    }
    const effectiveParameters = this.boundParameters ?? parameters
    return this.connection.withStatement(this.source, (statement) => {
      const binding = toBinding(statement, effectiveParameters)
      if (binding !== null) statement.bind(binding)
      return consume(statement)
    })
  }

  private shapeRow(statement: PreparedStatement): unknown {
    const cellValues = statement.get([]).map(toResultValue)
    if (this.pluckMode) return cellValues[0]
    if (this.rawMode) return cellValues
    const row: ResultRow = {}
    this.columnDefinitions.forEach((definition, columnIndex) => {
      row[definition.name] = cellValues[columnIndex]
    })
    return row
  }
}

/** better-sqlite3 の `db.transaction(fn)` が返す関数 */
type TransactionFunction<Args extends unknown[], Result> = (
  ...args: Args
) => Result

/** better-sqlite3 の `new Database(filename, options)` の options のうち、読むもの */
interface DatabaseOptions {
  readonly?: boolean
  fileMustExist?: boolean
}

/** メモリ上の DB を開き、デスクトップ版の better-sqlite3 と同じ既定値にそろえる */
const openMemoryHandle = (): WasmDatabase => {
  const { sqlite3 } = getAppDatabaseHost()
  const handle = new sqlite3.oo1.DB(":memory:", "c")
  sqlite3.capi.sqlite3_extended_result_codes(handle, 1)
  handle.exec("PRAGMA foreign_keys = ON")
  return handle
}

/**
 * 中身（SQLite のファイルのバイト列）をメモリ上の DB として開く（better-sqlite3 の
 * `new Database(buffer)`）。中身は SQLite のメモリへ写すので、渡したバイト列はあとで変えてよい
 */
const deserializeHandle = (
  image: Uint8Array,
  readonly: boolean
): WasmDatabase => {
  const handle = openMemoryHandle()
  if (image.byteLength === 0) return handle
  const { sqlite3 } = getAppDatabaseHost()
  const { capi, wasm } = sqlite3
  // sqlite3_malloc で取った領域に写す。失敗したときも SQLite が解放する（FREEONCLOSE）。
  // allocFromTypedArray は型を constructor で見分けるので、Buffer は素の Uint8Array にして渡す
  const imagePointer = wasm.allocFromTypedArray(
    new Uint8Array(image.buffer, image.byteOffset, image.byteLength)
  )
  const resultCode = capi.sqlite3_deserialize(
    handle,
    "main",
    imagePointer,
    image.byteLength,
    image.byteLength,
    capi.SQLITE_DESERIALIZE_FREEONCLOSE |
      (readonly
        ? capi.SQLITE_DESERIALIZE_READONLY
        : capi.SQLITE_DESERIALIZE_RESIZEABLE)
  )
  if (resultCode !== 0) {
    handle.close()
    throw toSqliteError(
      Object.assign(new Error("sqlite3_deserialize に失敗した"), {
        resultCode,
      })
    )
  }
  return handle
}

export default class Database {
  readonly name: string
  readonly memory: boolean
  readonly readonly: boolean
  /** メモリ上の DB のときだけ自分で開いた接続。アプリの DB は共有の接続を使う */
  private readonly ownedHandle: WasmDatabase | null
  private isOpen = true

  constructor(filename: string | Uint8Array, options: DatabaseOptions = {}) {
    this.readonly = options.readonly ?? false
    if (filename instanceof Uint8Array) {
      this.name = ":memory:"
      this.memory = true
      this.ownedHandle = deserializeHandle(filename, this.readonly)
      return
    }
    this.name = filename
    this.memory = filename === ":memory:"
    if (this.memory) {
      this.ownedHandle = openMemoryHandle()
      return
    }
    if (!isAppDatabasePath(filename)) {
      throw new Error(
        `[web] better-sqlite3 で ${filename} をパスで開くことは web 版では未対応（開けるのはアプリの DB と、中身から開くメモリ上の DB だけ）`
      )
    }
    this.ownedHandle = null
  }

  get open(): boolean {
    return this.isOpen
  }

  get inTransaction(): boolean {
    const { sqlite3 } = getAppDatabaseHost()
    return sqlite3.capi.sqlite3_get_autocommit(this.handle()) === 0
  }

  prepare(source: string): Statement {
    return new Statement(this, source)
  }

  exec(source: string): this {
    try {
      this.handle().exec(source)
    } catch (error) {
      throw toSqliteError(error)
    }
    return this
  }

  /** `db.pragma("foreign_keys = OFF")`。`{ simple: true }` なら最初の行の最初の値 */
  pragma(source: string, options?: { simple?: boolean }): unknown {
    const rows = this.withStatement(`PRAGMA ${source}`, (statement) => {
      const collected: SqlValue[][] = []
      while (statement.step()) collected.push(statement.get([]))
      return { columnNames: columnNamesOf(statement), collected }
    })
    if (options?.simple) return rows.collected[0]?.[0]
    return rows.collected.map((cellValues) =>
      Object.fromEntries(
        rows.columnNames.map((columnName, columnIndex) => [
          columnName,
          toResultValue(cellValues[columnIndex]),
        ])
      )
    )
  }

  /**
   * 関数をトランザクションで包む。入れ子（既にトランザクションの中）はセーブポイントにする
   * （better-sqlite3 と同じ）
   */
  transaction<Args extends unknown[], Result>(
    body: (...args: Args) => Result
  ): TransactionFunction<Args, Result> {
    return (...args) => {
      const nested = this.inTransaction
      const savepointName = `web_shim_${crypto.randomUUID().replaceAll("-", "")}`
      this.exec(nested ? `SAVEPOINT ${savepointName}` : "BEGIN")
      try {
        const result = body(...args)
        this.exec(nested ? `RELEASE ${savepointName}` : "COMMIT")
        return result
      } catch (error) {
        if (nested) {
          this.exec(`ROLLBACK TO ${savepointName}`)
          this.exec(`RELEASE ${savepointName}`)
        } else if (this.inTransaction) {
          this.exec("ROLLBACK")
        }
        throw error
      }
    }
  }

  /** 中身（SQLite のファイルのバイト列）。better-sqlite3 の `db.serialize()` */
  serialize(): Buffer {
    const { sqlite3 } = getAppDatabaseHost()
    try {
      const image = sqlite3.capi.sqlite3_js_db_export(this.handle())
      return Buffer.from(image.buffer, image.byteOffset, image.byteLength)
    } catch (error) {
      throw toSqliteError(error)
    }
  }

  /** 直前の `run` の結果（この接続の変更数と、最後に入れた行の rowid） */
  lastRunResult(): RunResult {
    const handle = this.handle()
    const { sqlite3 } = getAppDatabaseHost()
    const lastInsertRowid = sqlite3.capi.sqlite3_last_insert_rowid(handle)
    return {
      changes: handle.changes(),
      lastInsertRowid: Number.isSafeInteger(Number(lastInsertRowid))
        ? Number(lastInsertRowid)
        : lastInsertRowid,
    }
  }

  /** Prisma のアダプタが呼ぶ。sqlite-wasm は安全な範囲の整数を number で返すので何もしない */
  defaultSafeIntegers(): this {
    return this
  }

  /**
   * 閉じる。アプリの DB の共有の接続は閉じず、この包みを使えなくするだけ。
   * マイグレーションは外部キー制約を OFF にして流すので、接続の状態を開いたときの
   * ON へ戻す（デスクトップ版では接続ごと捨てるので、次の接続は ON から始まる）
   */
  close(): this {
    if (!this.isOpen) return this
    if (this.ownedHandle !== null) {
      this.ownedHandle.close()
    } else if (!this.inTransaction) {
      this.sharedHandle().exec("PRAGMA foreign_keys = ON")
    }
    this.isOpen = false
    return this
  }

  /** 1つの文を prepare して渡し、終わったら必ず finalize する（文を接続に溜めない） */
  withStatement<Result>(
    source: string,
    consume: (statement: PreparedStatement) => Result
  ): Result {
    let statement: PreparedStatement | null = null
    try {
      statement = this.handle().prepare(source)
      return consume(statement)
    } catch (error) {
      throw toSqliteError(error)
    } finally {
      statement?.finalize()
    }
  }

  private handle(): WasmDatabase {
    if (!this.isOpen) throw new TypeError("The database connection is not open")
    return this.ownedHandle ?? this.sharedHandle()
  }

  private sharedHandle(): WasmDatabase {
    return getAppDatabaseHost().handle
  }
}
