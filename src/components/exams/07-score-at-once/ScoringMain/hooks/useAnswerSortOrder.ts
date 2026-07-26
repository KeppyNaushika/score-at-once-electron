/**
 * @fileoverview 一覧表示の並び順設定フック
 * @description KV方式ユーザー設定の永続化（楽観的更新）
 */

import { useCallback, useEffect, useRef, useState } from "react"

import type { AnswerSortOrder } from "@/components/exams/07-score-at-once/types"
import { useAuth } from "@/contexts/AuthContext"
import {
  parsePreference,
  serializePreference,
  USER_PREFERENCE_SCHEMA,
} from "@/lib/userPreferences"

const DEFAULT = USER_PREFERENCE_SCHEMA.answerSortOrder
  .default as AnswerSortOrder

/** 一覧表示の並び順（表示順・白さ順）をユーザー設定として永続化するフック */
export function useAnswerSortOrder() {
  const { user } = useAuth()
  const userId = user?.id

  const [answerSortOrder, setAnswerSortOrderState] =
    useState<AnswerSortOrder>(DEFAULT)
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
          "answerSortOrder"
        )
        if (result.success) {
          setAnswerSortOrderState(
            parsePreference(
              "answerSortOrder",
              result.value ?? null
            ) as AnswerSortOrder
          )
        }
      } catch (error) {
        console.error("answerSortOrderの読み込みに失敗しました:", error)
      }
    }

    load()
  }, [userId])

  const setAnswerSortOrder = useCallback(
    (value: AnswerSortOrder) => {
      setAnswerSortOrderState(value)
      if (userId && window.electronAPI?.settings) {
        window.electronAPI.settings
          .setUserPreference(
            userId,
            "answerSortOrder",
            serializePreference("answerSortOrder", value)
          )
          .catch((error) =>
            console.error("answerSortOrderの保存に失敗しました:", error)
          )
      }
    },
    [userId]
  )

  return { answerSortOrder, setAnswerSortOrder }
}
