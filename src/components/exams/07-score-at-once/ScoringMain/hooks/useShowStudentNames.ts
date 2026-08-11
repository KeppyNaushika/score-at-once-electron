/**
 * @fileoverview 生徒氏名の表示切り替え設定フック
 */

import { useUserPreference } from "@/hooks/useUserPreference"

/** 採点グリッドで生徒氏名を表示するかをユーザー設定として永続化するフック */
export function useShowStudentNames() {
  const { value, setValue } = useUserPreference("showStudentNames")

  return { showStudentNames: value, setShowStudentNames: setValue }
}
