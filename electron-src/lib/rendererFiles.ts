import * as fs from "fs"
import * as path from "path"

import { toRouteShellPath } from "@/lib/routeShell"

/**
 * 画面の静的書き出し（`next.config.ts` の `RENDERER_EXPORT_DIR`）から、要求された URL の
 * パスに当たるファイルを探す。web 版の配信と同じ探し方をする（`src/lib/routeShell.ts`）:
 *
 * 1. 動的ルートの実際の id を殻の値へ書き換える（`/exams/<id>/…` → `/exams/__/…`）
 * 2. そのパスのファイル → `.html` を足したファイル → `index.html` の順に探す
 * 3. どれも無ければ `404.html` を 404 で返す
 */

/** 書き出しに入っている拡張子の Content-Type */
const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
}

const DEFAULT_CONTENT_TYPE = "application/octet-stream"

export interface RendererFile {
  filePath: string
  statusCode: 200 | 404
  contentType: string
}

const isFile = (filePath: string) => {
  try {
    return fs.statSync(filePath).isFile()
  } catch {
    return false
  }
}

/** 書き出しの外を指すパス（`..` など）は探さない */
const insideExportDir = (exportDir: string, filePath: string) =>
  filePath.startsWith(exportDir + path.sep)

const toRendererFile = (
  filePath: string,
  statusCode: RendererFile["statusCode"]
): RendererFile => ({
  filePath,
  statusCode,
  contentType:
    CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? DEFAULT_CONTENT_TYPE,
})

/**
 * 要求の URL（`req.url`。クエリ付き）に当たるファイル。見つからなければ `404.html`。
 * `404.html` も無いときは null。
 */
export function resolveRendererFile(
  exportDir: string,
  requestUrl: string
): RendererFile | null {
  const rootDir = path.resolve(exportDir)
  const notFoundPath = path.join(rootDir, "404.html")
  const notFound = isFile(notFoundPath)
    ? toRendererFile(notFoundPath, 404)
    : null

  let pathname: string
  try {
    pathname = decodeURIComponent(
      new URL(requestUrl, "http://localhost").pathname
    )
  } catch {
    return notFound
  }

  const shellPath = toRouteShellPath(pathname)
  const basePath = path.join(rootDir, shellPath)
  const candidates = [
    basePath,
    `${basePath}.html`,
    path.join(basePath, "index.html"),
  ]
  const found = candidates
    .filter((candidate) => insideExportDir(rootDir, candidate))
    .find(isFile)
  return found ? toRendererFile(found, 200) : notFound
}
