/**
 * ナビゲーション履歴関連API（ブラウザ的な戻る/進む・履歴一覧）
 */

/** ナビゲーション履歴の1エントリ（URLと履歴内インデックス） */
export interface NavigationHistoryEntryData {
  index: number
  url: string
}

/** 戻る/進む UI に渡すナビゲーション状態 */
export interface NavigationStateData {
  canGoBack: boolean
  canGoForward: boolean
  activeIndex: number
  entries: NavigationHistoryEntryData[]
}

export interface NavigationAPI {
  navigation: {
    getState: () => Promise<NavigationStateData>
    goToIndex: (index: number) => Promise<void>
  }
}
