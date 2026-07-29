/**
 * @fileoverview クリック採点設定フック
 * @description ダブル/トリプル/クアトロクリック時の採点動作とデバウンス時間をユーザー設定として永続化
 */

import { useCallback, useEffect, useRef, useState } from "react"

import { useAuth } from "@/contexts/AuthContext"
import {
  parsePreference,
  serializePreference,
  USER_PREFERENCE_SCHEMA,
} from "@/lib/userPreferences"

/** クリック採点で選択可能なアクション */
export type ClickScoringAction =
  | "none"
  | "correct"
  | "incorrect"
  | "partial"
  | "partial_modal"
  | "pending"
  | "unscored"
  | "no_answer"
  | "double_mark"
  | "individual"

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

const DEFAULT_DEBOUNCE_MS =
  USER_PREFERENCE_SCHEMA.clickScoringDebounceMs.default

/** クリック採点設定（アクション割当 + デバウンス時間）をユーザー設定として永続化するフック */
export function useClickScoringConfig() {
  const { user } = useAuth()
  const userId = user?.id

  const [clickScoringConfig, setClickScoringConfigState] =
    useState<ClickScoringConfig>(DEFAULT_CLICK_SCORING_CONFIG)
  const [clickScoringDebounceMs, setClickScoringDebounceMsState] =
    useState<number>(DEFAULT_DEBOUNCE_MS)
  const initializedUserIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (initializedUserIdRef.current === userId) return
    if (!userId) return

    initializedUserIdRef.current = userId

    const load = async () => {
      if (!window.electronAPI?.settings) return

      try {
        const [configResult, debounceResult] = await Promise.all([
          window.electronAPI.settings.getUserPreference(
            userId,
            "clickScoringConfig"
          ),
          window.electronAPI.settings.getUserPreference(
            userId,
            "clickScoringDebounceMs"
          ),
        ])

        if (configResult.success) {
          const raw = parsePreference(
            "clickScoringConfig",
            configResult.value ?? null
          )
          if (raw) {
            try {
              const parsed = JSON.parse(raw)
              setClickScoringConfigState({
                ...DEFAULT_CLICK_SCORING_CONFIG,
                ...parsed,
              })
            } catch {
              // keep default
            }
          }
        }

        if (debounceResult.success) {
          setClickScoringDebounceMsState(
            parsePreference(
              "clickScoringDebounceMs",
              debounceResult.value ?? null
            )
          )
        }
      } catch (error) {
        console.error("クリック採点設定の読み込みに失敗しました:", error)
      }
    }

    load()
  }, [userId])

  /** 特定クリック回数のアクションを変更 */
  const setClickAction = useCallback(
    (clickCount: 2 | 3 | 4, action: ClickScoringAction) => {
      setClickScoringConfigState((prev) => {
        const next = { ...prev, [clickCount]: action }
        if (userId && window.electronAPI?.settings) {
          window.electronAPI.settings
            .setUserPreference(
              userId,
              "clickScoringConfig",
              serializePreference("clickScoringConfig", JSON.stringify(next))
            )
            .catch((error) =>
              console.error("クリック採点設定の保存に失敗しました:", error)
            )
        }
        return next
      })
    },
    [userId]
  )

  /** デバウンス時間を変更 */
  const setClickScoringDebounceMs = useCallback(
    (value: number) => {
      setClickScoringDebounceMsState(value)
      if (userId && window.electronAPI?.settings) {
        window.electronAPI.settings
          .setUserPreference(
            userId,
            "clickScoringDebounceMs",
            serializePreference("clickScoringDebounceMs", value)
          )
          .catch((error) =>
            console.error("デバウンス時間の保存に失敗しました:", error)
          )
      }
    },
    [userId]
  )

  return {
    clickScoringConfig,
    clickScoringDebounceMs,
    setClickAction,
    setClickScoringDebounceMs,
  }
}
