/**
 * @fileoverview 1行あたりの表示件数設定フック
 * @description KV方式ユーザー設定の永続化（楽観的更新）
 */

import { useCallback, useEffect, useRef, useState } from "react"

import { useAuth } from "@/contexts/AuthContext"
import {
  parsePreference,
  serializePreference,
  USER_PREFERENCE_SCHEMA,
} from "@/lib/userPreferences"

const DEFAULT = USER_PREFERENCE_SCHEMA.itemsPerLine.default

export function useItemsPerLine() {
  const { user } = useAuth()
  const userId = user?.id

  const [itemsPerLine, setItemsPerLineState] = useState<number>(DEFAULT)
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
          "itemsPerLine"
        )
        if (result.success) {
          setItemsPerLineState(
            parsePreference("itemsPerLine", result.value ?? null)
          )
        }
      } catch (error) {
        console.error("itemsPerLineの読み込みに失敗しました:", error)
      }
      setIsLoading(false)
    }

    load()
  }, [userId])

  const setItemsPerLine = useCallback(
    (value: number[]) => {
      const newValue = value[0]
      setItemsPerLineState(newValue)
      if (userId && window.electronAPI?.settings) {
        window.electronAPI.settings
          .setUserPreference(
            userId,
            "itemsPerLine",
            serializePreference("itemsPerLine", newValue)
          )
          .catch((error) =>
            console.error("itemsPerLineの保存に失敗しました:", error)
          )
      }
    },
    [userId]
  )

  return {
    itemsPerLine: [itemsPerLine],
    setItemsPerLine,
    isLoading,
  }
}
