import { app, dialog, net, protocol } from "electron"
import * as path from "path"
import { pathToFileURL } from "url"

import { initializeApp } from "./appInitializer"
import { setupAllIPCHandlers } from "./ipc-handlers"
import { getAbsolutePathFromData } from "./lib/dataManager"
import { DB_NEWER_THAN_APP_MARKER } from "./lib/prisma/schema/migrationGuard"
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
      // フレーム検出（02-template）は img.crossOrigin="anonymous" で読み込むため、
      // スキーム自体をCORS対象にしないと応答の Access-Control-Allow-Origin が
      // 参照されず、crossOrigin付きの読み込みが onerror で失敗する。
      corsEnabled: true,
    },
  },
])

app.on("ready", async () => {
  try {
    // appimg:// プロトコルハンドラを登録
    // appimg:///path/to/file → file:///path/to/file としてローカルファイルを読み込む
    protocol.handle("appimg", async (request) => {
      try {
        // new URL() を使わず文字列操作でパスを抽出
        // appimg://exams/... や appimg:///exams/... の両方に対応
        let filePath = decodeURIComponent(
          request.url.replace(/^appimg:\/\/\/?/, "")
        )

        // projects/ → exams/ パス正規化（v0.6.x リネーム対応）
        if (filePath.startsWith("projects/")) {
          filePath = "exams/" + filePath.slice("projects/".length)
        }

        // 相対パスの場合はデータディレクトリからの絶対パスに変換
        if (!path.isAbsolute(filePath)) {
          filePath = getAbsolutePathFromData(filePath)
        }

        const fileUrl = pathToFileURL(filePath).href
        const response = await net.fetch(fileUrl)

        // CORSヘッダーを付与する。
        // フレーム検出（02-template）は img.crossOrigin="anonymous" で画像を読み込み
        // getImageData でピクセルを解析するため、Access-Control-Allow-Origin が無いと
        // ブラウザのCORSチェックで読み込みが拒否される（img.onerror → "Failed to load image"）。
        const headers = new Headers(response.headers)
        headers.set("Access-Control-Allow-Origin", "*")
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        })
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
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes(DB_NEWER_THAN_APP_MARKER)) {
      dialog.showErrorBox(
        "アプリの更新が必要です",
        message.replace(`[${DB_NEWER_THAN_APP_MARKER}] `, "")
      )
    }
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
  // NAS同期の停止
  try {
    const { stopSync } = await import("./lib/sync/syncService")
    await stopSync()
  } catch (error) {
    console.warn("Failed to stop sync service:", error)
  }

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
