/**
 * @fileoverview 切り出し領域の余白設定フック
 */

import { useUserPreference } from "@/hooks/useUserPreference"

/** 答案の切り出し領域に付ける余白（px）をユーザー設定として永続化するフック */
export function useExpandMargin() {
  const { value, setValue } = useUserPreference("expandMargin")

  return { expandMargin: value, setExpandMargin: setValue }
}
