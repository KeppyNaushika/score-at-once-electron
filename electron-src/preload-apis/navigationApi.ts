import { ipcRenderer } from "electron"

/** ブラウザ的な戻る/進む・履歴一覧を扱う IPC API */
export function createNavigationApi() {
  return {
    navigation: {
      getState: () => ipcRenderer.invoke("navigation:get-state"),
      goToIndex: (index: number) =>
        ipcRenderer.invoke("navigation:go-to-index", index),
    },
  }
}
