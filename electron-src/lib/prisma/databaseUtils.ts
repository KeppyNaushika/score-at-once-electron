import { PrismaClient } from "@prisma/client"
import * as fs from "fs/promises"

import { getDatabasePath } from "./databaseInitializer"

/** 指定テーブルのカラム名一覧をPRAGMA table_infoで取得する */
export const getTableColumns = async (
  prisma: PrismaClient,
  tableName: string
): Promise<string[]> => {
  try {
    const tableInfo = await prisma.$queryRawUnsafe<{ name: string }[]>(
      `PRAGMA table_info("${tableName}")`
    )
    return tableInfo.map((col) => col.name)
  } catch {
    return [] // テーブルが存在しない場合
  }
}

/** SQLiteのsqlite_masterを参照し、指定テーブルが存在するか確認する */
export const tableExists = async (
  prisma: PrismaClient,
  tableName: string
): Promise<boolean> => {
  const result = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`
  )
  return result.length > 0
}

/** データベースファイル（database.db）がディスク上に存在するか確認する */
export const checkDatabaseExists = async (): Promise<boolean> => {
  const databasePath = getDatabasePath()

  try {
    await fs.access(databasePath)
    return true
  } catch {
    return false
  }
}
