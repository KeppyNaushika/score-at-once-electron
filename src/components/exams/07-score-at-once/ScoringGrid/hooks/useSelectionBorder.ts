/**
 * 選択枠の色を取得するフック
 */

import { useUserPreference } from "@/hooks/useUserPreference"

const DEFAULT_SELECTION_BORDER_COLOR = "#F97316" // orange-500

/**
 * 選択枠のボーダー色をユーザー設定から読むフック。
 *
 * 設定画面での変更は、同じキーのキャッシュを共有しているだけで伝わる。
 * 以前は `selectionBorderColorChanged` という自作イベントで通知していた。
 */
export function useSelectionBorder(): string {
  const { value } = useUserPreference("selectionBorderColor")

  return value ?? DEFAULT_SELECTION_BORDER_COLOR
}
