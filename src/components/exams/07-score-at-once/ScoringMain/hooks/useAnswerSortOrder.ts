/**
 * @fileoverview 一覧の並び順設定フック
 */

import { useUserPreference } from "@/hooks/useUserPreference"

/** 答案一覧の並び順（表示順・白さ順・濃さ順）を永続化するフック */
export function useAnswerSortOrder() {
  const { value, setValue } = useUserPreference("answerSortOrder")

  return { answerSortOrder: value, setAnswerSortOrder: setValue }
}
