/**
 * 共有フォルダ内の画像（答案・模範解答・解答用紙の画像要素）を renderer で
 * 表示するための URL の規則。renderer が画像 URL を組み立てるのはここだけ。
 *
 * デスクトップ版では main プロセスが登録する `appimg` プロトコルで読む。
 * 同じ規則に main 側も依存している:
 * - `electron-src/index.ts` のプロトコルハンドラ（`appimg://` / `appimg:///` を
 *   剥がして decodeURIComponent し、相対パスを共有フォルダの絶対パスに直す）
 * - `electron-src/ipc-handlers/miscHandlers.ts` の `resolve-file-protocol-path`
 *   （この関数を使い、encodeURI した相対パスを渡す）
 * 規則を変えるときは両方を揃えること。
 *
 * web 版では `appimg` を読めないので、同一オリジンの `/__appimg/<相対パス>` にし、
 * Service Worker（`web/serviceWorker/serviceWorker.ts`）がデータフォルダ（OPFS）から返す。
 * 画面の静的書き出しはデスクトップ版と同じものを配るので、どちらで動いているかは
 * 実行時に見分ける（`src/lib/webRuntime.ts`）。画面と、main の処理を動かす Worker の両方で
 * 見分けられるので、main の `resolve-file-protocol-path` もこの関数で組み立てれば、
 * web 版では web の URL を返す。
 *
 * 相対パスを渡す。絶対パスを載せると `appimg:////Users/...` となり、
 * URL 正規化でパスが壊れる。
 */

import { isWebRuntime } from "@/lib/webRuntime"

const APP_IMAGE_URL_PREFIX = "appimg:///"

/** web 版の画像 URL の頭。Service Worker はこの頭の要求だけを受け持つ */
export const WEB_APP_IMAGE_URL_PREFIX = "/__appimg/"

/** 共有フォルダからの相対パスを、画面に表示できる画像 URL にする（エンコードはしない） */
export function toAppImageUrl(relativePath: string): string {
  const prefix = isWebRuntime()
    ? WEB_APP_IMAGE_URL_PREFIX
    : APP_IMAGE_URL_PREFIX
  return `${prefix}${relativePath}`
}

/**
 * `toAppImageUrl` で作った URL から相対パスを取り出す（`appimg://` も受け付ける）
 */
export function fromAppImageUrl(appImageUrl: string): string {
  if (appImageUrl.startsWith(WEB_APP_IMAGE_URL_PREFIX)) {
    return appImageUrl.slice(WEB_APP_IMAGE_URL_PREFIX.length)
  }
  return appImageUrl.replace(/^appimg:\/\/\/?/, "")
}
