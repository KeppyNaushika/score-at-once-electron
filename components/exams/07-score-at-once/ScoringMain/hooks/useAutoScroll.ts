/**
 * @fileoverview 自動スクロール設定フック
 * @description KV方式ユーザー設定の永続化（楽観的更新）
 */

import { useCallback, useEffect, useRef, useState } from "react"

import { useAuth } from "@/contexts/AuthContext"
import {
  parsePreference,
  serializePreference,
  USER_PREFERENCE_SCHEMA,
} from "@/lib/userPreferences"

const DEFAULT = USER_PREFERENCE_SCHEMA.autoScroll.default

export function useAutoScroll() {
  const { user } = useAuth()
  const userId = user?.id

  const [autoScroll, setAutoScrollState] = useState<boolean>(DEFAULT)
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
          "autoScroll"
        )
        if (result.success) {
          setAutoScrollState(
            parsePreference("autoScroll", result.value ?? null)
          )
        }
      } catch (error) {
        console.error("autoScrollの読み込みに失敗しました:", error)
      }
      setIsLoading(false)
    }

    load()
  }, [userId])

  const setAutoScroll = useCallback(
    (value: boolean) => {
      setAutoScrollState(value)
      if (userId && window.electronAPI?.settings) {
        window.electronAPI.settings
          .setUserPreference(
            userId,
            "autoScroll",
            serializePreference("autoScroll", value)
          )
          .catch((error) =>
            console.error("autoScrollの保存に失敗しました:", error)
          )
      }
    },
    [userId]
  )

  return { autoScroll, setAutoScroll, isLoading }
}
