/**
 * キーバインディング管理フック
 * 採点画面でキーバインディングを取得するために使用
 */

import { useShortcutContext } from "../ScoringMain/contexts/ShortcutProvider"
import type { KeyBinding } from "../types"

/**
 * キーバインディング管理の結果
 */
export interface UseKeyBindingsResult {
  /** 現在のキーバインディング */
  keyBindings: KeyBinding
}

/**
 * キーバインディングを管理するフック
 * ShortcutProviderのコンテキストから取得
 *
 * 注意: このフックはShortcutProvider内でのみ使用可能
 * 一括採点画面以外では使用できない
 */
export function useKeyBindings(): UseKeyBindingsResult {
  const { keyBindings } = useShortcutContext()

  return {
    keyBindings,
  }
}
