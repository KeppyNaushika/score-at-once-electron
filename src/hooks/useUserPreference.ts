"use client"

import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { toast } from "sonner"

import { useAuth } from "@/contexts/AuthContext"
import { queryKeys } from "@/lib/queryKeys"
import type { PreferenceKey, PreferenceValueType } from "@/lib/userPreferences"
import { parsePreference, serializePreference } from "@/lib/userPreferences"

/**
 * KV方式のユーザー設定（`UserPreference`）を1キー分読み書きするフック。
 *
 * 設定ごとに同じ形のフックが並んでいたのを1本に畳んだもの。読み取りは `useQuery`、
 * 書き込みは楽観更新（保存の応答を待たずにキャッシュへ書く）。設定は操作した瞬間に
 * 効かないと使えないため、往復を待たない。
 *
 * 未ログインの間は取得せず、既定値を返す。
 */
export function useUserPreference<TKey extends PreferenceKey>(key: TKey) {
  const { user } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()

  const queryKey = queryKeys.userPreference.detail(userId, key)

  const { data: storedValue } = useQuery({
    queryKey,
    queryFn: userId
      ? () => window.electronAPI.settings.getUserPreference(userId, key)
      : skipToken,
  })

  const value = parsePreference(key, storedValue ?? null)

  const setValue = useCallback(
    (nextValue: PreferenceValueType[TKey]) => {
      const serialized = serializePreference(key, nextValue)

      // 応答を待たずに反映する。保存に失敗したら知らせるが、表示は戻さない
      // （利用者の操作を巻き戻すほうが混乱する）
      queryClient.setQueryData(queryKey, serialized)

      if (!userId) return

      window.electronAPI.settings
        .setUserPreference(userId, key, serialized)
        .catch((error: unknown) => {
          toast.error("設定の保存に失敗しました", {
            description: error instanceof Error ? error.message : undefined,
          })
        })
    },
    [key, queryClient, queryKey, userId]
  )

  return { value, setValue }
}
