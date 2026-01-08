import { app, protocol, net } from "electron"
import { initializeApp } from "./appInitializer"
import { pathToFileURL } from "url"
import { setupAllIPCHandlers } from "./ipc-handlers"
import { startEmbeddedNextServer } from "./nextServerEmbedded"
import { createMainWindow, setupWindowEvents } from "./windowManager"

// Windows用デバッグ出力の有効化
if (process.platform === "win32" && app.isPackaged) {
  console.log("Windows packaged app starting...")

  // Windowsでコンソールを割り当て
  if (process.platform === "win32") {
    try {
      const path = require("path")
      const fs = require("fs")

      // データディレクトリにログファイルを配置
      const { getDataDirectory } = require("./lib/dataManager")
      const dataDir = getDataDirectory()

      // データディレクトリが存在しない場合は作成
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true, mode: 0o755 })
      }

      const logPath = path.join(dataDir, "debug.log")
      console.log = (...args) => {
        const message = args.join(" ") + "\n"
        try {
          fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}`)
        } catch {
          // ログ書き込みエラーでもアプリを止めない
        }
      }
      console.error = console.log
      console.warn = console.log
    } catch {
      // フォールバック: 何もしない
    }
  }
}

// カスタムプロトコル 'appimg://' を登録（webSecurity有効時にローカルファイルへアクセスするため）
// 注意: app.whenReady() より前に protocol.registerSchemesAsPrivileged を呼ぶ必要がある
protocol.registerSchemesAsPrivileged([
  {
    scheme: "appimg",
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
])

app.on("ready", async () => {
  try {
    // appimg:// プロトコルハンドラを登録
    // appimg:///path/to/file → file:///path/to/file としてローカルファイルを読み込む
    protocol.handle("appimg", (request) => {
      try {
        const url = new URL(request.url)
        // pathnameをデコード（日本語やスペースを含むパス対応）
        let filePath = decodeURIComponent(url.pathname)

        // Windowsの場合、先頭の/を削除（/C:/path → C:/path）
        if (process.platform === "win32" && filePath.startsWith("/")) {
          filePath = filePath.slice(1)
        }

        const fileUrl = pathToFileURL(filePath).href
        return net.fetch(fileUrl)
      } catch (error) {
        console.error("appimg:// protocol error:", error)
        return new Response("File not found", { status: 404 })
      }
    })

    // アプリケーションの初期化
    await initializeApp()

    // Next.jsサーバーの起動（プロダクションのみ）
    try {
      await startEmbeddedNextServer()
    } catch (error) {
      console.error("Failed to start Next.js server:", error)
      throw error
    }

    // メインウィンドウの作成
    const mainWindow = createMainWindow()

    // ウィンドウイベントの設定
    setupWindowEvents(mainWindow)

    // IPCハンドラーの設定
    setupAllIPCHandlers()

    console.log("Application startup completed successfully")
  } catch (error) {
    console.error("Critical error during application startup:", error)
    console.error("Error stack:", error instanceof Error ? error.stack : error)
    app.quit()
  }
})

app.on("window-all-closed", app.quit)

// グローバルエラーハンドラ
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error)
  console.error("Stack:", error.stack)
})

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason)
})

// アプリが異常終了する前にログを出力とクリーンアップ
app.on("before-quit", async (_event) => {
  // Prismaクライアントのクリーンアップ
  try {
    const { getPrismaClient } = await import("./lib/prisma/client")
    const prisma = getPrismaClient()
    await prisma.$disconnect()
  } catch (error) {
    console.warn("Failed to disconnect Prisma client:", error)
    // エラーがあってもアプリ終了は継続
  }
})
