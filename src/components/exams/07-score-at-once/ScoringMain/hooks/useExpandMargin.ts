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

export function useExpandMargin() {
  const { user } = useAuth()
  const userId = user?.id

  const [expandMargin, setExpandMarginState] = useState<number>(DEFAULT)
  const [isLoading, setIsLoading] = useState(true)
  const initializedUserIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (initializedUserIdRef.current === userId) return
    if (!userId) {
      setIsLoading(false)
      return
    }

    initializedUserIdRef.current = userId
    setIsLoading(true)

    const load = async () => {
      if (!window.electronAPI?.settings) {
        setIsLoading(false)
        return
      }

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
      setIsLoading(false)
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

  return { expandMargin, setExpandMargin, isLoading }
}
