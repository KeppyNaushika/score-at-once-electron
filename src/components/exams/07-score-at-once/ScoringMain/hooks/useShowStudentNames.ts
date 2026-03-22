/**
 * @fileoverview 生徒名表示設定フック
 * @description KV方式ユーザー設定の永続化（楽観的更新）
 */

import { useCallback, useEffect, useRef, useState } from "react"

import { useAuth } from "@/contexts/AuthContext"
import {
  parsePreference,
  serializePreference,
  USER_PREFERENCE_SCHEMA,
} from "@/lib/userPreferences"

const DEFAULT = USER_PREFERENCE_SCHEMA.showStudentNames.default

export function useShowStudentNames() {
  const { user } = useAuth()
  const userId = user?.id

  const [showStudentNames, setShowStudentNamesState] =
    useState<boolean>(DEFAULT)
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
          "showStudentNames"
        )
        if (result.success) {
          setShowStudentNamesState(
            parsePreference("showStudentNames", result.value ?? null)
          )
        }
      } catch (error) {
        console.error("showStudentNamesの読み込みに失敗しました:", error)
      }
    }

    load()
  }, [userId])

  const setShowStudentNames = useCallback(
    (value: boolean) => {
      setShowStudentNamesState(value)
      if (userId && window.electronAPI?.settings) {
        window.electronAPI.settings
          .setUserPreference(
            userId,
            "showStudentNames",
            serializePreference("showStudentNames", value)
          )
          .catch((error) =>
            console.error("showStudentNamesの保存に失敗しました:", error)
          )
      }
    },
    [userId]
  )

  return { showStudentNames, setShowStudentNames }
}
