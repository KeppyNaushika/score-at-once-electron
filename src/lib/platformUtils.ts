/**
 * プラットフォーム関連のユーティリティ関数。
 *
 * キーの割り当ては `Ctrl` / `Alt` で持つ（`normalizeKey.ts` は macOS の ⌘ を `Ctrl` に読む）。
 * 画面に出す呼び名はここで1か所だけ決める（macOS: ⌘ / Option、それ以外: Ctrl / Alt）。
 */

/** 修飾キーの画面での呼び名 */
export interface ModifierKeyLabels {
  /** 割り当ての `Ctrl`（macOS では ⌘） */
  primary: string
  /** 割り当ての `Alt`（macOS では Option） */
  alt: string
}

const MAC_MODIFIER_KEY_LABELS: ModifierKeyLabels = {
  primary: "⌘",
  alt: "Option",
}
const OTHER_MODIFIER_KEY_LABELS: ModifierKeyLabels = {
  primary: "Ctrl",
  alt: "Alt",
}

/**
 * macOS検出
 */
const isMacOS = (): boolean => {
  if (typeof window !== "undefined") {
    return window.navigator.platform.toUpperCase().indexOf("MAC") >= 0
  }
  return false
}

/** 現在のプラットフォームでの修飾キーの呼び名（同じプラットフォームでは同じオブジェクトを返す） */
export const getModifierKeyLabels = (): ModifierKeyLabels =>
  isMacOS() ? MAC_MODIFIER_KEY_LABELS : OTHER_MODIFIER_KEY_LABELS

/**
 * 事前描画（サーバ）での呼び名。プラットフォームが読めないので macOS 以外の呼び名にする
 * （`useSyncExternalStore` のサーバのスナップショットに使い、マウント後に差し替える）
 */
export const getServerModifierKeyLabels = (): ModifierKeyLabels =>
  OTHER_MODIFIER_KEY_LABELS
