/**
 * @fileoverview 模範解答表示設定フック
 * @description 模範解答の表示モード・透明度・キー動作を管理
 */

import { useUserPreference } from "@/hooks/useUserPreference"

/** 模範解答の表示モード・透明度・キー動作設定をユーザー設定として永続化するフック */
export function useMasterAnswerSettings() {
  const displayMode = useUserPreference("masterAnswerDisplayMode")
  const opacity = useUserPreference("masterAnswerOpacity")
  const keyBehavior = useUserPreference("masterAnswerKeyBehavior")

  return {
    masterAnswerDisplayMode: displayMode.value,
    masterAnswerOpacity: opacity.value,
    masterAnswerKeyBehavior: keyBehavior.value,
    setMasterAnswerDisplayMode: displayMode.setValue,
    setMasterAnswerOpacity: opacity.setValue,
    setMasterAnswerKeyBehavior: keyBehavior.setValue,
  }
}
