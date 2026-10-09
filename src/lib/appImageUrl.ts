/**
 * 共有フォルダ内の画像（答案・模範解答・解答用紙の画像要素）を renderer で
 * 表示するための URL の規則。renderer が画像 URL を組み立てるのはここだけ。
 *
 * デスクトップ版では main プロセスが登録する `appimg` プロトコルで読む。
 * 同じ規則に main 側も依存している:
 * - `electron-src/index.ts` のプロトコルハンドラ（`appimg://` / `appimg:///` を
 *   剥がして decodeURIComponent し、相対パスを共有フォルダの絶対パスに直す）
 * - `electron-src/ipc-handlers/miscHandlers.ts` の `resolve-file-protocol-path`
 *   （こちらは encodeURI してから組み立てる）
 * 規則を変えるときは3か所を揃えること。
 *
 * 相対パスを渡す。絶対パスを載せると `appimg:////Users/...` となり、
 * URL 正規化でパスが壊れる。
 */

const APP_IMAGE_URL_PREFIX = "appimg:///"

/** 共有フォルダからの相対パスを、画面に表示できる画像 URL にする（エンコードはしない） */
export function toAppImageUrl(relativePath: string): string {
  return `${APP_IMAGE_URL_PREFIX}${relativePath}`
}

/** `toAppImageUrl` で作った URL から相対パスを取り出す（`appimg://` も受け付ける） */
export function fromAppImageUrl(appImageUrl: string): string {
  return appImageUrl.replace(/^appimg:\/\/\/?/, "")
}
