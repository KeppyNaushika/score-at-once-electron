/**
 * アプリの表を書く SQLite 接続の開き方（Prisma 経由・better-sqlite3 直の両方）。
 *
 * **アプリの表を書く接続は、すべて `PRAGMA recursive_triggers = ON` で開く。**
 *
 * NAS 同期（sqlite-nas-sync v0.20.0 以降）は、アプリの表への書き込みを4本のトリガーで
 * 「行の版」「削除の版」として帳簿へ写し、他端末へはその帳簿だけを渡す。ところが
 * SQLite は既定では、`INSERT OR REPLACE` や `ON CONFLICT REPLACE` が**追い出した行**の
 * DELETE トリガーを発火させない（`recursive_triggers` が OFF の間の仕様）。すると
 * 追い出された行の削除が事実にならず、他端末ではその行が生きたまま残り、
 * 同じユニークキーの「隠れた行」になる。**警告も例外も出ない**（2端末で実測）。
 *
 * この設定は**接続ごと**で、DB ファイルには残らない。ライブラリは自分の接続で立てるが、
 * アプリが別の接続で同じ DB を書くなら、その接続でも立てなければならない。
 * だから接続を作る場所をここへ集め、立て忘れる経路を作らない。
 *
 * 同期を使わない（NAS 上の DB を直に開く）ときにも立てる。同期を切ったときは
 * ローカル DB を NAS へ書き戻すので、帳簿とトリガーを持った DB を直に開くことがある。
 * アプリ自身はトリガーを持たないので、立てて変わるのはライブラリのトリガーだけである。
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import Database from "better-sqlite3"

import { assertGradeWriteAllowed } from "./gradeWriteLock"
import type { SqliteDatabase } from "./sqliteSchemaUtils"

/** アダプタが張った接続（driver-adapter-utils を直接の依存にせず、アダプタの型から導く） */
type SqlDriverAdapter = Awaited<ReturnType<PrismaBetterSqlite3["connect"]>>

/** 問い合わせの口。接続とトランザクションの両方が持つ */
type SqlQueryable = Pick<SqlDriverAdapter, "queryRaw" | "executeRaw">

/** 接続を開いた直後に流す文。ライブラリの前提 P12（アプリの表を書くすべての接続で ON） */
const RECURSIVE_TRIGGERS_PRAGMA = "PRAGMA recursive_triggers = ON"

/**
 * アプリの表を書く better-sqlite3 の生接続を開く（マイグレーション・初期スキーマ用）。
 *
 * 共有ドライブ（NAS）で他クライアントが一時的にロックしている場合に備えて
 * `busy_timeout` も立てる（呼び出し側の2か所が元々それぞれ立てていたもの）。
 */
export const openAppDatabase = (absolutePath: string): SqliteDatabase => {
  const db = new Database(absolutePath)
  db.pragma("busy_timeout = 5000")
  db.exec(RECURSIVE_TRIGGERS_PRAGMA)
  return db
}

/**
 * 接続を開くたびに `PRAGMA recursive_triggers = ON` を立てる Prisma のアダプタ。
 *
 * `@prisma/adapter-better-sqlite3`（7.10.0）には、接続を開くときに PRAGMA を流す設定が
 * 無い（コンストラクタが受け取るのは better-sqlite3 の `Options` と `timestampFormat` /
 * `shadowDatabaseUrl` だけ）。接続は `connect()` が better-sqlite3 の `Database` を
 * 1つ作って包んで返すので、その戻り値の `executeScript` で立てる。
 *
 * `$connect()` の後で1回 `$executeRaw` する形にしないのは、Prisma が `$disconnect()` の
 * あとの問い合わせで**黙って `connect()` し直す**から。1回きりの実行では、張り直した
 * 接続が OFF のまま残る。`connect()` を包めば、何度張り直しても必ず通る。
 */
/**
 * 問い合わせの口に、成績算出のロックの関所を挟む（`gradeWriteLock.ts`）。
 *
 * Prisma の書き込みは、mutation・入れ子の書き込み・生 SQL のどれも最後はここを通る
 * SQL になる。書き込み先のテーブルを見て、ロック中なら発行する前に断る。
 */
const guardGradeWrites = (queryable: SqlQueryable): void => {
  const queryRaw = queryable.queryRaw.bind(queryable)
  const executeRaw = queryable.executeRaw.bind(queryable)
  queryable.queryRaw = async (query) => {
    assertGradeWriteAllowed(query.sql)
    return queryRaw(query)
  }
  queryable.executeRaw = async (query) => {
    assertGradeWriteAllowed(query.sql)
    return executeRaw(query)
  }
}

/** 接続と、そこから始めるトランザクションの両方に関所を挟む */
const guardConnection = (adapter: SqlDriverAdapter): SqlDriverAdapter => {
  guardGradeWrites(adapter)
  const startTransaction = adapter.startTransaction.bind(adapter)
  adapter.startTransaction = async (isolationLevel) => {
    const transaction = await startTransaction(isolationLevel)
    guardGradeWrites(transaction)
    return transaction
  }
  return adapter
}

export class PrismaBetterSqlite3WithRecursiveTriggers extends PrismaBetterSqlite3 {
  override async connect() {
    const adapter = await super.connect()
    await adapter.executeScript(RECURSIVE_TRIGGERS_PRAGMA)
    return guardConnection(adapter)
  }

  override async connectToShadowDb() {
    const adapter = await super.connectToShadowDb()
    await adapter.executeScript(RECURSIVE_TRIGGERS_PRAGMA)
    return adapter
  }
}
