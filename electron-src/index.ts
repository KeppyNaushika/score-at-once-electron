import { app, dialog, net, protocol } from "electron"
import * as fs from "fs"
import { pathToFileURL } from "url"

import { initializeApp } from "./appInitializer"
import { setupAllIPCHandlers } from "./ipc-handlers"
import { stopUnifiedArchiveExportWorker } from "./ipc-handlers/unifiedArchiveHandlers"
import { startAiGradingBatchPolling } from "./lib/aiGrading/aiGradingMainServices"
import { resolveAppImageRequestPath } from "./lib/appImageProtocol"
import { getSharedFilesDirectory } from "./lib/dataManager"
import { takeAllUnifiedArchiveImportWorkDirectories } from "./lib/import/unified-archive/archiveImportSessions"
import { cleanupDecryptedPdfCopies } from "./lib/pdf-tools/decryptedPdfCopy"
import { getPrismaClient } from "./lib/prisma/client"
import { DB_NEWER_THAN_APP_MARKER } from "./lib/prisma/schema/migrationGuard"
import { stopSync } from "./lib/sync/syncService"
import { rendererOrigin } from "./rendererOrigin"
import {
  handleRendererProtocol,
  RENDERER_SCHEME_PRIVILEGES,
} from "./rendererProtocol"
import { createMainWindow, setupWindowEvents } from "./windowManager"

/** AI採点のバッチ回収を止める口（起動に成功したときだけ入る） */
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

// カスタムプロトコルを登録する。'appimg://' は webSecurity 有効時にローカルの画像を読むため、
// 画面のスキーム（パッケージ版の 'app://'）は画面の静的書き出しを返すため。
// 注意: app.whenReady() より前に、全部を1回の protocol.registerSchemesAsPrivileged で渡す
protocol.registerSchemesAsPrivileged([
  RENDERER_SCHEME_PRIVILEGES,
  {
    scheme: "appimg",
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      stream: true,
      // フレーム検出（02-template）は画面の origin から fetch で読み込むため、
      // スキーム自体をCORS対象にしないと応答の Access-Control-Allow-Origin が
      // 参照されず、読み込みが失敗する。
      corsEnabled: true,
    },
  },
])

app.on("ready", async () => {
  try {
    // appimg:// プロトコルハンドラを登録
    // appimg:///<共有するファイルの根からの相対パス> → 根の下のファイルを読み込む
    // renderer はこの規則で URL を組み立てる（src/lib/appImageUrl.ts）。変えるときは揃えること
    protocol.handle("appimg", async (request) => {
      try {
        // 根の下に解決できないもの（`..`・絶対パス・根そのもの）と画像でない形式は読まずに断る
        const filePath = resolveAppImageRequestPath(
          request.url,
          getSharedFilesDirectory()
        )
        if (filePath === null) {
          return new Response("Forbidden", { status: 403 })
        }

        const fileUrl = pathToFileURL(filePath).href
        const response = await net.fetch(fileUrl)

        // CORSヘッダーを付与する。
        // フレーム検出（02-template）などは img.crossOrigin="anonymous" で画像を読み込み
        // getImageData でピクセルを解析するため、Access-Control-Allow-Origin が無いと
        // ブラウザのCORSチェックで読み込みが拒否される（img.onerror → "Failed to load image"）。
        // 許すのは画面（renderer）の入口だけ（どこからでも読めるようにはしない）
        const headers = new Headers(response.headers)
        headers.set("Access-Control-Allow-Origin", rendererOrigin)
        headers.set("Vary", "Origin")
        // 画像以外として解釈させない（拡張子から決まる Content-Type のとおりに扱わせる）
        headers.set("X-Content-Type-Options", "nosniff")
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
      await cleanupDecryptedPdfCopies()
    } catch (error) {
      console.warn("Failed to clean up decrypted PDF copies:", error)
    }

    // アプリケーションの初期化
    await initializeApp()

    // 画面の静的書き出しを返すスキーム（パッケージ版のみ。開発時は next dev）
    handleRendererProtocol()

    // メインウィンドウの作成
    const mainWindow = createMainWindow()

    // ウィンドウイベントの設定
    setupWindowEvents(mainWindow)

    // IPCハンドラーの設定
    setupAllIPCHandlers()

    // AI採点: この端末が預けたバッチの結果を、起動時と一定間隔で回収する
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
  // 統合アーカイブの取り込みで開いたまま残った作業ディレクトリを消す。終了の直前は
  // 非同期の処理を待ってもらえないので、ここだけは同期で消す
  for (const workDirectory of takeAllUnifiedArchiveImportWorkDirectories()) {
    try {
      fs.rmSync(workDirectory, { recursive: true, force: true })
    } catch (error) {
      console.warn("Failed to remove unified archive work directory:", error)
    }
  }

  // 統合アーカイブの書き出しの作業者を終わらせる
  try {
    stopUnifiedArchiveExportWorker()
  } catch (error) {
    console.warn("Failed to stop unified archive export worker:", error)
  }

  // AI採点のバッチ回収を止める（預けたバッチは次の起動で回収する）
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
