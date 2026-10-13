import type { CustomScheme } from "electron"
import { app, protocol } from "electron"
import * as fsPromises from "fs/promises"
import * as path from "path"

import { resolveRendererFile } from "./lib/rendererFiles"
import { RENDERER_HOST, RENDERER_SCHEME } from "./rendererOrigin"

/**
 * 画面の静的書き出しの置き場（`next.config.ts` の `RENDERER_EXPORT_DIR`）。
 * forge.config.js の `extraResource` で Resources 直下に置かれる
 */
const RENDERER_EXPORT_DIR = "renderer"

/**
 * 画面のスキームに与える特権。`app.whenReady()` より前に
 * `protocol.registerSchemesAsPrivileged` へ渡す（`index.ts`）。
 *
 * - standard: 相対 URL の解決・origin・localStorage を http と同じ規則で扱う
 * - secure: 安全な出どころとして扱う（`crypto.subtle` など、安全な出どころでしか
 *   使えない API が要る）
 * - supportFetchAPI: 画面が書き出しの中のファイル（ページの切り替えで読む `.txt`・
 *   wasm）を `fetch` で読む
 * - codeCache: 束ねたスクリプトの V8 のコードキャッシュを効かせる（http と同じ速さで
 *   起動させる）
 */
export const RENDERER_SCHEME_PRIVILEGES: CustomScheme = {
  scheme: RENDERER_SCHEME,
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    codeCache: true,
  },
}

const notFoundResponse = () =>
  new Response("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })

/**
 * パッケージ版で、画面の静的書き出しを `app://score-at-once/…` として返す（開発時は
 * `next dev` を使うのでスキップ）。
 *
 * web 版と同じ書き出しを、web 版の配信と同じ探し方で返す（`src/lib/routeShell.ts`）。
 * サーバーは立てない。以前は `http://localhost:3000` で待ち受けており、ほかのアプリが
 * 3000 番を使っている PC では起動できなかった
 */
export function handleRendererProtocol(): void {
  if (!app.isPackaged) return

  const exportDir = path.join(process.resourcesPath, RENDERER_EXPORT_DIR)
  void fsPromises.access(path.join(exportDir, "index.html")).catch(() => {
    console.error(`❌ Renderer export not found at ${exportDir}`)
  })

  protocol.handle(RENDERER_SCHEME, async (request) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      })
    }
    const requestUrl = new URL(request.url)
    if (requestUrl.host !== RENDERER_HOST) return notFoundResponse()

    const rendererFile = resolveRendererFile(
      exportDir,
      `${requestUrl.pathname}${requestUrl.search}`
    )
    if (!rendererFile) return notFoundResponse()

    try {
      const body =
        request.method === "HEAD"
          ? null
          : await fsPromises.readFile(rendererFile.filePath)
      return new Response(body, {
        status: rendererFile.statusCode,
        headers: { "Content-Type": rendererFile.contentType },
      })
    } catch (error) {
      console.error("Error reading", rendererFile.filePath, error)
      return new Response("Internal Server Error", { status: 500 })
    }
  })
}
