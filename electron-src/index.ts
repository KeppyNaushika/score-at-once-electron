import { app } from "electron"
import { initializeApp } from "./app-initializer"
import { setupAllIPCHandlers } from "./ipc-handlers"
import { startEmbeddedNextServer } from "./next-server-embedded"
import { createMainWindow, setupWindowEvents } from "./window-manager"

// Windows用デバッグ出力の有効化
if (process.platform === "win32" && app.isPackaged) {
  console.log("Windows packaged app starting...")

  // Windowsでコンソールを割り当て
  if (process.platform === "win32") {
    try {
      const { spawn: _spawn } = require("child_process")
      // コンソール出力をファイルにリダイレクト
      const logPath = require("path").join(process.cwd(), "debug.log")
      console.log = (...args) => {
        const fs = require("fs")
        const message = args.join(" ") + "\n"
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}`)
      }
      console.error = console.log
      console.warn = console.log
    } catch (error) {
      // フォールバック: 何もしない
    }
  }
}

app.on("ready", async () => {
  console.log("Electron app ready event triggered")

  try {
    console.log("Starting application initialization...")
    // アプリケーションの初期化
    await initializeApp()
    console.log("Application initialization completed")

    console.log("Starting Next.js server...")
    // Next.jsサーバーの起動（プロダクションのみ）
    try {
      await startEmbeddedNextServer()
      console.log("Next.js server started successfully")
    } catch (error) {
      console.error("Failed to start Next.js server:", error)
      throw error
    }

    console.log("Creating main window...")
    // メインウィンドウの作成
    const mainWindow = createMainWindow()
    console.log("Main window created")

    // ウィンドウイベントの設定
    setupWindowEvents(mainWindow)
    console.log("Window events setup completed")

    // IPCハンドラーの設定
    setupAllIPCHandlers()
    console.log("IPC handlers setup completed")

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
