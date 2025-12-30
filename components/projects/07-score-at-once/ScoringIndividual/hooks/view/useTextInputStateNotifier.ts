/**
 * @fileoverview テキスト入力状態通知フック
 * テキスト入力状態の変更を親コンポーネントに通知する
 */
import { useEffect } from "react"

/** テキスト入力状態通知フックのパラメータ */
export interface UseTextInputStateNotifierParams {
  /** テキスト入力表示状態 */
  showTextInput: boolean
  /** テキスト入力状態変更コールバック */
  onTextInputStateChange?: (showTextInput: boolean) => void
}

/**
 * テキスト入力状態通知フック
 *
 * @description
 * テキスト入力状態（showTextInput）が変更されたとき、
 * 親コンポーネントに通知するフック。
 * キーボードショートカットの無効化などに使用される。
 *
 * @param params - フックパラメータ
 */
export function useTextInputStateNotifier({
  showTextInput,
  onTextInputStateChange,
}: UseTextInputStateNotifierParams): void {
  useEffect(() => {
    if (onTextInputStateChange) {
      onTextInputStateChange(showTextInput)
    }
  }, [showTextInput, onTextInputStateChange])
}
