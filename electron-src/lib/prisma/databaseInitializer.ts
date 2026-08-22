import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import { PrismaClient } from "@prisma/client"
import * as path from "path"

import { getDataDirectory } from "../dataManager"
import { getLocalDbPath, loadSyncConfig } from "../sync/syncConfig"
import {
  bootstrapSchema,
  type SchemaBootstrapResult,
} from "./schema/schemaBootstrap"

/**
 * データベースファイルの絶対パスを返す
 *
 * sync有効時はローカルDBパス、無効時はデータディレクトリ内のDBパスを返す
 * （sync有効時、NAS上のDBは同期先であって接続先ではない）。
 *
 * 分岐は sync設定の `enabled` だけで決める。設定ファイルが無い初回起動でも
 * `loadSyncConfig()` は既定値（`enabled: false`）を返すので、「読み込みに失敗したら
 * 既定パス」というフォールバックは要らない。かつてここは `require()` の失敗ごと
 * try/catch で飲んでいたが、それは失敗の理由を区別しないため
 * 「sync有効なのに従来パスを返す」事故を隠す形になっていた。
 * なお、ここで例外が出るとしたら Electron の `app` が使えないときだけで、
 * 逃げ先の `getDataDirectory()` も同じく `app` に依存する以上、隠しても直らない。
 */
export const getDatabasePath = (): string =>
  loadSyncConfig().enabled
    ? getLocalDbPath()
    : path.join(getDataDirectory(), "database.db")

/** 指定パスのSQLiteファイルに接続するPrismaClientを生成する */
const createPrismaClientForPath = (dbPath: string): PrismaClient => {
  const absolutePath = path.resolve(dbPath)
  const adapter = new PrismaBetterSqlite3({ url: absolutePath })

  return new PrismaClient({
    adapter,
    log: ["error", "warn", "info"],
  })
}

/** 共有ドライブ対応のPrismaクライアントをドライバーアダプター経由で生成する */
export const createSharedPrismaClient = (): PrismaClient => {
  return createPrismaClientForPath(getDatabasePath())
}

/**
 * 空のDBに初期スキーマを適用する。既にテーブルを持つDBは "existing" を返す。
 * 実処理は bootstrapSchema に委譲する（呼び出し側で例外はハンドリングされる）。
 */
export const initializeDatabase = (): SchemaBootstrapResult => {
  return bootstrapSchema(getDatabasePath())
}
