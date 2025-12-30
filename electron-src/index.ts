import { app } from "electron"
import { initializeApp } from "./appInitializer"
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

app.on("ready", async () => {
  try {
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
  console.log("Application is about to quit")

  // Prismaクライアントのクリーンアップ
  try {
    const { getPrismaClient } = await import("./lib/prisma/client")
    const prisma = getPrismaClient()
    await prisma.$disconnect()
    console.log("Prisma client disconnected successfully")
  } catch (error) {
    console.warn("Failed to disconnect Prisma client:", error)
    // エラーがあってもアプリ終了は継続
  }
})
