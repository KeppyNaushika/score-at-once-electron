import { bind } from "./invoke"

/** 汎用ユーティリティのIPC API（画像取得・ファイルパス解決・存在確認） */
export function createMiscApi() {
  return {
    // File/image related
    getImageData: bind("get-image-data"),
    resolveFileProtocolPath: bind("resolve-file-protocol-path"),
    checkFileExists: bind("check-file-exists"),
  }
}
