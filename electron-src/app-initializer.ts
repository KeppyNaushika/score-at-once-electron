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
    // データディレクトリの初期化
    await initializeDataDirectory()

    // データベースの初期化
    await initializeDatabase()

    // 共有ドライブ用の最適化
    await optimizeDatabaseForSharedDrive()

  } catch (error) {
    console.error("Failed to initialize application:", error)
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
