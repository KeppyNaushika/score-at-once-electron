/**
 * web 版の書き出し（`web-dist/`。`scripts/web/buildWeb.mjs`）を、手元で確かめるために配る。
 *
 * ファイルの探し方はデスクトップ版の配信と同じ `resolveRendererFile`
 * （`electron-src/lib/rendererFiles.ts`）を使う。動的ルートの実際の id を殻へ書き換え、
 * 見つからなければ `404.html` を返す。書き換えの規則の出どころは `src/lib/routeShell.ts` だけ。
 *
 * ヘッダー（COOP/COEP・CSP など）は、本番の `_headers` と同じ定義（`scripts/web/webHeaders.mjs`）
 * から、要求のパスで当てる。手元の確認用なので、どのファイルも毎回読み直させる（`Cache-Control`）。
 *
 * 使い方: node scripts/web/serveWeb.mjs [--port 4173]（環境変数 PORT でも指定できる）
 */
import { createReadStream } from "node:fs"
import { createServer } from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { tsImport } from "tsx/esm/api"

import { headersForPath } from "./webHeaders.mjs"

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)
const WEB_DIST_DIR = path.join(repoRoot, "web-dist")
const DEFAULT_PORT = 4173

const { resolveRendererFile } = await tsImport(
  "../../electron-src/lib/rendererFiles.ts",
  {
    parentURL: import.meta.url,
    tsconfig: path.join(repoRoot, "tsconfig.json"),
  }
)

const readPort = () => {
  const portFlagIndex = process.argv.indexOf("--port")
  const portText =
    portFlagIndex >= 0 ? process.argv[portFlagIndex + 1] : process.env.PORT
  if (portText === undefined) return DEFAULT_PORT
  const port = Number(portText)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`ポートの指定が正しくありません: ${portText}`)
  }
  return port
}

/** 要求の URL のパス（クエリを除く）。読めない URL は `/` として扱う（ヘッダーを当てるためだけ） */
const requestPathOf = (requestUrl) => {
  try {
    return new URL(requestUrl, "http://localhost").pathname
  } catch {
    return "/"
  }
}

const server = createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" })
    response.end()
    return
  }
  const requestUrl = request.url ?? "/"
  const deliveryHeaders = headersForPath(requestPathOf(requestUrl))
  const rendererFile = resolveRendererFile(WEB_DIST_DIR, requestUrl)
  if (!rendererFile) {
    response.writeHead(404, {
      ...deliveryHeaders,
      "Content-Type": "text/plain; charset=utf-8",
    })
    response.end("Not Found")
    return
  }
  response.writeHead(rendererFile.statusCode, {
    ...deliveryHeaders,
    "Content-Type": rendererFile.contentType,
  })
  if (request.method === "HEAD") {
    response.end()
    return
  }
  createReadStream(rendererFile.filePath)
    .on("error", (error) => {
      console.error("読めませんでした:", rendererFile.filePath, error)
      response.destroy(error)
    })
    .pipe(response)
})

const port = readPort()
server.listen(port, "127.0.0.1", () => {
  console.log(`web 版を配っています: http://127.0.0.1:${port}/`)
})
