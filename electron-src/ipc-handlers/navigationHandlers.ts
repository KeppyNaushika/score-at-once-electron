import { ipcMain } from "electron"

/** ナビゲーション履歴の1エントリ（URLと履歴内インデックス） */
export interface NavigationHistoryEntry {
  index: number
  url: string
}

/** renderer のブラウザ的な戻る/進む UI に渡すナビゲーション状態 */
export interface NavigationState {
  canGoBack: boolean
  canGoForward: boolean
  activeIndex: number
  entries: NavigationHistoryEntry[]
}

/**
 * ブラウザ的な「戻る/進む」と履歴一覧を renderer へ提供する IPC ハンドラーを登録する。
 * Chromium のセッション履歴（Next.js の pushState 遷移を含む）をそのまま利用するため、
 * renderer 側で独自の履歴スタックを再実装する必要がない。
 */
export function setupNavigationHandlers(): void {
  ipcMain.handle("navigation:get-state", (event): NavigationState => {
    const history = event.sender.navigationHistory
    const entries = history.getAllEntries().map((entry, index) => ({
      index,
      url: entry.url,
    }))
    return {
      canGoBack: history.canGoBack(),
      canGoForward: history.canGoForward(),
      activeIndex: history.getActiveIndex(),
      entries,
    }
  })

  ipcMain.handle("navigation:go-to-index", (event, index: number) => {
    event.sender.navigationHistory.goToIndex(index)
  })
}
