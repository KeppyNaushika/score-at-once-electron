import { OPFS_VIRTUAL_ROOT, WEB_DATA_DIRECTORY } from "../worker/webPaths"

/**
 * 画像を返す Service Worker（`serviceWorker.ts`）の、要求の見分け・パスの解決・応答の頭を決める部分。
 * OPFS にもイベントにも触らないので、テストから直に呼べる（`__tests__/web/appImageResponse.test.ts`）。
 *
 * 返すのは、画面が画像として読むデータフォルダ（OPFS の `data/`）の中のファイルだけ:
 * - 画面は `/__appimg/<データフォルダからの相対パス>` しか作らない（`src/lib/appImageUrl.ts`）。
 *   データフォルダの外（端末の設定・DB の領域・一時ファイル・ダウンロードの置き場）は指させない
 * - ページとして開く要求（遷移・iframe・object など）には答えない。画像として読むものだけに答える
 * - 形式はラスター画像に限る。SVG は解答用紙の画像要素で取り込めるので、`<img>`・SVG の
 *   `<image>` として読むとき（スクリプトが動かない）だけ返す
 * - どの応答にも、文書として解釈させない頭（nosniff・CSP の sandbox）を付ける
 */

/** 要求のうち、答えるかどうかの判断に使う部分（`Request` の一部） */
export interface AppImageRequestKind {
  mode: RequestMode
  destination: RequestDestination
}

/**
 * 画像として読む要求か。`<img>`・SVG の `<image>`・CSS の背景は "image"、
 * `fetch()` で中身を読むとき（PDF 出力の描画）は ""。ページ遷移や iframe・object・
 * Worker の読み込みには答えない
 */
export const isImageRequest = (requestKind: AppImageRequestKind): boolean =>
  requestKind.mode !== "navigate" &&
  (requestKind.destination === "image" || requestKind.destination === "")

/** ラスター画像。どの読み方でも返す */
const RASTER_CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
}

/** SVG は中にスクリプトを持てるので、画像として描く読み方（"image"）のときだけ返す */
const SVG_EXTENSION = "svg"
const SVG_CONTENT_TYPE = "image/svg+xml"

/** そのファイルを返すときの Content-Type。返さない形式なら null */
export const appImageContentTypeOf = (
  fileName: string,
  destination: RequestDestination
): string | null => {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? ""
  if (extension === SVG_EXTENSION) {
    return destination === "image" ? SVG_CONTENT_TYPE : null
  }
  return RASTER_CONTENT_TYPES[extension] ?? null
}

/** データフォルダの、OPFS のルートからの位置 */
export const DATA_DIRECTORY_SEGMENTS = WEB_DATA_DIRECTORY.slice(
  `${OPFS_VIRTUAL_ROOT}/`.length
).split("/")

/**
 * 画像 URL のパス（`/__appimg/` より後ろ）を、OPFS のルートからのパスの区切りにする。
 * 必ずデータフォルダの下を指す。絶対パス（`/` 始まり）・`..`・区切り文字を含む名前は断る
 */
export const toDataDirectorySegments = (
  encodedPath: string
): string[] | null => {
  let filePath: string
  try {
    filePath = decodeURIComponent(encodedPath)
  } catch {
    return null
  }
  // 画面は相対パスしか作らない。絶対パスは受け持たない
  if (filePath.startsWith("/") || filePath.includes("\\")) return null
  if (filePath.includes("\0")) return null
  // projects/ → exams/（v0.6.x のリネーム。デスクトップ版のハンドラと同じ）
  if (filePath.startsWith("projects/")) {
    filePath = "exams/" + filePath.slice("projects/".length)
  }
  const relativeSegments = filePath
    .split("/")
    .filter((segment) => segment !== "" && segment !== ".")
  if (relativeSegments.length === 0 || relativeSegments.includes("..")) {
    return null
  }
  return [...DATA_DIRECTORY_SEGMENTS, ...relativeSegments]
}

/**
 * どの応答にも付ける頭。中身を文書として解釈させない（nosniff・sandbox）、他のオリジンから
 * 埋め込ませない（CORP）。画面と同じオリジンからしか読まないので CORS の頭は付けない
 * （同じオリジンの要求は `crossOrigin="anonymous"` でも CORS の検査を受けず、canvas も汚れない。
 * COEP の require-corp も同じオリジンの資源には CORP を求めない）
 */
const PROTECTIVE_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  // SVG を画像として描くときのために、インラインの style だけは許す（スクリプトは許さない）
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  "Cross-Origin-Resource-Policy": "same-origin",
  // 同じパスのまま中身を書き換えることがあるので、毎回読み直させる
  "Cache-Control": "no-store",
}

/** 画像を返す応答の頭 */
export const appImageHeaders = (
  contentType: string,
  byteLength: number
): Record<string, string> => ({
  ...PROTECTIVE_HEADERS,
  "Content-Type": contentType,
  "Content-Length": String(byteLength),
})

/** 返さない・見つからないときの応答 */
export const appImageNotFound = (): Response =>
  new Response("File not found", {
    status: 404,
    headers: {
      ...PROTECTIVE_HEADERS,
      "Content-Type": "text/plain; charset=utf-8",
    },
  })
