/**
 * @fileoverview 自動スクロール設定フック
 */

import { useUserPreference } from "@/hooks/useUserPreference"

/** 採点時に選択セルへ自動スクロールするかをユーザー設定として永続化するフック */
export function useAutoScroll() {
  const { value, setValue } = useUserPreference("autoScroll")

  return { autoScroll: value, setAutoScroll: setValue }
}
