import { ipcRenderer } from "electron"

/** 汎用ユーティリティのIPC API（画像取得・ファイルパス解決・存在確認） */
export function createMiscApi() {
  return {
    // File/image related
    getImageData: (relativePath: string) =>
      ipcRenderer.invoke("get-image-data", relativePath),
    resolveFileProtocolPath: (relativePath: string) =>
      ipcRenderer.invoke("resolve-file-protocol-path", relativePath),
    checkFileExists: (relativePath: string) =>
      ipcRenderer.invoke("check-file-exists", relativePath),
  }
}
