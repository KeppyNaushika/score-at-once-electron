/**
 * コンテキスト値設定フック
 * コンポーネントの状態をショートカットシステムのコンテキストに反映させる
 *
 * 使用例:
 * ```tsx
 * const [gradingMode, setGradingMode] = useState<'grid' | 'individual'>('grid')
 * useContextValue('gradingMode', gradingMode)
 *
 * const hasSelection = selectedAnswers.size > 0
 * useContextValue('hasSelectedAnswers', hasSelection)
 * ```
 */

import { useEffect } from "react"

import type { ScoringContextState } from "../ScoringMain/contexts/shortcutContextTypes"
import { useShortcutContext } from "../ScoringMain/contexts/ShortcutProvider"

/**
 * コンテキスト値を設定するフック
 * 値が変更されると自動的にコンテキストが更新される
 *
 * @param key - コンテキストのキー
 * @param value - 設定する値
 *
 * @example
 * ```tsx
 * // 採点モードの状態を反映
 * useContextValue('gradingMode', mode)
 *
 * // モーダルの表示状態を反映
 * useContextValue('modalOpen', isOpen)
 *
 * // 答案の選択状態を反映
 * useContextValue('hasSelectedAnswers', selectedAnswers.size > 0)
 * ```
 */
export function useContextValue<K extends keyof ScoringContextState>(
  key: K,
  value: ScoringContextState[K]
) {
  const { setContextValue } = useShortcutContext()

  useEffect(() => {
    // コンテキスト値を更新
    setContextValue(key, value)

    // アンマウント時の処理は不要
    // （他のコンポーネントが同じキーを使う可能性があるため）
    // コンテキスト値は ShortcutProvider が管理する
  }, [key, value, setContextValue])
}
