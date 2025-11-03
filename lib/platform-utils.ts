/**
 * プラットフォーム関連のユーティリティ関数
 */

/**
 * macOS検出
 */
export const isMacOS = (): boolean => {
  if (typeof window !== "undefined") {
    return window.navigator.platform.toUpperCase().indexOf("MAC") >= 0
  }
  return false
}

/**
 * 現在のプラットフォームに応じた修飾キーラベルを取得
 * macOSの場合は "Option"、それ以外は "Alt"
 */
export const getModifierKeyLabel = (): string => {
  return isMacOS() ? "Option" : "Alt"
}
