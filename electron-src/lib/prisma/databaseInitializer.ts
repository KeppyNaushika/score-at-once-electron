import { PrismaClient } from "@prisma/client"
import * as fs from "fs/promises"
import * as path from "path"

import { getDataDirectory } from "../dataManager"
import { checkDatabaseExists } from "./databaseUtils"
import { INDEX_SQL, MIGRATION_SQL } from "./schema/migrationSql"

/** データベースファイル（database.db）の絶対パスを返す */
export const getDatabasePath = (): string => {
  return path.join(getDataDirectory(), "database.db")
}

/** 共有ドライブ対応のPrismaクライアントを生成し、DATABASE_URL環境変数を上書きする */
export const createSharedPrismaClient = (): PrismaClient => {
  const databasePath = getDatabasePath()
  // パッケージ化されたアプリでは絶対パスを使用
  const absolutePath = path.resolve(databasePath)

  // Windowsパスの正規化（バックスラッシュをスラッシュに）
  const normalizedPath = absolutePath.replace(/\\/g, "/")
  const databaseUrl = `file:${normalizedPath}`

  // 環境変数を動的にオーバーライド
  process.env.DATABASE_URL = databaseUrl

  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    // パッケージ化されたアプリでの設定を強化
    log: ["error", "warn", "info"],
    errorFormat: "pretty",
  })
}

/** 初回起動時にDBファイルを作成しスキーマを適用する。既にDBが存在する場合はfalseを返す */
export const initializeDatabase = async (): Promise<boolean> => {
  try {
    // データベースファイルの存在確認
    const dbExists = await checkDatabaseExists()

    if (!dbExists) {
      // データディレクトリが存在することを確認
      const dataDir = getDataDirectory()
      await fs.mkdir(dataDir, { recursive: true, mode: 0o755 })

      // 空のデータベースファイルを作成
      const dbPath = getDatabasePath()
      await fs.writeFile(dbPath, "", { mode: 0o644 })

      // ファイルが実際に作成されたか確認
      try {
        await fs.stat(dbPath)
      } catch (error) {
        console.error("Failed to verify database file creation:", error)
        throw new Error(`Database file creation verification failed: ${error}`)
      }

      // Prismaクライアントでデータベースを初期化
      const prisma = createSharedPrismaClient()

      try {
        // Prisma接続にタイムアウトを設定（プラットフォーム対応改善）
        let connectionSuccessful = false
        const maxRetries = 3
        let attempt = 0

        while (attempt < maxRetries && !connectionSuccessful) {
          attempt++

          try {
            const connectPromise = prisma.$connect()
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(
                () =>
                  reject(
                    new Error(
                      `Database connection timeout after 20 seconds (attempt ${attempt})`
                    )
                  ),
                20000 // タイムアウトを20秒に延長
              )
            })

            await Promise.race([connectPromise, timeoutPromise])
            connectionSuccessful = true
            break
          } catch (connectError) {
            if (attempt < maxRetries) {
              const waitTime = attempt * 2000 // 2秒、4秒と段階的に延長
              await new Promise((resolve) => setTimeout(resolve, waitTime))
            } else {
              // 最後の試行失敗時
              console.error("All connection attempts failed:", connectError)
              throw new Error(
                `Database connection failed after ${maxRetries} attempts: ${connectError instanceof Error ? connectError.message : connectError}`
              )
            }
          }
        }

        // 直接SQLを実行してスキーマを作成
        if (!connectionSuccessful) {
          throw new Error("Failed to establish database connection")
        }

        // SQLを複数のステートメントに分割して実行
        const allSQL = MIGRATION_SQL + INDEX_SQL
        const statements = allSQL.split(";").filter((stmt) => stmt.trim())

        for (const statement of statements) {
          if (statement.trim()) {
            await prisma.$executeRawUnsafe(statement.trim())
          }
        }

        return true
      } catch (error) {
        console.error("Failed to initialize database schema:", error)

        // データベースファイルを削除して再試行
        try {
          await fs.unlink(dbPath)
        } catch (unlinkError) {
          console.error(
            "Failed to remove corrupted database file:",
            unlinkError
          )
        }

        throw error
      } finally {
        await prisma.$disconnect()
      }
    } else {
      return false
    }
  } catch (error) {
    console.error("Database initialization failed:", error)
    throw error
  }
}
