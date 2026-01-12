import { app } from "electron"
import type { Server } from "http"
import type { IncomingMessage, ServerResponse } from "http"
import type { NextServer } from "next/dist/server/next"
import { delimiter, join } from "path"

// Electron公式推奨の環境判定方法
const isDev = !app.isPackaged

let nextApp: NextServer | null = null
let httpServer: Server | null = null

/**
 * packaged環境では .next が Resources 配下に置かれ、node_modules は app.asar 内にある。
 * デフォルトのモジュール解決では親ディレクトリに node_modules が見つからないため、
 * NODE_PATH に候補パスを追加して Next.js の runtime から参照できるようにする。
 */
const ensurePackagedNodePath = (basePath: string) => {
  try {
    const fs = require("fs")
    const Module = require("module") as typeof import("module") & {
      _initPaths(): void
    }

    const candidatePaths = [
      join(basePath, "app.asar", "node_modules"),
      join(basePath, "app.asar.unpacked", "node_modules"),
      join(basePath, "node_modules"),
    ].filter((p: string) => fs.existsSync(p))

    if (!candidatePaths.length) {
      console.warn(
        `⚠ Warning: No node_modules directory found near ${basePath}`
      )
      return
    }

    const existing = process.env.NODE_PATH
      ? process.env.NODE_PATH.split(delimiter).filter(Boolean)
      : []
    const updated = Array.from(new Set([...candidatePaths, ...existing]))

    process.env.NODE_PATH = updated.join(delimiter)
    Module._initPaths()
  } catch (error) {
    console.warn("Failed to extend NODE_PATH for packaged runtime:", error)
  }
}

export async function startEmbeddedNextServer(): Promise<void> {
  if (isDev) return // 開発時は外部サーバーを使用

  try {
    const { createServer } = require("http")

    const hostname = "localhost"
    const port = 3000

    // Next.jsアプリの初期化
    let appDir
    if (process.resourcesPath) {
      // パッケージ化されている場合、Resourcesディレクトリを直接使用
      // forge.config.jsのextraResourceで.nextとpublicの両方がResourcesディレクトリに配置される
      appDir = process.resourcesPath

      // .next から next 本体を解決できるよう NODE_PATH を追加
      ensurePackagedNodePath(appDir)

      // .nextとpublicディレクトリの存在確認
      try {
        const fs = require("fs")
        const nextDir = join(appDir, ".next")
        const publicDir = join(appDir, "public")

        if (!fs.existsSync(nextDir)) {
          console.warn(`⚠ Warning: .next directory not found at ${nextDir}`)
        }
        if (!fs.existsSync(publicDir)) {
          console.warn(`⚠ Warning: public directory not found at ${publicDir}`)
        }

        // PDF workerファイルの存在確認
        const pdfWorkerPath = join(publicDir, "js", "pdf.worker.min.mjs")
        if (!fs.existsSync(pdfWorkerPath)) {
          console.error(`❌ PDF worker file not found at ${pdfWorkerPath}`)
        }
      } catch (error) {
        console.error(`❌ Error checking directories:`, error)
      }
    } else {
      // 開発環境の場合
      appDir = process.cwd()
    }

    const next = require("next")
    nextApp = next({
      dev: false,
      hostname,
      port,
      dir: appDir,
    }) as NextServer

    const handle = nextApp.getRequestHandler()

    await nextApp.prepare()

    httpServer = createServer(
      async (req: IncomingMessage, res: ServerResponse) => {
        try {
          await handle(req, res)
        } catch (err) {
          console.error("Error occurred handling", req.url, err)
          res.statusCode = 500
          res.end("internal server error")
        }
      }
    )

    return new Promise<void>((resolve, reject) => {
      httpServer!.listen(port, hostname, () => {
        console.log("Next.js server is now ready to accept connections")
        resolve()
      })
      httpServer!.on("error", (err: Error) => {
        console.error("Failed to start Next.js server:", err)
        reject(err)
      })
    })
  } catch (error) {
    console.error("Error starting embedded Next.js server:", error)
    throw error
  }
}

export function stopEmbeddedNextServer(): void {
  if (httpServer) {
    httpServer.close()
    httpServer = null
  }
  if (nextApp) {
    nextApp = null
  }
}
