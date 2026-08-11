/**
 * @fileoverview レイアウト方向設定フック
 */

import { useUserPreference } from "@/hooks/useUserPreference"

/** 採点グリッドのレイアウト方向（右下・左下・下右・下左）を永続化するフック */
export function useLayoutDirection() {
  const { value, setValue } = useUserPreference("layoutDirection")

  return { layoutDirection: value, setLayoutDirection: setValue }
}
