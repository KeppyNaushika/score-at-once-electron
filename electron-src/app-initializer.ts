import { net, protocol } from "electron"
import { format } from "url"
import {
  getAbsolutePathFromData,
  initializeDataDirectory,
} from "./lib/dataManager"
import {
  initializeDatabase,
  optimizeDatabaseForSharedDrive,
} from "./lib/prisma/databaseInitializer"

export async function initializeApp(): Promise<void> {
  try {
    console.log("Starting application initialization...")
    
    // データディレクトリの初期化
    console.log("Initializing data directory...")
    await initializeDataDirectory()

    // データベースの初期化
    console.log("Initializing database...")
    const dbInitialized = await initializeDatabase()
    
    if (dbInitialized) {
      console.log("Database initialized successfully")
    } else {
      console.log("Database already exists")
    }

    // 共有ドライブ用の最適化
    console.log("Optimizing database for shared drive...")
    await optimizeDatabaseForSharedDrive()

    // データベース接続テスト
    console.log("Testing database connection...")
    const { checkDatabaseHealth } = await import("./lib/prisma/databaseInitializer")
    const isHealthy = await checkDatabaseHealth()
    
    if (!isHealthy) {
      throw new Error("Database health check failed")
    }
    
    console.log("Database connection test passed")
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
      const decodedRelativePath = decodeURI(relativePathInData)
      const absolutePath = getAbsolutePathFromData(decodedRelativePath)

      const fileURL = format({
        pathname: absolutePath,
        protocol: "file:",
        slashes: true,
      })
      return net.fetch(fileURL)
    } catch (error) {
      console.error(
        `Failed to handle 'appimg' protocol request ${request.url}:`,
        error,
      )

      return new Response("File not found", { status: 404 })
    }
  })
}
