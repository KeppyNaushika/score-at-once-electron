import { PrismaClient } from "@prisma/client"
import * as path from "path"

import { getStorageRoots } from "../storageRoots"
import {
  bootstrapSchema,
  type SchemaBootstrapResult,
} from "./schema/schemaBootstrap"
import {
  PrismaBetterSqlite3AtResolvedPath,
  PrismaBetterSqlite3WithRecursiveTriggers,
} from "./sqliteConnection"

/**
 * 接続する DB ファイルの絶対パスを返す。
 *
 * 起動時に決まった根（`../storageRoots.ts`）から読むだけで、設定ファイルは見ない。
 * ローカルモードは `data/database.db`、共有モードは `data/shared/<識別id>/database.db`
 * （手元の控え）。動いている間にモードを変えても、ここは変わらない（再起動で効かせる）。
 */
export const getDatabasePath = (): string => getStorageRoots().databasePath

/**
 * 指定パスのSQLiteファイルに接続するPrismaClientを生成する。
 *
 * アダプタは接続のたびに `recursive_triggers` を立てるもの（`sqliteConnection.ts`）。
 * 同期ライブラリのトリガーが、この接続の書き込みを取りこぼさないために要る。
 */
export const createPrismaClientForPath = (dbPath: string): PrismaClient => {
  const absolutePath = path.resolve(dbPath)
  const adapter = new PrismaBetterSqlite3WithRecursiveTriggers({
    url: absolutePath,
  })

  return new PrismaClient({
    adapter,
    log: ["error", "warn", "info"],
  })
}

/**
 * アプリの Prisma クライアントを作る。開く DB は**接続するとき**に起動時の根から読む
 * （`client.ts` はモジュールの読み込み時にこれを呼ぶので、根が決まる前に作られる）。
 */
export const createSharedPrismaClient = (): PrismaClient =>
  new PrismaClient({
    adapter: new PrismaBetterSqlite3AtResolvedPath(() =>
      path.resolve(getDatabasePath())
    ),
    log: ["error", "warn", "info"],
  })

/**
 * 空のDBに初期スキーマを適用する。既にテーブルを持つDBは "existing" を返す。
 * 実処理は bootstrapSchema に委譲する（呼び出し側で例外はハンドリングされる）。
 */
export const initializeDatabase = (): SchemaBootstrapResult => {
  return bootstrapSchema(getDatabasePath())
}
