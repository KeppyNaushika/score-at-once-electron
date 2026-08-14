"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import type { PreferenceKey, PreferenceValueType } from "@/lib/userPreferences"
import { serializePreference } from "@/lib/userPreferences"
import {
  setUserPreferenceMutation,
  userPreferenceQuery,
} from "@/queries/settings"

/**
 * ユーザー設定を書く口。
 *
 * **値は型のまま渡す。** 保存文字列への変換をここだけで行うので、読む側の
 * `parsePreference` と段数が食い違わない。呼び出し側が個別に `JSON.stringify`
 * していた頃は、同じキーへ2つの符号化が書かれ、保存済みの値が読めなくなった
 * （R1 #2 / #6）。
 *
 * 書いた値は**先にキャッシュへ置く**。設定は操作した瞬間に効かないと使えず、
 * スライダーやトグルは取得結果に制御されているので、往復を待つと指に付いてこない
 * （R1 #10）。失敗したときは `MutationCache` の取り直しが DB の姿へ戻す。
 */
export function useWritePreference(userId: string | undefined) {
  const queryClient = useQueryClient()
  const setPreference = useMutation(setUserPreferenceMutation(userId))

  return useCallback(
    <TKey extends PreferenceKey>(
      key: TKey,
      value: PreferenceValueType[TKey]
    ) => {
      const serialized = serializePreference(key, value)
      queryClient.setQueryData(
        userPreferenceQuery(userId, key).queryKey,
        serialized
      )
      setPreference.mutate({ key, value: serialized })
    },
    [queryClient, setPreference, userId]
  )
}
