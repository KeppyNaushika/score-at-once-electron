import { app, dialog, net, protocol } from "electron"
import * as path from "path"
import { pathToFileURL } from "url"

import { initializeApp } from "./appInitializer"
import { setupAllIPCHandlers } from "./ipc-handlers"
import { destroySharedSvgWindow } from "./ipc-handlers/exportHandlers"
import { stopUnifiedArchiveExportWorker } from "./ipc-handlers/unifiedArchiveHandlers"
import { startAiGradingBatchPolling } from "./lib/aiGrading/aiGradingMainServices"
import { getAbsolutePathFromSharedFiles } from "./lib/dataManager"
import { closeAllUnifiedArchiveImportSessions } from "./lib/import/unified-archive/archiveImportSessions"
import { cleanupDecryptedPdfCopies } from "./lib/pdf-tools/decryptedPdfCopy"
import { getPrismaClient } from "./lib/prisma/client"
import { DB_NEWER_THAN_APP_MARKER } from "./lib/prisma/schema/migrationGuard"
import { stopSync } from "./lib/sync/syncService"
import { startEmbeddedNextServer } from "./nextServerEmbedded"
import { createMainWindow, setupWindowEvents } from "./windowManager"

/** AI 採点のバッチ回収を止める口（起動に成功したときだけ入る） */
let stopAiGradingBatchPolling: (() => void) | null = null

// Windows用デバッグ出力の有効化
if (process.platform === "win32" && app.isPackaged) {
  console.log("Windows packaged app starting...")

  // Windowsでコンソールを割り当て
  if (process.platform === "win32") {
    try {
      const path = require("path")
      const fs = require("fs")

      // データディレクトリにログファイルを配置
      // ログは PCに残すものの根（モードによらない）に置く
      const { getLocalDataDirectory } = require("./lib/dataManager")
      const dataDir = getLocalDataDirectory()

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
          filePath = getAbsolutePathFromSharedFiles(filePath)
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

    // 前回セッションで残ったパスワード保護PDFの復号済み複製を掃除する
    try {
      cleanupDecryptedPdfCopies()
    } catch (error) {
      console.warn("Failed to clean up decrypted PDF copies:", error)
    }

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

    // AI 採点: この端末が預けたバッチの結果を、起動時と一定間隔で回収する
    // （同意してキーを設定した事業者が無い端末では何もしない）
    try {
      stopAiGradingBatchPolling = startAiGradingBatchPolling()
    } catch (error) {
      console.warn("Failed to start AI grading batch polling:", error)
    }

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
  // SVG→PNG変換用の共有オフスクリーンウィンドウを破棄
  try {
    destroySharedSvgWindow()
  } catch (error) {
    console.warn("Failed to destroy shared SVG window:", error)
  }

  // 統合アーカイブの取り込みで開いたまま残った作業ディレクトリを消す
  try {
    closeAllUnifiedArchiveImportSessions()
  } catch (error) {
    console.warn("Failed to close unified archive import sessions:", error)
  }

  // 統合アーカイブの書き出しの作業者を終わらせる
  try {
    stopUnifiedArchiveExportWorker()
  } catch (error) {
    console.warn("Failed to stop unified archive export worker:", error)
  }

  // AI 採点のバッチ回収を止める（預けたバッチは次の起動で回収する）
  stopAiGradingBatchPolling?.()

  // NAS同期の停止
  try {
    await stopSync()
  } catch (error) {
    console.warn("Failed to stop sync service:", error)
  }

  // Prismaクライアントのクリーンアップ
  try {
    const prisma = getPrismaClient()
    await prisma.$disconnect()
  } catch (error) {
    console.warn("Failed to disconnect Prisma client:", error)
    // エラーがあってもアプリ終了は継続
  }
})
