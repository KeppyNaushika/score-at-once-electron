import { ipcRenderer } from "electron"

export function createMiscApi() {
  return {
    // File/image related
    getImageData: (relativePath: string) =>
      ipcRenderer.invoke("get-image-data", relativePath),
    getAssetPath: (assetPath: string) =>
      ipcRenderer.invoke("get-asset-path", assetPath),
    resolveFileProtocolPath: (relativePath: string) =>
      ipcRenderer.invoke("resolve-file-protocol-path", relativePath),
    readFileAsBase64: (filePath: string) =>
      ipcRenderer.invoke("read-file-as-base64", filePath),
    checkFileExists: (relativePath: string) =>
      ipcRenderer.invoke("check-file-exists", relativePath),

    // Data management related
    getDataDirectoryInfo: () => ipcRenderer.invoke("get-data-directory-info"),
    openDataDirectory: () => ipcRenderer.invoke("open-data-directory"),
    deleteAllData: () => ipcRenderer.invoke("delete-all-data"),
  }
}
