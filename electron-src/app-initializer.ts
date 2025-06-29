import { app, protocol, net } from "electron"
import { format } from "url"
import isDev from "electron-is-dev"
import prepareNext from "electron-next"
import { 
  initializeDataDirectory, 
  migrateFromApplicationSupport, 
  getAbsolutePathFromData 
} from "./lib/dataManager"
import { 
  initializeDatabase, 
  optimizeDatabaseForSharedDrive 
} from "./lib/prisma/databaseInitializer"

export async function initializeApp(): Promise<void> {
  try {
    // データディレクトリの初期化
    await initializeDataDirectory()
    
    // ApplicationSupportからの移行処理
    const migrated = await migrateFromApplicationSupport()
    if (migrated) {
      console.log('Data migration from ApplicationSupport completed')
    }
    
    // データベースの初期化
    await initializeDatabase()
    
    // 共有ドライブ用の最適化
    await optimizeDatabaseForSharedDrive()
    
    console.log('Application initialization completed')
  } catch (error) {
    console.error('Failed to initialize application:', error)
  }

  if (isDev) {
    // 開発環境では electron-next は使わない
  } else {
    await prepareNext("./")
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