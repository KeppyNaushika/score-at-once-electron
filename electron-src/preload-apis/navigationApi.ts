import { bind } from "./invoke"

/** ブラウザ的な戻る/進む・履歴一覧を扱う IPC API */
export function createNavigationApi() {
  return {
    navigation: {
      getState: bind("navigation:get-state"),
      goToIndex: bind("navigation:go-to-index"),
    },
  }
}
