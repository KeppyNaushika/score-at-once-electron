import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import { PrismaClient } from "@prisma/client"
import * as path from "path"

import { getDataDirectory } from "../dataManager"
import {
  bootstrapSchema,
  type SchemaBootstrapResult,
} from "./schema/schemaBootstrap"

/**
 * データベースファイルの絶対パスを返す
 *
 * sync有効時はローカルDBパス、無効時はデータディレクトリ内のDBパスを返す。
 */
export const getDatabasePath = (): string => {
  try {
    const { getLocalDbPath, loadSyncConfig } = require("../sync/syncConfig")
    const config = loadSyncConfig()
    if (config?.enabled) {
      return getLocalDbPath()
    }
  } catch {
    // sync未初期化時（初回起動等）は従来パスにフォールバック
  }
  return path.join(getDataDirectory(), "database.db")
}

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
