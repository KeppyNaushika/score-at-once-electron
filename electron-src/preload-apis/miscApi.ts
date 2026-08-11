import { invoke } from "./invoke"

/** 汎用ユーティリティのIPC API（画像取得・ファイルパス解決・存在確認） */
export function createMiscApi() {
  return {
    // File/image related
    getImageData: (relativePath: string) =>
      invoke("get-image-data", relativePath),
    resolveFileProtocolPath: (relativePath: string) =>
      invoke("resolve-file-protocol-path", relativePath),
    checkFileExists: (relativePath: string) =>
      invoke("check-file-exists", relativePath),
  }
}
