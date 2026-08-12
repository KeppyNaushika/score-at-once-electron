/**
 * @fileoverview クリック採点設定フック
 * @description ダブル/トリプル/クアトロクリック時の採点動作とデバウンス時間をユーザー設定として永続化
 */

import { useCallback } from "react"

import { useUserPreference } from "@/hooks/useUserPreference"
import { defineStringUnion } from "@/types/stringUnion"

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
export const { to: toClickScoringAction } = defineStringUnion(
  CLICK_SCORING_ACTIONS,
  "none"
)

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

/**
 * 保存文字列をアクション設定へ倒す。
 *
 * 保存済み JSON をそのまま広げると、壊れた値が ClickScoringAction を名乗ったまま
 * 通る（型は保存値の中身を知らない）。クリック回数ごとに1つずつ union へ倒す。
 */
const toClickScoringConfig = (stored: string | null): ClickScoringConfig => {
  if (!stored) return DEFAULT_CLICK_SCORING_CONFIG

  let parsed: unknown
  try {
    parsed = JSON.parse(stored)
  } catch {
    return DEFAULT_CLICK_SCORING_CONFIG
  }
  if (typeof parsed !== "object" || parsed === null) {
    return DEFAULT_CLICK_SCORING_CONFIG
  }

  const storedActions: Record<string, unknown> = { ...parsed }
  const actionOf = (clickCount: 2 | 3 | 4): ClickScoringAction => {
    const value = storedActions[String(clickCount)]
    if (typeof value !== "string")
      return DEFAULT_CLICK_SCORING_CONFIG[clickCount]
    return toClickScoringAction(value)
  }

  return { 2: actionOf(2), 3: actionOf(3), 4: actionOf(4) }
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
