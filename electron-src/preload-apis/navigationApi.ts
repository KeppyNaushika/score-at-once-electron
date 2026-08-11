import { invoke } from "./invoke"

/** ブラウザ的な戻る/進む・履歴一覧を扱う IPC API */
export function createNavigationApi() {
  return {
    navigation: {
      getState: () => invoke("navigation:get-state"),
      goToIndex: (index: number) => invoke("navigation:go-to-index", index),
    },
  }
}
