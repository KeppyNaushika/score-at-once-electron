/**
 * @fileoverview レイアウト方向設定フック
 * @description KV方式ユーザー設定の永続化（楽観的更新）
 */

import { useCallback, useEffect, useRef, useState } from "react"

import type { LayoutDirection } from "@/components/exams/07-score-at-once/types"
import { useAuth } from "@/contexts/AuthContext"
import {
  parsePreference,
  serializePreference,
  USER_PREFERENCE_SCHEMA,
} from "@/lib/userPreferences"

const DEFAULT = USER_PREFERENCE_SCHEMA.layoutDirection
  .default as LayoutDirection

/** 採点グリッドのレイアウト方向（右下・左下・下右・下左）をユーザー設定として永続化するフック */
export function useLayoutDirection() {
  const { user } = useAuth()
  const userId = user?.id

  const [layoutDirection, setLayoutDirectionState] =
    useState<LayoutDirection>(DEFAULT)
  const initializedUserIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (initializedUserIdRef.current === userId) return
    if (!userId) return

    initializedUserIdRef.current = userId

    const load = async () => {
      if (!window.electronAPI?.settings) return

      try {
        const result = await window.electronAPI.settings.getUserPreference(
          userId,
          "layoutDirection"
        )
        if (result.success) {
          setLayoutDirectionState(
            parsePreference(
              "layoutDirection",
              result.value ?? null
            ) as LayoutDirection
          )
        }
      } catch (error) {
        console.error("layoutDirectionの読み込みに失敗しました:", error)
      }
    }

    load()
  }, [userId])

  const setLayoutDirection = useCallback(
    (value: LayoutDirection) => {
      setLayoutDirectionState(value)
      if (userId && window.electronAPI?.settings) {
        window.electronAPI.settings
          .setUserPreference(
            userId,
            "layoutDirection",
            serializePreference("layoutDirection", value)
          )
          .catch((error) =>
            console.error("layoutDirectionの保存に失敗しました:", error)
          )
      }
    },
    [userId]
  )

  return { layoutDirection, setLayoutDirection }
}
