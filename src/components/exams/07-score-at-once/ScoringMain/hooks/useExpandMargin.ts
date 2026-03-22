/**
 * @fileoverview 表示領域拡張設定フック
 * @description KV方式ユーザー設定の永続化（楽観的更新）
 */

import { useCallback, useEffect, useRef, useState } from "react"

import { useAuth } from "@/contexts/AuthContext"
import {
  parsePreference,
  serializePreference,
  USER_PREFERENCE_SCHEMA,
} from "@/lib/userPreferences"

const DEFAULT = USER_PREFERENCE_SCHEMA.expandMargin.default

/** 採点グリッドの表示領域拡張マージンをユーザー設定として永続化するフック */
export function useExpandMargin() {
  const { user } = useAuth()
  const userId = user?.id

  const [expandMargin, setExpandMarginState] = useState<number>(DEFAULT)
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
          "expandMargin"
        )
        if (result.success) {
          setExpandMarginState(
            parsePreference("expandMargin", result.value ?? null)
          )
        }
      } catch (error) {
        console.error("expandMarginの読み込みに失敗しました:", error)
      }
    }

    load()
  }, [userId])

  const setExpandMargin = useCallback(
    (value: number) => {
      setExpandMarginState(value)
      if (userId && window.electronAPI?.settings) {
        window.electronAPI.settings
          .setUserPreference(
            userId,
            "expandMargin",
            serializePreference("expandMargin", value)
          )
          .catch((error) =>
            console.error("expandMarginの保存に失敗しました:", error)
          )
      }
    },
    [userId]
  )

  return { expandMargin, setExpandMargin }
}
