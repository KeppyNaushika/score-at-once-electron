/**
 * @fileoverview クリック採点設定フック
 * @description ダブル/トリプル/クアトロクリック時の採点動作とデバウンス時間をユーザー設定として永続化
 */

import { useCallback } from "react"

import { useUserPreference } from "@/hooks/useUserPreference"

/** クリック採点で選択可能なアクション */
const CLICK_SCORING_ACTIONS = [
  "none",
  "correct",
  "incorrect",
  "partial",
  "partial_modal",
  "pending",
  "unscored",
  "no_answer",
  "double_mark",
  "individual",
] as const

export type ClickScoringAction = (typeof CLICK_SCORING_ACTIONS)[number]

/** 保存値・入力値をアクションへ倒す。知らない値は「なし」に落とす */
export const toClickScoringAction = (value: string): ClickScoringAction =>
  CLICK_SCORING_ACTIONS.find((action) => action === value) ?? "none"

/** クリック回数ごとのアクション設定 */
export interface ClickScoringConfig {
  2: ClickScoringAction
  3: ClickScoringAction
  4: ClickScoringAction
}

/** デフォルト設定 */
const DEFAULT_CLICK_SCORING_CONFIG: ClickScoringConfig = {
  2: "incorrect",
  3: "partial_modal",
  4: "individual",
}

/** 保存文字列をアクション設定へ倒す。壊れていれば既定へ戻す */
const toClickScoringConfig = (stored: string | null): ClickScoringConfig => {
  if (!stored) return DEFAULT_CLICK_SCORING_CONFIG

  try {
    const parsed: unknown = JSON.parse(stored)
    if (typeof parsed !== "object" || parsed === null) {
      return DEFAULT_CLICK_SCORING_CONFIG
    }
    return { ...DEFAULT_CLICK_SCORING_CONFIG, ...parsed }
  } catch {
    return DEFAULT_CLICK_SCORING_CONFIG
  }
}

/** クリック採点設定（アクション割当 + デバウンス時間）をユーザー設定として永続化するフック */
export function useClickScoringConfig() {
  const storedConfig = useUserPreference("clickScoringConfig")
  const debounce = useUserPreference("clickScoringDebounceMs")

  const clickScoringConfig = toClickScoringConfig(storedConfig.value)

  const setClickAction = useCallback(
    (clickCount: 2 | 3 | 4, action: ClickScoringAction) => {
      const next = {
        ...toClickScoringConfig(storedConfig.value),
        [clickCount]: action,
      }
      storedConfig.setValue(JSON.stringify(next))
    },
    [storedConfig]
  )

  return {
    clickScoringConfig,
    clickScoringDebounceMs: debounce.value,
    setClickAction,
    setClickScoringDebounceMs: debounce.setValue,
  }
}
