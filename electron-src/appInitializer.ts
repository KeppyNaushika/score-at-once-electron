import { net, protocol } from "electron"
import { format } from "url"
import {
  getAbsolutePathFromData,
  initializeDataDirectory,
} from "./lib/dataManager"
import { optimizeDatabaseForSharedDrive } from "./lib/prisma/databaseInitializer"

export async function initializeApp(): Promise<void> {
  try {
    // データディレクトリの初期化
    await initializeDataDirectory()

    // データベースの初期化とセットアップ
    try {
      const { DatabaseSetup } = await import("./lib/databaseSetup")
      const dbSetup = new DatabaseSetup()

      const wasSetupRequired = await dbSetup.setupIfNeeded()

      if (wasSetupRequired) {
        console.log("Database initialized and seeded successfully")
      } else {
        console.log("Database already exists and is ready")
      }
    } catch (dbError) {
      console.error("Database setup failed:", dbError)
      throw new Error(
        `Database initialization failed: ${dbError instanceof Error ? dbError.message : dbError}`
      )
    }

    // 共有ドライブ用の最適化
    await optimizeDatabaseForSharedDrive()

    // データベース接続テスト
    const { checkDatabaseHealth } =
      await import("./lib/prisma/databaseInitializer")
    const isHealthy = await checkDatabaseHealth()

    if (!isHealthy) {
      throw new Error("Database health check failed")
    }

    console.log("Application initialization completed successfully")
  } catch (error) {
    console.error("Failed to initialize application:", error)
    // アプリケーションを終了させるのではなく、エラー状態を明確にする
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Application initialization failed: ${errorMessage}`)
  }

  // カスタムプロトコルの設定
  protocol.handle("appimg", async (request) => {
    try {
      const relativePathInData = request.url.substring("appimg://".length)

      // より確実なデコード処理
      let decodedRelativePath
      try {
        // まずdecodeURIComponentを試す
        decodedRelativePath = decodeURIComponent(relativePathInData)
      } catch {
        try {
          // 失敗したらdecodeURIを試す
          decodedRelativePath = decodeURI(relativePathInData)
        } catch {
          // 両方失敗したら生のパスを使用
          decodedRelativePath = relativePathInData
        }
      }

      const absolutePath = getAbsolutePathFromData(decodedRelativePath)

      // ファイル存在確認
      const fs = await import("fs/promises")
      try {
        await fs.access(absolutePath)
      } catch {
        return new Response("File not found", { status: 404 })
      }

      const fileURL = format({
        pathname: absolutePath,
        protocol: "file:",
        slashes: true,
      })

      const response = await net.fetch(fileURL)
      return response
    } catch (error) {
      console.error(
        `Failed to handle 'appimg' protocol request ${request.url}:`,
        error
      )

      return new Response("File not found", { status: 404 })
    }
  })
}
