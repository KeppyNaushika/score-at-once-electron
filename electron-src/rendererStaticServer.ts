import { app } from "electron"
import * as fs from "fs"
import type { IncomingMessage, Server, ServerResponse } from "http"
import { createServer } from "http"
import * as path from "path"

import { resolveRendererFile } from "./lib/rendererFiles"
import { rendererPort } from "./rendererPort"

// Electron公式推奨の環境判定方法
const isDev = !app.isPackaged

/**
 * 画面の静的書き出しの置き場（`next.config.ts` の `RENDERER_EXPORT_DIR`）。
 * forge.config.js の `extraResource` で Resources 直下に置かれる
 */
const RENDERER_EXPORT_DIR = "renderer"

let httpServer: Server | null = null

const handleRequest = (
  exportDir: string,
  req: IncomingMessage,
  res: ServerResponse
) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" })
    res.end()
    return
  }
  const rendererFile = resolveRendererFile(exportDir, req.url ?? "/")
  if (!rendererFile) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
    res.end("Not Found")
    return
  }
  res.writeHead(rendererFile.statusCode, {
    "Content-Type": rendererFile.contentType,
  })
  if (req.method === "HEAD") {
    res.end()
    return
  }
  fs.createReadStream(rendererFile.filePath)
    .on("error", (error) => {
      console.error("Error reading", rendererFile.filePath, error)
      res.destroy(error)
    })
    .pipe(res)
}

/**
 * パッケージ化環境で、画面の静的書き出しを配る（開発時は `next dev` を使うのでスキップ）。
 *
 * web 版と同じ書き出しを、web 版の配信と同じ探し方で配る（`src/lib/routeShell.ts`）。
 * 窓の URL（`http://localhost:<port>`）は以前の同梱 Next サーバーと同じにしておく。
 * オリジンが変わると、画面が localStorage に置いた設定が読めなくなる
 */
export async function startRendererStaticServer(): Promise<void> {
  if (isDev) return

  const exportDir = path.join(process.resourcesPath, RENDERER_EXPORT_DIR)
  if (!fs.existsSync(path.join(exportDir, "index.html"))) {
    console.error(`❌ Renderer export not found at ${exportDir}`)
  }

  const hostname = "localhost"
  httpServer = createServer((req, res) => handleRequest(exportDir, req, res))

  return new Promise<void>((resolve, reject) => {
    httpServer!.listen(rendererPort, hostname, () => {
      console.log("Renderer server is now ready to accept connections")
      resolve()
    })
    httpServer!.on("error", (err: Error) => {
      console.error("Failed to start renderer server:", err)
      reject(err)
    })
  })
}
