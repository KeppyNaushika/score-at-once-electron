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
      console.log(`[appimg] Request URL: ${request.url}`)
      
      const relativePathInData = request.url.substring("appimg://".length)
      console.log(`[appimg] Relative path (raw): ${relativePathInData}`)
      
      // より確実なデコード処理
      let decodedRelativePath
      try {
        // まずdecodeURIComponentを試す
        decodedRelativePath = decodeURIComponent(relativePathInData)
        console.log(`[appimg] Decoded with decodeURIComponent: ${decodedRelativePath}`)
      } catch (err) {
        try {
          // 失敗したらdecodeURIを試す
          decodedRelativePath = decodeURI(relativePathInData)
          console.log(`[appimg] Decoded with decodeURI: ${decodedRelativePath}`)
        } catch (err2) {
          // 両方失敗したら生のパスを使用
          decodedRelativePath = relativePathInData
          console.log(`[appimg] Using raw path (decode failed): ${decodedRelativePath}`)
        }
      }
      
      const absolutePath = getAbsolutePathFromData(decodedRelativePath)
      console.log(`[appimg] Absolute path: ${absolutePath}`)

      // ファイル存在確認
      const fs = await import("fs/promises")
      try {
        await fs.access(absolutePath)
        console.log(`[appimg] File exists: ✓`)
      } catch (accessError) {
        const errorMessage = accessError instanceof Error ? accessError.message : String(accessError)
        console.log(`[appimg] File not accessible: ${errorMessage}`)
        return new Response("File not found", { status: 404 })
      }

      const fileURL = format({
        pathname: absolutePath,
        protocol: "file:",
        slashes: true,
      })
      console.log(`[appimg] File URL: ${fileURL}`)
      
      const response = await net.fetch(fileURL)
      console.log(`[appimg] Response status: ${response.status}`)
      
      return response
    } catch (error) {
      console.error(
        `Failed to handle 'appimg' protocol request ${request.url}:`,
        error,
      )

      return new Response("File not found", { status: 404 })
    }
  })
}
